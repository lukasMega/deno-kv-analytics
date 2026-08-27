// Turning a raw request into dimension values: UA parsing, crawler naming,
// referrer bucketing, country. All pure (except `country`, which only reads
// headers) and all independently testable — split out of main.ts so the
// handler file stays about routing and KV writes.
//
// Mapped to `npm:isbot@5` in deno.json (bare specifier, not inline — `deno lint`
// rejects inline npm:/jsr: imports). Deno resolves it off npm's ESM build,
// verified against isbot 5.2.1 (`index.mjs` via its `exports` map), so no build
// step is needed on Deno Deploy. If a future Deploy runtime ever fails to resolve
// it, fall back to vendoring isbot's exported `list` + `createIsbotFromList`.
import { isbotMatch } from "isbot";

// Cap any dimension value so a hostile/buggy client can't blow up KV storage or
// write-unit cost with megabyte strings.
const MAXLEN = 128;
export const clamp = (
  s: string,
) => (s.length > MAXLEN ? s.slice(0, MAXLEN) : s);

export function parseUA(
  ua: string,
): { browser: string; os: string; device: string } {
  // Order matters: Edge/Opera/Samsung all carry "Chrome" in their UA, so match
  // the more specific brand first. Brave hides as plain Chrome (by design).
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
    ? "Opera"
    : /SamsungBrowser/.test(ua)
    ? "Samsung Internet"
    : /Vivaldi/.test(ua)
    ? "Vivaldi"
    : /Firefox\//.test(ua)
    ? "Firefox"
    : /Chrome\//.test(ua)
    ? "Chrome"
    : /Safari\//.test(ua)
    ? "Safari"
    : "Other";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
    ? "Android"
    : /Mac OS X/.test(ua)
    ? "macOS"
    : /Linux/.test(ua)
    ? "Linux"
    : "Other";
  const device = /iPad|Tablet/i.test(ua)
    ? "tablet"
    : /Mobi|Android|iPhone|iPod/i.test(ua)
    ? "mobile"
    : "desktop";
  return { browser, os, device };
}

// Name the crawler for the `bot_kind` dim.
//
// `isbotMatch` returns the matched *substring of the UA*, which is wrong at both
// ends: too coarse for the generic `bots?` pattern (ClaudeBot, GPTBot, PetalBot
// and Amazonbot all reduce to "Bot", merging every AI crawler into one row), and
// too fine where the pattern spans a version ("facebookexternalhit/1.1" — a new
// row per release). `isbotPattern` isn't usable either: it returns raw regex
// source. So widen the match to the surrounding product token and drop the
// version → ClaudeBot/1.0 and ClaudeBot/1.2 both land on "claudebot".
const TOKEN_CHARS = /[\w.@-]/;
export function botKind(ua: string): string {
  const match = isbotMatch(ua);
  if (!match) return "unknown";
  const at = ua.toLowerCase().indexOf(match.toLowerCase());
  if (at < 0) return clamp(match.toLowerCase());
  let start = at;
  while (start > 0 && TOKEN_CHARS.test(ua[start - 1])) start--;
  let end = at + match.length;
  while (end < ua.length && TOKEN_CHARS.test(ua[end])) end++;
  // split on "/" so the version suffix never reaches the key
  const token = ua.slice(start, end).split("/")[0].toLowerCase();
  return clamp(token || match.toLowerCase());
}

// Referrer hosts we can classify. Matched against the registrable-ish tail of the
// host (leading `www.` stripped), so `www.google.co.uk` and `news.google.com` both
// land in `search`. Anything unmatched is a plain `referral`.
const SEARCH =
  /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.brave\.com|yahoo\.[a-z.]+|yandex\.[a-z.]+|baidu\.com|ecosia\.org|startpage\.com|qwant\.com|searx\.[a-z.]+|kagi\.com|naver\.com|seznam\.cz|ask\.com|perplexity\.ai)$/i;
const SOCIAL =
  /(^|\.)(twitter\.com|x\.com|t\.co|facebook\.com|fb\.com|instagram\.com|linkedin\.com|lnkd\.in|reddit\.com|out\.reddit\.com|youtube\.com|youtu\.be|news\.ycombinator\.com|lobste\.rs|bsky\.app|threads\.net|mastodon\.[a-z.]+|discord\.com|t\.me|tiktok\.com|pinterest\.[a-z.]+|vk\.com)$/i;

// Bucket a referrer host into search / social / internal / direct / referral.
// Classified at ingest (server-side) so the grouping is consistent and survives
// CSV export, instead of being re-derived per dashboard render.
export function refGroup(ref: string, self: string): string {
  const host = ref.replace(/^www\./i, "").toLowerCase();
  if (!host || host === "direct") return "direct";
  if (SEARCH.test(host)) return "search";
  if (SOCIAL.test(host)) return "social";
  // `self` is the beacon's own origin (`location.origin`) or a bare host — compare
  // hosts so a full-page reload inside the docs site isn't counted as acquisition.
  let selfHost = self.replace(/^www\./i, "").toLowerCase();
  try {
    selfHost = new URL(self).host.replace(/^www\./i, "").toLowerCase();
  } catch { /* already a bare host */ }
  if (selfHost && host === selfHost) return "internal";
  return "referral";
}

// Best-effort visitor country: only present if a fronting CDN/proxy sets a
// country header (e.g. Cloudflare `cf-ipcountry`). Deno Deploy itself does not
// expose visitor geo, so on a bare deploy this dim simply never fires — no PII,
// no IP ever read or stored.
export function country(req: Request): string | null {
  const c = req.headers.get("cf-ipcountry") ??
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("x-country-code");
  if (!c || c === "XX" || c.length > 3) return null;
  return c.toUpperCase();
}
