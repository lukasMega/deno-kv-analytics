import { assertEquals } from "@std/assert";
import { parseArgs } from "@std/cli/parse-args";
import { taskArgs } from "./kv.ts";
import { deleteSite, listSites, sizeOf, usage } from "./admin.ts";

// The regression this exists for: `deno task admin -- size --db X` forwards a
// literal `--`, parseArgs read it as the end-of-flags terminator, and every
// flag landed in `_` unparsed. `--db` was ignored, so the command reported the
// local database while looking like it had queried the deployed one.
Deno.test("the deno-task `--` separator does not swallow flags", () => {
  const parse = (argv: string[]) =>
    parseArgs(taskArgs(argv), { string: ["site", "db"], boolean: ["yes"] });

  const withSep = parse(["--", "size", "--db", "abc"]);
  assertEquals(withSep._[0], "size");
  assertEquals(withSep.db, "abc");

  // Invoking the script directly, without `deno task`, must still work.
  assertEquals(parse(["usage", "--site", "acme"]).site, "acme");
});

Deno.test("sizeOf totals per site and buckets legacy rows apart", async () => {
  const kv = await Deno.openKv(":memory:");
  await kv.atomic()
    .sum(["c", "acme", "2026-08-27", "pv", "/"], 1n)
    .sum(["c", "acme", "2026-08-27", "ref_group", "direct"], 1n)
    .sum(["c", "2026-08-18", "bot", "ua"], 1n) // 4-segment, pre-tenancy
    .commit();

  const { keys, bytes, sites } = await sizeOf(kv);
  assertEquals(keys, 3);
  assertEquals(sites["acme"].keys, 2);
  assertEquals(sites["(legacy)"].keys, 1);
  assertEquals(bytes, sites["acme"].bytes + sites["(legacy)"].bytes);
  kv.close();
});

Deno.test("latest metadata participates in site accounting and erasure", async () => {
  const kv = await Deno.openKv(":memory:");
  await kv.set(["latest", "acme", "2026-08-27", "country"], ["SK"]);
  await kv.set(["latest", "other", "2026-08-27", "country"], ["DE"]);
  assertEquals(await listSites(kv), ["acme", "other"]);
  const u = await usage(kv, "acme");
  assertEquals([u.keys, u.latest, u.days], [0, 1, 0]);
  assertEquals((await sizeOf(kv)).sites.acme.keys, 1);
  assertEquals(await deleteSite(kv, "acme"), 1);
  assertEquals(await listSites(kv), ["other"]);
  kv.close();
});
