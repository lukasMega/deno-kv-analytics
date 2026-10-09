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

Deno.test("e2e: survey sender contract, authenticated reads and connection rate bucket", async () => {
  const { base, close } = await serve();
  try {
    const payload = {
      sv: 1,
      v: "0.21.0",
      os: "macos",
      ov: "macos-26",
      dv: "mirabox-293s",
      a: { rating: "4", nps: "10", features: ["multi-deck"] },
      c: "Works well",
    };
    for (let i = 0; i < 3; i++) {
      const sent = await fetch(`${base}/s?s=demo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      assertEquals(sent.status, 204);
      await sent.arrayBuffer();
    }
    const limited = await fetch(`${base}/s?s=demo`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    assertEquals(limited.status, 429);
    await limited.text();
    const headers = { authorization: "Bearer e2etoken" };
    const summary =
      await (await fetch(`${base}/surveys?site=demo`, { headers })).json();
    assertEquals(summary.total, 3);
    assertEquals(summary.nps.score, 100);
    const exported =
      await (await fetch(`${base}/surveys/export?site=demo`, { headers }))
        .json();
    assertEquals(exported.responses.length, 3);
    assertEquals(exported.responses[0].c, "Works well");
    const unauthorized = await fetch(`${base}/surveys?site=demo`);
    assertEquals(unauthorized.status, 401);
    await unauthorized.text();
  } finally {
    await close();
  }
});

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
        // the dashboard/help UI is no longer one self-contained file, so each
        // piece it pulls in needs the same flat-sibling guarantee
        ["/dashboard.css", "text/css"],
        ["/dashboard.js", "text/javascript"],
        ["/da-common.js", "text/javascript"],
        ["/timezone-globe.js", "text/javascript"],
        ["/help.js", "text/javascript"],
      ]
    ) {
      const res = await fetch(base + path);
      assertEquals(res.status, 200, path);
      assertStringIncludes(res.headers.get("content-type") ?? "", type);
      await res.body?.cancel();
    }

    const dash = await fetch(base + "/dashboard");
    assertEquals(dash.status, 200);
    assertStringIncludes(await dash.text(), 'id="app"');

    const help = await fetch(base + "/help");
    assertEquals(help.status, 200);
    assertStringIncludes(await help.text(), 'id="step1"');

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
    // [day, pv, uv, sessions, bot, app] — the event hit must not inflate pv
    assertEquals(stats.series, [[day, 1, 1, 1, 0, 0]]);
    assertEquals(stats.path["/docs/intro"], 1);
    assertEquals(stats.ref_group.search, 1);
    assertEquals(stats.event.download, 1);
  } finally {
    await close();
  }
});
