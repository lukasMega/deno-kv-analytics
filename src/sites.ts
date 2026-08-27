// Multi-tenancy: which sites this deployment accepts, how a request is mapped to
// one, and which token may read one.
//
// The `site` is a KV **key segment** (`["c", site, day, dim, value]`), not a dim —
// that gives per-site `kv.list` prefixes for read/prune/export/delete-a-site for
// free, and makes cross-site leakage a key-construction bug (loud, testable)
// rather than a filtering bug (silent).

export type Site = { id: string; host: string | null };

// Deliberately narrow: the id lands in KV keys, env var names, CSV filenames and
// a query param, so keep it to a shape that is safe in all four.
const ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;

// Compare hosts case-insensitively and without a leading `www.`; the port is kept
// (localhost:8000 is a legitimate dev mapping).
export const normalizeHost = (h: string) =>
  h.replace(/^www\./i, "").toLowerCase();

/**
 * Parse the `SITES` env var:
 *
 *   SITES="deckbridge:stats.deckbridge.app,acme:stats.acme.dev,scratch"
 *
 * `id:host` maps a custom domain to a site (preferred — the host is unspoofable
 * by page JS, so no client param is trusted). A bare `id` is allowed but can then
 * only be selected via `?s=`.
 *
 * Throws on a malformed entry: a typo here must fail at boot, not silently create
 * a site nobody writes to.
 */
export function loadSites(
  env: { get(k: string): string | undefined } = Deno.env,
): Map<string, Site> {
  const raw = (env.get("SITES") ?? "").trim();
  const sites = new Map<string, Site>();
  if (!raw) return sites;

  for (const entry of raw.split(",")) {
    const part = entry.trim();
    if (!part) continue;
    const at = part.indexOf(":");
    const id = (at < 0 ? part : part.slice(0, at)).trim().toLowerCase();
    const host = at < 0 ? null : normalizeHost(part.slice(at + 1).trim());
    if (!ID.test(id)) {
      throw new Error(`SITES: invalid site id ${JSON.stringify(id)}`);
    }
    if (sites.has(id)) {
      throw new Error(`SITES: duplicate site id ${JSON.stringify(id)}`);
    }
    sites.set(id, { id, host: host || null });
  }
  return sites;
}

/** host → id index, built once per handler rather than per request. */
export function hostIndex(sites: Map<string, Site>): Map<string, string> {
  const idx = new Map<string, string>();
  for (const s of sites.values()) if (s.host) idx.set(s.host, s.id);
  return idx;
}

/**
 * Resolve the site for a request, in priority order:
 *
 *   1. the request Host, if a site claims that domain — unspoofable by page JS,
 *      and it means a consumer on `stats.<their-domain>` needs no config at all;
 *   2. `?s=` (beacon) / `?site=` (stats), but only for an allowlisted id — the
 *      fallback for the shared `*.deno.net` hostname and for local dev;
 *   3. the only configured site, if there is exactly one (single-tenant DX).
 *
 * `null` means "not ours". Callers must not write anything for a null site: an
 * open site param would let anyone mint unbounded KV prefixes and burn the
 * shared write budget.
 */
export function resolveSite(
  url: URL,
  sites: Map<string, Site>,
  byHost: Map<string, string> = hostIndex(sites),
): string | null {
  const viaHost = byHost.get(normalizeHost(url.host));
  if (viaHost) return viaHost;

  const param =
    (url.searchParams.get("s") ?? url.searchParams.get("site") ?? "")
      .toLowerCase();
  if (param) return sites.has(param) ? param : null;

  if (sites.size === 1) return [...sites.keys()][0];
  return null;
}

/**
 * Per-site stats token: `STATS_TOKEN_<ID>` with the id uppercased and every
 * non-alphanumeric character replaced by `_` (`my-site` → `STATS_TOKEN_MY_SITE`).
 * Empty string when unset — callers must treat that as "no per-site token", never
 * as "any token matches".
 *
 * `STATS_TOKEN` stays the admin token: it reads every site and is the only one
 * that may list `/sites`.
 */
export function tokenFor(
  site: string,
  env: { get(k: string): string | undefined } = Deno.env,
): string {
  return env.get(
    `STATS_TOKEN_${site.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`,
  ) ?? "";
}
