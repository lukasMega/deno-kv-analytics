// End-to-end: boot the real listener over an in-memory KV and drive it with
// fetch over the network, instead of calling the handler function directly the
// way main_test.ts/sites_test.ts do.
//
// What that buys, and why it is a separate file: the unit tests never touch the
// asset paths (/s.js, /dashboard, /vendor/*), which are read from disk via
// `new URL("./x", import.meta.url)` — the exact mechanism that silently breaks
// on Deploy when a file stops being a flat sibling of main.ts. A missing asset
// is a 404 here, not an unnoticed 500 in production.
import { assertEquals, assertStringIncludes } from "@std/assert";
import { createHandler } from "./main.ts";
import { loadSites } from "./sites.ts";

Deno.env.set("STATS_TOKEN", "e2etoken");

// A single site with no host mapping: resolveSite falls back to "the only
// configured site", so requests to 127.0.0.1:<random port> still resolve.
const SITES = loadSites({ get: () => "demo" });

// mirror client/beacon.ts send(): base64(encodeURIComponent(JSON))
const encode = (p: Record<string, string>) =>
  btoa(encodeURIComponent(JSON.stringify(p)));

async function serve() {
  const kv = await Deno.openKv(":memory:");
  // port 0 → the OS picks a free one, so a test run never collides with a dev
  // server (or with a parallel run of itself)
  const { promise: listening, resolve } = Promise.withResolvers<number>();
  const server = Deno.serve(
    { port: 0, hostname: "127.0.0.1", onListen: (a) => resolve(a.port) },
    createHandler(kv, SITES),
  );
  const base = `http://127.0.0.1:${await listening}`;
  return {
    base,
    async close() {
      await server.shutdown();
      kv.close();
    },
  };
}

Deno.test("e2e: beacon → KV → /stats, and every served asset resolves", async () => {
  const { base, close } = await serve();
  try {
    const root = await fetch(base + "/");
    assertEquals(await root.text(), "ok");

    // assets: served from disk, so this fails loudly if one stops being a flat
    // sibling of main.ts (the Deploy bundling invariant)
    for (
      const [path, type] of [
        ["/s.js", "text/javascript"],
        ["/vendor/uPlot.iife.min.js", "text/javascript"],
        ["/vendor/uPlot.min.css", "text/css"],
      ]
    ) {
      const res = await fetch(base + path);
      assertEquals(res.status, 200, path);
      assertStringIncludes(res.headers.get("content-type") ?? "", type);
      await res.body?.cancel();
    }

    const dash = await fetch(base + "/dashboard");
    assertEquals(dash.status, 200);
    assertStringIncludes(await dash.text(), 'id="analytics"');

    // a real browser hit: pageview + a download event
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Chrome/126.0";
    for (
      const v of [
        encode({
          p: "/docs/intro",
          r: "duckduckgo.com",
          l: "en-US",
          u: "1",
          s: "1",
        }),
        encode({ ev: "download", t: "release.zip" }),
      ]
    ) {
      const res = await fetch(`${base}/e?v=${encodeURIComponent(v)}`, {
        headers: { "user-agent": ua },
      });
      assertEquals(res.headers.get("content-type"), "image/gif");
      await res.body?.cancel();
    }

    const anon = await fetch(base + "/stats");
    assertEquals(anon.status, 401);
    await anon.body?.cancel();

    const day = new Date().toISOString().slice(0, 10);
    const res = await fetch(
      `${base}/stats?series=1&from=${day}&to=${day}`,
      { headers: { authorization: "Bearer e2etoken" } },
    );
    const stats = await res.json();
    assertEquals(stats.site, "demo");
    // [day, pv, uv, sessions, bot] — the event hit must not inflate pv
    assertEquals(stats.series, [[day, 1, 1, 1, 0]]);
    assertEquals(stats.path["/docs/intro"], 1);
    assertEquals(stats.ref_group.search, 1);
    assertEquals(stats.event.download, 1);
  } finally {
    await close();
  }
});
