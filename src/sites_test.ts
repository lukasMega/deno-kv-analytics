// Multi-tenancy: site resolution, the tenancy boundary between two sites, the
// per-site prune, and the one-shot legacy migration.
//
// The tenancy tests matter more than they look: every one of them fails silently
// in production if it regresses — counts land under the wrong prefix, or a token
// reads a neighbour's data, and nothing throws.
import { assertEquals, assertThrows } from "@std/assert";
import { createHandler, prune, readStats } from "./main.ts";
import { hostIndex, loadSites, resolveSite, tokenFor } from "./sites.ts";
import { migrate } from "./migrate.ts";

// Shared with main_test.ts — `deno test` runs both files in one process, so the
// admin token must agree across them.
Deno.env.set("STATS_TOKEN", "testtoken");

const env = (v: string | undefined) => ({ get: () => v });
const encode = (p: Record<string, string>) =>
  btoa(encodeURIComponent(JSON.stringify(p)));

const TWO = loadSites(env("a:a.example,b:b.example"));

const kvWith = (sites = TWO) =>
  Deno.openKv(":memory:").then((kv) => ({ kv, h: createHandler(kv, sites) }));

const hit = (host: string, qs = "") =>
  new Request(
    `http://${host}/e?${qs}&v=${encodeURIComponent(encode({ p: "/" }))}`,
    {
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0) Firefox/126.0" },
    },
  );

const stats = (host: string, qs: string, token: string) =>
  new Request(`http://${host}/stats?${qs}`, {
    headers: { authorization: `Bearer ${token}` },
  });

Deno.test("loadSites parses id:host pairs and bare ids", () => {
  const s = loadSites(
    env("deckbridge:stats.deckbridge.app, scratch ,acme:WWW.Acme.Dev"),
  );
  assertEquals([...s.keys()], ["deckbridge", "scratch", "acme"]);
  assertEquals(s.get("deckbridge")!.host, "stats.deckbridge.app");
  assertEquals(s.get("scratch")!.host, null); // bare id → selectable only via ?s=
  assertEquals(s.get("acme")!.host, "acme.dev"); // lowercased, www stripped
  assertEquals(loadSites(env(undefined)).size, 0);
});

Deno.test("loadSites rejects a malformed config at boot, not per request", () => {
  assertThrows(() => loadSites(env("Bad Id:x.dev")));
  assertThrows(() => loadSites(env("-leading-dash")));
  assertThrows(() => loadSites(env("dup:a.dev,dup:b.dev")));
});

Deno.test("resolveSite: host beats the client param", () => {
  const idx = hostIndex(TWO);
  // A page on a.example cannot claim to be site b by passing ?s= — the Host is
  // not settable by page JS, the query param is.
  assertEquals(resolveSite(new URL("http://a.example/e?s=b"), TWO, idx), "a");
  assertEquals(resolveSite(new URL("http://www.A.example/e"), TWO, idx), "a");
});

Deno.test("resolveSite: param is the fallback for an unmapped host", () => {
  const idx = hostIndex(TWO);
  assertEquals(
    resolveSite(new URL("http://app.deno.net/e?s=b"), TWO, idx),
    "b",
  );
  assertEquals(
    resolveSite(new URL("http://app.deno.net/stats?site=a"), TWO, idx),
    "a",
  );
  // not allowlisted → null, never an auto-created prefix
  assertEquals(
    resolveSite(new URL("http://app.deno.net/e?s=nope"), TWO, idx),
    null,
  );
  assertEquals(resolveSite(new URL("http://app.deno.net/e"), TWO, idx), null);
});

Deno.test("resolveSite: a lone configured site needs no host or param", () => {
  const one = loadSites(env("solo"));
  assertEquals(resolveSite(new URL("http://anything/e"), one), "solo");
});

Deno.test("tokenFor maps the id to an env var name", () => {
  const e = {
    get: (k: string) => (k === "STATS_TOKEN_MY_SITE" ? "t" : undefined),
  };
  assertEquals(tokenFor("my-site", e), "t");
  assertEquals(tokenFor("other", e), ""); // unset → "", never "matches anything"
});

Deno.test("counts do not bleed between sites", async () => {
  const { kv, h } = await kvWith();
  await h(hit("a.example"));
  await h(hit("a.example"));
  await h(hit("b.example"));

  const a = await (await h(stats("a.example", "", "testtoken"))).json();
  const b = await (await h(stats("b.example", "", "testtoken"))).json();
  assertEquals(a.site, "a");
  assertEquals(a.pv._, 2);
  assertEquals(b.pv._, 1);
  kv.close();
});

Deno.test("an unresolved site writes nothing but still returns the gif", async () => {
  const { kv, h } = await kvWith();
  const res = await h(hit("stranger.example"));
  // same response as a real hit: a prober learns nothing, and a misconfigured
  // consumer degrades to a no-op instead of a broken image on every page
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "image/gif");

  let rows = 0;
  for await (const _ of kv.list({ prefix: ["c"] })) rows++;
  assertEquals(rows, 0);
  kv.close();
});

Deno.test("a per-site token reads only its own site", async () => {
  Deno.env.set("STATS_TOKEN_A", "atoken");
  const { kv, h } = await kvWith();
  await h(hit("a.example"));
  await h(hit("b.example"));

  assertEquals((await h(stats("a.example", "", "atoken"))).status, 200);
  // the whole tenancy boundary: site A's token must not read site B
  assertEquals((await h(stats("b.example", "", "atoken"))).status, 401);
  // the admin token reads both
  assertEquals((await h(stats("b.example", "", "testtoken"))).status, 200);
  Deno.env.delete("STATS_TOKEN_A");
  kv.close();
});

Deno.test("/stats 401s when no site resolves", async () => {
  const { kv, h } = await kvWith();
  assertEquals(
    (await h(stats("stranger.example", "", "testtoken"))).status,
    401,
  );
  kv.close();
});

Deno.test("/sites is admin-only", async () => {
  Deno.env.set("STATS_TOKEN_A", "atoken");
  const { kv, h } = await kvWith();
  assertEquals((await h(new Request("http://a.example/sites"))).status, 401);
  assertEquals(
    (await h(
      new Request("http://a.example/sites", {
        headers: { authorization: "Bearer atoken" },
      }),
    )).status,
    401,
  );
  const res = await h(
    new Request("http://a.example/sites", {
      headers: { authorization: "Bearer testtoken" },
    }),
  );
  assertEquals(res.status, 200);
  assertEquals(await res.json(), [
    { id: "a", host: "a.example" },
    { id: "b", host: "b.example" },
  ]);
  Deno.env.delete("STATS_TOKEN_A");
  kv.close();
});

Deno.test("prune walks every site, not just the first", async () => {
  const { kv } = await kvWith();
  const old = "2020-01-01";
  const today = new Date().toISOString().slice(0, 10);
  for (const site of ["a", "b"]) {
    await kv.atomic()
      .sum(["c", site, old, "pv", "_"], 1n)
      .sum(["c", site, today, "pv", "_"], 1n)
      .commit();
  }

  await prune(kv, ["a", "b"]);

  // The early `break` is only valid inside one site's prefix. A single scan over
  // ["c"] with that break stops at site a's cutoff and never prunes site b.
  for (const site of ["a", "b"]) {
    assertEquals(await readStats(kv, site, old), {});
    assertEquals((await readStats(kv, site, today)).pv._, 1);
  }
  kv.close();
});

Deno.test("migrate rekeys legacy rows and merges with concurrent writes", async () => {
  const { kv } = await kvWith();
  // pre-multi-site shape
  await kv.atomic()
    .sum(["c", "2026-08-01", "pv", "_"], 5n)
    .sum(["c", "2026-08-01", "path", "/"], 5n)
    .commit();
  // a hit that arrived *during* the migration window already uses the new shape
  await kv.atomic().sum(["c", "a", "2026-08-01", "pv", "_"], 2n).commit();

  assertEquals(await migrate(kv, "a", { dryRun: true }), 2); // counted, not moved
  assertEquals(await migrate(kv, "a"), 2);

  const out = await readStats(kv, "a", "2026-08-01");
  assertEquals(out.pv._, 7); // 5 migrated + 2 concurrent — summed, not overwritten
  assertEquals(out.path["/"], 5);

  // idempotent: a rerun finds nothing left and does not double-count
  assertEquals(await migrate(kv, "a"), 0);
  assertEquals((await readStats(kv, "a", "2026-08-01")).pv._, 7);
  kv.close();
});

Deno.test("LEGACY_SITE sums both layouts while the migration runs", async () => {
  const { kv } = await kvWith();
  await kv.atomic().sum(["c", "2026-08-02", "pv", "_"], 3n).commit();
  await kv.atomic().sum(["c", "a", "2026-08-02", "pv", "_"], 4n).commit();

  assertEquals((await readStats(kv, "a", "2026-08-02")).pv._, 4); // off by default
  Deno.env.set("LEGACY_SITE", "a");
  assertEquals((await readStats(kv, "a", "2026-08-02")).pv._, 7);
  Deno.env.delete("LEGACY_SITE");
  kv.close();
});

Deno.test("a date-shaped site id cannot collide with the legacy prefix", async () => {
  // `2026-08-03` is a legal site id, so the legacy prefix ["c", day] would also
  // match that site's 5-segment keys. readStats filters on key length.
  const sites = loadSites(env("2026-08-03:d.example"));
  const kv = await Deno.openKv(":memory:");
  await kv.atomic().sum(["c", "2026-08-03", "2026-08-03", "pv", "_"], 1n)
    .commit();
  Deno.env.set("LEGACY_SITE", "2026-08-03");
  const out = await readStats(kv, "2026-08-03", "2026-08-03");
  assertEquals(out.pv._, 1); // not 2 — the 5-segment row is not also read as legacy
  Deno.env.delete("LEGACY_SITE");
  assertEquals(sites.size, 1);
  kv.close();
});
