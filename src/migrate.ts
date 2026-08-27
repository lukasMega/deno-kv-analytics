// One-shot rekey of pre-multi-site data:
//
//   ["c", day, dim, value]           (4 segments, single-tenant)
//   → ["c", site, day, dim, value]   (5 segments)
//
// Usage (against the deployed KV, or a local one):
//
//   deno task migrate -- --site deckbridge --dry-run
//   deno task migrate -- --site deckbridge
//
// Set LEGACY_SITE=<site> on the running server **before** migrating: `/stats`
// then reads both layouts and sums them, so the dashboard stays correct while
// this runs. Unset it once `--dry-run` reports 0 remaining legacy keys.
import { parseArgs } from "@std/cli/parse-args";
import { openKv, taskArgs } from "./kv.ts";

const BATCH = 100;

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
    string: ["site", "db"],
    boolean: ["dry-run"],
  });
  const site = args.site;
  if (!site) {
    console.error(
      "usage: deno task migrate -- --site <id> [--db <uuid>] [--dry-run]",
    );
    Deno.exit(2);
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
