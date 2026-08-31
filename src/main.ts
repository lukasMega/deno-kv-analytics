// Cookieless web analytics collector — Deno Deploy (console.deno.com).
// No cookies, no IP, no fingerprint → no consent banner. See README.md.
//
// One deployment serves many sites: every counter is keyed under a `site`
// segment and a request is mapped to a site by its Host (see sites.ts).
//
// Structure: this file is routing, ingest and KV reads; turning a request into
// dimension values lives in classify.ts. `createHandler(kv, sites)` and the
// helpers are exported for tests; the live server (Deno.serve) and prune cron
// only run when this module is the entrypoint (import.meta.main) — which it is
// on Deploy, so the cron still registers at module top level there.

// Bare specifier, not inline — `deno lint` rejects inline npm:/jsr: imports.
// See classify.ts for why isbot resolves without a build step on Deploy.
import { isbot } from "isbot";
import { badgeSvg, formatCount, safeColor, safeLabel } from "./badge.ts";
import { botKind, clamp, country, parseUA, refGroup } from "./classify.ts";
import { openKv } from "./kv.ts";
import {
  badgeSites,
  readPvRange,
  readPvTotal,
  readStats,
  totalKey,
} from "./reads.ts";
import {
  hostIndex,
  loadSites,
  resolveSite,
  type Site,
  tokenFor,
} from "./sites.ts";

// Re-exported so tests keep importing these from main.ts; the read paths
// themselves live in reads.ts, split out to keep this file under the line cap.
export { readPvRange, readPvTotal, readStats, totalKey };

const today = () => new Date().toISOString().slice(0, 10);

// 1×1 transparent gif (43 bytes)
const GIF = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (c) => c.charCodeAt(0),
);
const gif = () =>
  new Response(GIF, {
    headers: { "content-type": "image/gif", "cache-control": "no-store" },
  });

// Read as sibling files of main.ts. Deno Deploy bundles new-URL-referenced files
// that sit next to the entrypoint (dashboard.html works this way) but NOT ones in
// a subdir, and it ignores `with { type: "text" }` imports at runtime — so keep
// the uPlot assets flat in this dir, not under vendor/.
const DASHBOARD = new URL("./dashboard.html", import.meta.url);
const HELP = new URL("./help.html", import.meta.url);
const UPLOT_JS = new URL("./uPlot.iife.min.js", import.meta.url);
const UPLOT_CSS = new URL("./uPlot.min.css", import.meta.url);
// UI assets shared by /dashboard and /help. Same flat-sibling rule as above; the
// path a browser requests is the filename, so adding one here is the only step.
const UI_ASSETS: Record<string, [URL, string]> = {
  "/dashboard.css": [new URL("./dashboard.css", import.meta.url), "text/css"],
  "/dashboard.js": [
    new URL("./dashboard.js", import.meta.url),
    "text/javascript",
  ],
  "/dash-charts.js": [
    new URL("./dash-charts.js", import.meta.url),
    "text/javascript",
  ],
  "/da-common.js": [
    new URL("./da-common.js", import.meta.url),
    "text/javascript",
  ],
  "/help.js": [new URL("./help.js", import.meta.url), "text/javascript"],
};
// The browser beacon, built from client/beacon.ts by `deno task build-client`.
// Same flat-sibling rule as the uPlot assets — it is served to every visitor's
// page, so a 404 here is the whole product silently not collecting.
const BEACON_JS = new URL("./s.js", import.meta.url);

function nextDay(day: string): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// constant-time-ish string compare for the stats token
export function eq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Extract the stats token from either `Authorization: Bearer <t>` (dashboard —
// keeps the secret out of access logs) or `?token=` (curl convenience).
function statsToken(req: Request, url: URL): string {
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m ? m[1] : (url.searchParams.get("token") ?? "");
}

// `STATS_TOKEN` is the admin token: reads any site, and is the only one that may
// list `/sites`. Unset → no admin access at all (never "everything matches").
function isAdmin(token: string): boolean {
  const admin = Deno.env.get("STATS_TOKEN") ?? "";
  return !!admin && eq(token, admin);
}

// Serve a static asset file. On a read failure return a readable 404 instead of
// letting Deploy swallow it into an opaque 500 (which is what made this hard to
// debug the first time around).
async function asset(u: URL, type: string, maxAge = 86400): Promise<Response> {
  try {
    return new Response(await Deno.readTextFile(u), {
      headers: {
        "content-type": `${type}; charset=utf-8`,
        "cache-control": `public, max-age=${maxAge}`,
      },
    });
  } catch (e) {
    return new Response(
      `asset unavailable: ${e instanceof Error ? e.message : e}`,
      {
        status: 404,
      },
    );
  }
}

export function createHandler(kv: Deno.Kv, sites: Map<string, Site>) {
  const byHost = hostIndex(sites);

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const site = resolveSite(url, sites, byHost);

    // --- beacon ingest ---
    if (req.method === "GET" && url.pathname === "/e") {
      // Unknown site → the same gif, but nothing written. Not a 4xx: the response
      // must not tell a prober which sites exist, and a misconfigured consumer
      // should degrade to a no-op rather than to a broken image on every page.
      if (!site) return gif();

      const ua = req.headers.get("user-agent") ?? "";
      // Count instead of silently dropping: `bot` is the total, `bot_kind` names
      // the crawler, so the filter is tunable against real traffic instead of
      // guesswork. Still a 200 gif, still no `pv` — visitor-visible behavior is
      // unchanged. Bots reaching `/e` at all are rare (the beacon needs JS + DOM,
      // so curl/wget/classic crawlers never get here), so 2 extra write units per
      // hit is noise against the pageview budget.
      if (isbot(ua)) {
        await kv.atomic()
          .sum(["c", site, today(), "bot", "ua"], 1n)
          .sum(["c", site, today(), "bot_kind", botKind(ua)], 1n)
          .commit();
        return gif();
      }

      let host = "unknown";
      try {
        host = new URL(req.headers.get("referer") ?? "").origin;
      } catch { /* no/invalid referer */ }

      // opaque token: base64(encodeURIComponent(JSON)) — mirror client encoding
      let d: Record<string, string> = {};
      try {
        d = JSON.parse(
          decodeURIComponent(atob(url.searchParams.get("v") ?? "")),
        );
      } catch { /* ignore malformed */ }

      const { browser, os, device } = parseUA(ua);
      // one clock read for day/hour/dow — otherwise a hit landing on the midnight
      // boundary could be filed under one day but carry the next day's hour.
      const now = new Date();
      const day = now.toISOString().slice(0, 10);

      const isEvent = !!d.ev;
      let dims: [string, string][];
      if (isEvent) {
        const ev = clamp(d.ev);
        // The behavioral probe rides the same beacon shape as a download/outbound
        // click, but its verdict is not a user action — give it its own dims so
        // `event`/`event_target` stay a list of real interactions. Without this
        // split, `event_target` interleaves latency buckets with filenames and
        // outbound hosts, and `hi` (≈1 per pageview) squashes the download/outbound
        // bars, which scale against the largest count in the dim.
        if (ev === "hi") {
          // one dim, not two: the bucket IS the value → 1 write unit, not 2
          dims = [["hi", clamp(d.t ?? "unknown")]];
        } else if (ev === "bot") {
          // same `bot` dim as the UA check, keyed by how it was caught:
          // "ua" (isbot matched the header) vs "synthetic" (untrusted DOM event)
          dims = [["bot", "synthetic"]];
        } else {
          dims = [["event", ev]];
          if (d.t) dims.push(["event_target", clamp(d.t)]);
        }
      } else {
        const lang = (d.l ?? "").split("-")[0] || "unknown";
        const hour = String(now.getUTCHours()).padStart(2, "0");
        const dow = String(now.getUTCDay()); // 0=Sun … 6=Sat, UTC
        // `||` not `??`: the client sends r:"" (empty string) for direct traffic.
        const ref = clamp(d.r || "direct");
        dims = [
          ["pv", "_"],
          ["path", clamp(d.p ?? "/")],
          ["host", clamp(d.h ?? host)],
          ["ref", ref],
          ["ref_group", refGroup(ref, d.h ?? host)],
          ["lang", clamp(lang)],
          ["tz", clamp(d.tz ?? "unknown")],
          ["browser", browser],
          ["os", os],
          ["device", device],
          ["hour", hour],
          // The ONE pairwise key in the schema: a true day×hour joint counter.
          // `dow` and `hour` alone are independent marginals — combining them
          // client-side would fabricate an outer product, not real co-occurrence.
          // Per-day `dow` bars are recoverable by summing this dim over hours.
          ["dowhour", `${dow}-${hour}`],
        ];
        const cc = country(req);
        if (cc) dims.push(["country", cc]);
        if (d.vw) dims.push(["viewport", clamp(d.vw)]);
        if (d.us) dims.push(["utm_source", clamp(d.us)]);
        if (d.um) dims.push(["utm_medium", clamp(d.um)]);
        if (d.uc) dims.push(["utm_campaign", clamp(d.uc)]);
        if (d.u === "1") dims.push(["uv", "_"]);
        if (d.s === "1") dims.push(["sessions", "_"]);
        if (d.b === "1") dims.push(["bounce", "_"]);
      }

      let tx = kv.atomic();
      for (const [dim, value] of dims) {
        tx = tx.sum(["c", site, day, dim, value], 1n);
      }
      // All-time counter, same commit so it can never drift from `pv`. One extra
      // write unit per pageview (12 → 13 dims), which is why it is gated on the
      // site having a badge to display it — see `totalKey`.
      if (!isEvent && badgeSites().has(site)) tx = tx.sum(totalKey(site), 1n);
      await tx.commit();
      return gif();
    }

    // --- site list (admin only; powers the dashboard's site picker) ---
    if (req.method === "GET" && url.pathname === "/sites") {
      if (!isAdmin(statsToken(req, url))) {
        return new Response("unauthorized", { status: 401 });
      }
      return Response.json([...sites.values()]);
    }

    // --- dashboard JSON ---
    if (req.method === "GET" && url.pathname === "/stats") {
      const token = statsToken(req, url);
      // The per-site token is checked against the site that was *resolved* for
      // this request — never against the set of all configured tokens. Otherwise
      // site A's token reads site B, which is the whole tenancy boundary.
      const perSite = site ? tokenFor(site) : "";
      const ok = isAdmin(token) || (!!perSite && eq(token, perSite));
      if (!site || !ok) {
        return new Response("unauthorized", { status: 401 });
      }

      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      if (from && to) {
        const wantSeries = !!url.searchParams.get("series");
        // build the inclusive day list, then read all days in parallel
        const days: string[] = [];
        for (let day = from; day <= to; day = nextDay(day)) days.push(day);
        const parts = await Promise.all(
          days.map((day) => readStats(kv, site, day)),
        );

        const out: Record<string, Record<string, number>> = {};
        // series rows: [day, pv, uv, sessions, bot] — powers the multi-line
        // trend. `bot` is the per-day total of the `bot` dim (ua + synthetic);
        // it rides the same row so the dashboard's opt-in bot line needs no
        // second request. Human metrics stay bot-free — bot hits never write pv.
        const series: [string, number, number, number, number][] = [];
        for (let i = 0; i < days.length; i++) {
          const part = parts[i];
          for (const dim in part) {
            for (const v in part[dim]) {
              (out[dim] ??= {})[v] = (out[dim][v] ?? 0) + part[dim][v];
            }
          }
          if (wantSeries) {
            let bots = 0;
            for (const v in part.bot ?? {}) bots += part.bot[v];
            series.push([
              days[i],
              part.pv?._ ?? 0,
              part.uv?._ ?? 0,
              part.sessions?._ ?? 0,
              bots,
            ]);
          }
        }
        if (wantSeries) {
          return Response.json({ site, from, to, series, ...out });
        }
        return Response.json({ site, from, to, ...out });
      }

      const day = url.searchParams.get("day") ?? today();
      return Response.json({ site, day, ...await readStats(kv, site, day) });
    }

    // --- public README badge (SVG) ---
    // The only unauthenticated read in the app, so it is opt-in per site via
    // `BADGE_SITES` and exposes only `pv` counts: a window total, an all-time
    // total, or both. No dim breakdown, no bot/event data, no way to widen it
    // to another dim. Unset BADGE_SITES → no site has a badge.
    if (req.method === "GET" && url.pathname === "/badge") {
      // Same 404 for "no such site" and "not opted in": a prober must not be
      // able to enumerate site ids, same reason /e answers a gif either way.
      if (!site || !badgeSites().has(site)) {
        return new Response("not found", { status: 404 });
      }

      const q = url.searchParams;
      // `days=all` reads the lifetime counter instead of a window. Any other
      // value is clamped to the retention window, because days older than that
      // are pruned and would silently read as zero.
      const rawDays = q.get("days") ?? "30";
      const allTime = rawDays === "all";
      const n = Number(rawDays);
      const days = Math.min(
        Math.max(Number.isFinite(n) ? Math.floor(n) : 30, 1),
        RETENTION_DAYS,
      );
      // `total=1` renders both numbers in one image. Redundant when the window
      // already *is* all time, so `days=all` wins and drops the second box.
      const withTotal = !allTime && q.get("total") === "1";

      const values: string[] = [];
      const colors = [safeColor(q.get("color"))];
      let fallbackLabel: string;
      if (allTime) {
        values.push(formatCount(await readPvTotal(kv, site)));
        fallbackLabel = "views (all)";
      } else if (withTotal) {
        const [win, total] = await Promise.all([
          readPvRange(kv, site, days),
          readPvTotal(kv, site),
        ]);
        values.push(formatCount(win), formatCount(total));
        colors.push(safeColor(q.get("totalColor"), "#8957e5"));
        // Charset matches safeLabel's, so an operator can retype the default.
        fallbackLabel = `views ${days}d + all`;
      } else {
        values.push(formatCount(await readPvRange(kv, site, days)));
        fallbackLabel = `views (${days}d)`;
      }

      const svg = badgeSvg(
        safeLabel(q.get("label"), fallbackLabel),
        values,
        colors,
        safeColor(q.get("labelColor"), "#555"),
      );
      return new Response(svg, {
        headers: {
          "content-type": "image/svg+xml; charset=utf-8",
          // GitHub proxies README images through Camo, which caches them, so a
          // shorter TTL buys nothing but load. 5 min keeps a manual refresh
          // (?days=…) responsive during setup.
          "cache-control": "public, max-age=300",
        },
      });
    }

    // --- browser beacon (built from client/beacon.ts) ---
    if (req.method === "GET" && url.pathname === "/s.js") {
      // Shorter cache than the vendored uPlot: this is the one asset that
      // actually changes, and a stale copy silently under-reports.
      return await asset(BEACON_JS, "text/javascript", 3600);
    }

    // --- vendored uPlot (served locally — no CDN dependency) ---
    if (req.method === "GET" && url.pathname === "/vendor/uPlot.iife.min.js") {
      return await asset(UPLOT_JS, "text/javascript");
    }
    if (req.method === "GET" && url.pathname === "/vendor/uPlot.min.css") {
      return await asset(UPLOT_CSS, "text/css");
    }

    // --- dashboard / setup UI ---
    // The HTML and its JS carry no secrets: the token is typed into the page and
    // every request they make is authorized like any other /stats call. Serving
    // them ungated is what lets a new operator reach /help before they have a
    // working token — which is exactly who that page is for.
    if (req.method === "GET" && UI_ASSETS[url.pathname]) {
      const [file, type] = UI_ASSETS[url.pathname];
      // Short cache, like /s.js: these change, and a stale copy is confusing
      // rather than merely slow.
      return await asset(file, type, 3600);
    }
    if (
      req.method === "GET" &&
      (url.pathname === "/dashboard" || url.pathname === "/help")
    ) {
      const file = url.pathname === "/help" ? HELP : DASHBOARD;
      return new Response(await Deno.readTextFile(file), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    return new Response("ok");
  };
}

const RETENTION_DAYS = 400;

// Registers the prune cron + live server. Only runs when this module is the
// entrypoint — on Deno Deploy that's the case, so the cron still registers at
// module top level (required or Deploy skips it). Skipped when imported by tests.
/**
 * Delete every counter older than `RETENTION_DAYS`, for each site.
 *
 * Exported for tests. The per-site loop is not cosmetic: keys now sort by site
 * *then* day, so the "first in-range day means we're done" early exit is only
 * valid **within one site's prefix**. A single `kv.list({prefix:["c"]})` with
 * that break would stop at the first site's cutoff and never prune any other
 * site — KV then grows forever.
 */
export async function prune(
  kv: Deno.Kv,
  sites: Iterable<string>,
  now = new Date(),
) {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);
  const cutoffDay = cutoff.toISOString().slice(0, 10);
  for (const site of sites) {
    for await (const row of kv.list({ prefix: ["c", site] })) {
      const day = row.key[2] as string;
      if (day < cutoffDay) await kv.delete(row.key);
      else break; // within a site, keys sort by day → we're done
    }
  }
}

if (import.meta.main) {
  const kv = await openKv();
  // Throws on a malformed SITES entry — fail at boot, not silently per request.
  const sites = loadSites();
  if (sites.size === 0) {
    console.warn(
      "SITES is empty: every beacon will be a no-op. See README.md.",
    );
  }

  // Caps unbounded KV growth. Scans forward from each site's oldest day instead
  // of listing every key, so cost is O(days pruned), not O(all rows).
  Deno.cron("prune old analytics", "0 3 * * *", () => prune(kv, sites.keys()));

  // PORT is for local dev only (another project already owning :8000 shouldn't
  // block this one). Deploy injects its own port and ignores this.
  const port = Number(Deno.env.get("PORT")) || undefined;
  Deno.serve({ port }, createHandler(kv, sites));
}
