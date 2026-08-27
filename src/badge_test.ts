// The badge is the only unauthenticated read in the app, so most of this file
// is about what it refuses: sites that did not opt in, and params that could
// smuggle markup into the SVG.
// Run: deno task test
import { assertEquals, assertMatch, assertStringIncludes } from "@std/assert";
import { badgeSvg, formatCount, safeColor, safeLabel } from "./badge.ts";
import { createHandler, readPvRange } from "./main.ts";
import { loadSites } from "./sites.ts";

// two sites, only one of which opts into a badge
const SITES = loadSites({ get: () => "pub:pub.example,priv:priv.example" });
Deno.env.set("BADGE_SITES", "pub");

async function fixture() {
  const kv = await Deno.openKv(":memory:");
  return { kv, h: createHandler(kv, SITES) };
}

const today = () => new Date().toISOString().slice(0, 10);

Deno.test("badge counts pv over the window and renders it", async () => {
  const { kv, h } = await fixture();
  await kv.atomic().sum(["c", "pub", today(), "pv", "_"], 7n).commit();

  const res = await h(new Request("http://pub.example/badge"));
  assertEquals(res.status, 200);
  assertEquals(
    res.headers.get("content-type"),
    "image/svg+xml; charset=utf-8",
  );
  assertEquals(res.headers.get("cache-control"), "public, max-age=300");
  const svg = await res.text();
  assertStringIncludes(svg, ">7<");
  assertStringIncludes(svg, "views (30d)");
  kv.close();
});

Deno.test("badge sums only the requested window", async () => {
  const { kv } = await fixture();
  const day = (back: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - back);
    return d.toISOString().slice(0, 10);
  };
  await kv.atomic()
    .sum(["c", "pub", day(0), "pv", "_"], 2n)
    .sum(["c", "pub", day(5), "pv", "_"], 3n)
    .sum(["c", "pub", day(40), "pv", "_"], 100n)
    .commit();

  assertEquals(await readPvRange(kv, "pub", 1), 2);
  assertEquals(await readPvRange(kv, "pub", 30), 5); // day-40 excluded
  assertEquals(await readPvRange(kv, "pub", 60), 105);
  kv.close();
});

Deno.test("badge reads pv only — never another dim", async () => {
  const { kv, h } = await fixture();
  await kv.atomic()
    .sum(["c", "pub", today(), "pv", "_"], 1n)
    .sum(["c", "pub", today(), "bot", "ua"], 500n)
    .sum(["c", "pub", today(), "path", "/secret"], 9n)
    .commit();

  const svg = await (await h(new Request("http://pub.example/badge"))).text();
  assertStringIncludes(svg, ">1<");
  assertEquals(svg.includes("/secret"), false);
  assertEquals(svg.includes("500"), false);
  kv.close();
});

Deno.test("a site that did not opt in 404s, like an unknown one", async () => {
  const { kv, h } = await fixture();
  await kv.atomic().sum(["c", "priv", today(), "pv", "_"], 5n).commit();

  // configured but not in BADGE_SITES, and a site that does not exist: the two
  // must be indistinguishable or the badge enumerates site ids. The unknown one
  // goes through `?site=` on an unmapped host — on a mapped host the Host wins
  // and the param is ignored (resolveSite's priority order).
  const a = await h(new Request("http://priv.example/badge"));
  const b = await h(new Request("http://shared.deno.net/badge?site=nope"));
  assertEquals(a.status, 404);
  assertEquals(b.status, 404);
  assertEquals(await a.text(), await b.text());
  kv.close();
});

Deno.test("BADGE_SITES unset means no badge at all", async () => {
  const { kv, h } = await fixture();
  Deno.env.delete("BADGE_SITES");
  const res = await h(new Request("http://pub.example/badge"));
  Deno.env.set("BADGE_SITES", "pub");
  assertEquals(res.status, 404);
  kv.close();
});

Deno.test("days param is clamped, never trusted", async () => {
  const { kv, h } = await fixture();
  const label = async (qs: string) => {
    const svg = await (await h(new Request(`http://pub.example/badge?${qs}`)))
      .text();
    return /views \((\d+)d\)/.exec(svg)?.[1];
  };
  assertEquals(await label("days=0"), "1");
  assertEquals(await label("days=-9"), "1");
  assertEquals(await label("days=99999"), "400"); // RETENTION_DAYS
  assertEquals(await label("days=abc"), "30"); // NaN → default
  kv.close();
});

Deno.test("label and color params cannot inject markup", async () => {
  const { kv, h } = await fixture();
  const res = await h(
    new Request(
      "http://pub.example/badge?label=" +
        encodeURIComponent('"><script>x</script>') +
        "&color=" + encodeURIComponent('red" onload="x'),
    ),
  );
  const svg = await res.text();
  assertEquals(svg.includes("<script"), false);
  assertEquals(svg.includes("onload"), false);
  kv.close();
});

Deno.test("formatCount compacts large numbers", () => {
  assertEquals(formatCount(0), "0");
  assertEquals(formatCount(999), "999");
  assertEquals(formatCount(1000), "1k");
  assertEquals(formatCount(1234), "1.2k");
  assertEquals(formatCount(12_345), "12k");
  assertEquals(formatCount(1_234_567), "1.2M");
});

Deno.test("safeLabel/safeColor fall back rather than pass junk through", () => {
  assertEquals(safeLabel(null, "views"), "views");
  assertEquals(safeLabel("<>", "views"), "views"); // strips to empty
  assertEquals(safeLabel('"><g fill=', "views"), "g fill"); // markup chars gone
  assertEquals(safeLabel("hits 30d", "views"), "hits 30d");
  assertEquals(safeLabel("x".repeat(50), "views").length, 24);
  assertEquals(safeColor("#ff0000"), "#ff0000");
  assertEquals(safeColor("f00"), "#f00");
  assertEquals(safeColor("javascript:x"), "#0b6bcb");
});

Deno.test("badgeSvg is well-formed and sized to its text", () => {
  const svg = badgeSvg("views", "1.2k");
  assertMatch(
    svg,
    /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+"/,
  );
  assertStringIncludes(svg, 'aria-label="views: 1.2k"');
  const wide = badgeSvg("views over the year", "1.2k");
  const w = (s: string) => Number(/width="(\d+)"/.exec(s)![1]);
  assertEquals(w(wide) > w(svg), true);
});
