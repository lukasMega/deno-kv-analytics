// One-shot rekey of pre-multi-site data:
//
//   ["c", day, dim, value]           (4 segments, single-tenant)
//   → ["c", site, day, dim, value]   (5 segments)
//
// Usage (against the deployed KV, or a local one):
//
//   deno task migrate -- --site demo --dry-run
//   deno task migrate -- --site demo
//
// Set LEGACY_SITE=<site> on the running server **before** migrating: `/stats`
// then reads both layouts and sums them, so the dashboard stays correct while
// this runs. Unset it once `--dry-run` reports 0 remaining legacy keys.
import { parseArgs } from "@std/cli/parse-args";
import { openKv, taskArgs } from "./kv.ts";
import { readPvRange, readPvTotal, totalKey } from "./reads.ts";

const BATCH = 100;

/**
 * Seed a site's all-time counter from the day counters already in KV.
 *
 * The counter is forward-only — it starts at 0 when a site is added to
 * `BADGE_SITES` — so a site with existing history shows `0` on
 * `/badge?days=all` until this runs.
 *
 * Writes the **difference**, not the total, with `.sum()`. That makes it:
 *   - idempotent — a rerun computes a delta of 0 and writes nothing;
 *   - safe against live traffic — pageviews landing mid-backfill already
 *     incremented the counter, so they are subtracted out rather than lost.
 *
 * It never decrements: if the counter is already above the window sum (normal
 * once the site has been collecting for a while), this is a no-op.
 */
export async function backfillTotal(
  kv: Deno.Kv,
  site: string,
  days: number,
  opts: { dryRun?: boolean; now?: Date } = {},
): Promise<{ window: number; current: number; delta: number }> {
  const [window, current] = await Promise.all([
    readPvRange(kv, site, days, opts.now),
    readPvTotal(kv, site),
  ]);
  const delta = Math.max(0, window - current);
  if (delta > 0 && !opts.dryRun) {
    await kv.atomic().sum(totalKey(site), BigInt(delta)).commit();
  }
  return { window, current, delta };
}

export async function migrate(
  kv: Deno.Kv,
  site: string,
  opts: { dryRun?: boolean; onProgress?: (n: number) => void } = {},
): Promise<number> {
  let moved = 0;
  let batch: Promise<unknown>[] = [];

  for await (const row of kv.list<Deno.KvU64>({ prefix: ["c"] })) {
    if (row.key.length !== 4) continue; // already 5 segments → migrated
    const [, day, dim, value] = row.key as [string, string, string, string];
    moved++;
    if (opts.dryRun) continue;

    // Copy and delete in ONE atomic tx per key: crash-safe (a key is either in
    // the old place or the new one, never neither) and idempotent on rerun (a
    // rerun simply finds fewer legacy keys).
    //
    // `.sum()`, not `.set()`: hits arriving during the migration already land on
    // the new key, so the migrated count must be *added* to whatever is there,
    // not overwrite it.
    batch.push(
      kv.atomic()
        .sum(["c", site, day, dim, value], row.value.value)
        .delete(row.key)
        .commit(),
    );
    if (batch.length >= BATCH) {
      await Promise.all(batch);
      batch = [];
      opts.onProgress?.(moved);
    }
  }
  await Promise.all(batch);
  return moved;
}

if (import.meta.main) {
  const args = parseArgs(taskArgs(), {
    string: ["site", "db", "days"],
    boolean: ["dry-run", "backfill-total"],
    default: { days: "30" },
  });
  const site = args.site;
  if (!site) {
    console.error(
      "usage: deno task migrate -- --site <id> [--db <uuid>] [--dry-run]\n" +
        "       deno task migrate -- --backfill-total --site <id> [--days 30]",
    );
    Deno.exit(2);
  }

  if (args["backfill-total"]) {
    const kv = await openKv(args.db);
    const days = Number(args.days);
    // Reported next to the requested window so an operator can see whether the
    // site has history older than it — the badge's own cap is 400 days.
    const allTime = await readPvRange(kv, site, 400);
    const { window, current, delta } = await backfillTotal(kv, site, days, {
      dryRun: args["dry-run"],
    });
    console.log(
      `site "${site}": ${window} pv over ${days}d (${allTime} over 400d), ` +
        `all-time counter was ${current}`,
    );
    console.log(
      args["dry-run"]
        ? `would add ${delta} (dry run, nothing written)`
        : delta > 0
        ? `added ${delta} → all-time counter is now ${current + delta}`
        : "nothing to do — counter already at or above the window sum",
    );
    kv.close();
    Deno.exit(0);
  }

  const kv = await openKv(args.db);
  const n = await migrate(kv, site, {
    dryRun: args["dry-run"],
    onProgress: (n) => console.log(`… ${n} keys`),
  });
  console.log(
    args["dry-run"]
      ? `${n} legacy keys would move to site "${site}" (dry run, nothing written)`
      : `${n} keys moved to site "${site}"`,
  );
  kv.close();
}
