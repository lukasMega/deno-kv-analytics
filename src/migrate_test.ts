import { assertEquals } from "@std/assert";
import { backfillTotal } from "./migrate.ts";
import { readPvTotal, totalKey } from "./reads.ts";

const day = (b: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - b);
  return d.toISOString().slice(0, 10);
};

Deno.test("backfill seeds, is idempotent, and never decrements", async () => {
  const kv = await Deno.openKv(":memory:");
  await kv.atomic()
    .sum(["c", "s", day(0), "pv", "_"], 12n)
    .sum(["c", "s", day(9), "pv", "_"], 9n)
    .commit();

  // dry run writes nothing
  assertEquals((await backfillTotal(kv, "s", 30, { dryRun: true })).delta, 21);
  assertEquals(await readPvTotal(kv, "s"), 0);

  assertEquals((await backfillTotal(kv, "s", 30)).delta, 21);
  assertEquals(await readPvTotal(kv, "s"), 21);

  // rerun: no double count
  assertEquals((await backfillTotal(kv, "s", 30)).delta, 0);
  assertEquals(await readPvTotal(kv, "s"), 21);

  // live traffic during/after: counter ahead of window -> never decremented
  await kv.atomic().sum(totalKey("s"), 5n).commit();
  assertEquals((await backfillTotal(kv, "s", 30)).delta, 0);
  assertEquals(await readPvTotal(kv, "s"), 26);
  kv.close();
});
