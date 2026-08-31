// Operator tooling that needs raw KV access rather than an HTTP route.
//
//   deno task admin -- list                        # sites that actually hold data
//   deno task admin -- usage --site acme           # keys + write-unit estimate
//   deno task admin -- size                        # approx stored bytes, per site
//   deno task admin -- delete --site acme          # erase one site, permanently
//
// Any command takes `--db <uuid>` to run against the deployed database instead
// of the local one (needs DENO_KV_ACCESS_TOKEN); without it you are looking at
// whatever `deno task dev` wrote on this machine.
//
// `delete` exists because a consumer asking for their data to be removed should
// be a one-liner, not an improvisation: the site is a KV key prefix, so the whole
// tenancy is `kv.list({ prefix: ["c", site] })`.
import { parseArgs } from "@std/cli/parse-args";
import { openKv, taskArgs } from "./kv.ts";

const BATCH = 100;

/** Site ids that currently have at least one row (independent of the allowlist). */
export async function listSites(kv: Deno.Kv): Promise<string[]> {
  const seen = new Set<string>();
  for await (const row of kv.list({ prefix: ["c"] })) {
    if (row.key.length === 5) seen.add(row.key[1] as string);
  }
  return [...seen].sort();
}

/** Row count and day range for one site. */
export async function usage(kv: Deno.Kv, site: string) {
  let keys = 0;
  const days = new Set<string>();
  for await (const row of kv.list({ prefix: ["c", site] })) {
    keys++;
    days.add(row.key[2] as string);
  }
  const sorted = [...days].sort();
  // The all-time counter lives outside the day-keyed prefix (it must survive
  // prune), so it is read separately — see main.ts `totalKey`.
  const total = await kv.get<Deno.KvU64>(["t", site, "pv"]);
  return {
    keys,
    days: days.size,
    first: sorted[0] ?? null,
    last: sorted.at(-1) ?? null,
    allTimePv: total.value ? Number(total.value.value) : 0,
  };
}

/**
 * Approximate stored bytes, per site and in total.
 *
 * KV exposes no size API — the billed number lives only in the Deploy console —
 * so this walks the rows and estimates. Each key segment costs its own length
 * plus a type tag and terminator; the value is always a bigint counter. Index
 * and replication overhead are invisible from userland, so the real figure is
 * higher. Good enough to answer "are we near the free tier", not for billing.
 *
 * Costs one read unit per 4KiB scanned, so this is not a cron-friendly call.
 */
export async function sizeOf(kv: Deno.Kv) {
  const sites = new Map<string, { keys: number; bytes: number }>();
  let keys = 0, bytes = 0;
  // `["t"]` too: the all-time counters are one row per site, negligible in
  // bytes, but leaving them out makes this disagree with `deleteSite`'s count.
  for await (const row of kv.list({ prefix: ["c"] })) {
    const n = row.key.reduce<number>((t, s) => t + String(s).length + 2, 0) +
      10;
    keys++;
    bytes += n;
    // 4-segment rows are the pre-tenancy layout; bucket them so a legacy
    // database still totals correctly instead of silently under-reporting.
    const site = row.key.length === 5 ? row.key[1] as string : "(legacy)";
    const acc = sites.get(site) ?? { keys: 0, bytes: 0 };
    acc.keys++;
    acc.bytes += n;
    sites.set(site, acc);
  }
  for await (const row of kv.list({ prefix: ["t"] })) {
    const n = row.key.reduce<number>((t, s) => t + String(s).length + 2, 0) +
      10;
    keys++;
    bytes += n;
    const acc = sites.get(row.key[1] as string) ?? { keys: 0, bytes: 0 };
    acc.keys++;
    acc.bytes += n;
    sites.set(row.key[1] as string, acc);
  }
  return { keys, bytes, sites: Object.fromEntries([...sites].sort()) };
}

/**
 * Irreversible: deletes every counter belonging to one site.
 *
 * Both prefixes: the day counters under `["c", site]` **and** the all-time
 * counter under `["t", site]`. Missing the second one would leave a live
 * pageview total behind after an erasure request, which is the one thing this
 * command exists to prevent.
 */
export async function deleteSite(kv: Deno.Kv, site: string): Promise<number> {
  let n = 0;
  let batch: Promise<unknown>[] = [];
  for (const prefix of [["c", site], ["t", site]]) {
    for await (const row of kv.list({ prefix })) {
      batch.push(kv.delete(row.key));
      n++;
      if (batch.length >= BATCH) {
        await Promise.all(batch);
        batch = [];
      }
    }
  }
  await Promise.all(batch);
  return n;
}

if (import.meta.main) {
  const args = parseArgs(taskArgs(), {
    string: ["site", "db"],
    boolean: ["yes"],
  });
  const cmd = args._[0];
  const kv = await openKv(args.db);

  if (cmd === "list") {
    console.log((await listSites(kv)).join("\n") || "(no data)");
  } else if (cmd === "size") {
    const { keys, bytes, sites } = await sizeOf(kv);
    console.log(`${keys} keys, ~${(bytes / 1024).toFixed(1)} KiB (estimate)`);
    for (const [site, s] of Object.entries(sites)) {
      console.log(
        `  ${site}: ${s.keys} keys, ~${(s.bytes / 1024).toFixed(1)} KiB`,
      );
    }
  } else if (cmd === "usage") {
    if (!args.site) throw new Error("--site is required");
    console.log(await usage(kv, args.site));
  } else if (cmd === "delete") {
    if (!args.site) throw new Error("--site is required");
    const { keys } = await usage(kv, args.site);
    // Deleting a tenancy is unrecoverable — KV has no undo and no snapshot here.
    if (!args.yes) {
      console.error(
        `refusing: this permanently deletes ${keys} keys for site "${args.site}".\n` +
          `re-run with --yes if that is what you want.`,
      );
      Deno.exit(1);
    }
    console.log(
      `deleted ${await deleteSite(kv, args.site)} keys for site "${args.site}"`,
    );
  } else {
    console.error(
      "usage: deno task admin -- <list|size|usage|delete> [--site <id>] [--db <uuid>] [--yes]",
    );
    Deno.exit(2);
  }
  kv.close();
}
