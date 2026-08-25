// Operator tooling that needs raw KV access rather than an HTTP route.
//
//   deno task admin -- list                        # sites that actually hold data
//   deno task admin -- usage --site acme           # keys + write-unit estimate
//   deno task admin -- delete --site acme          # erase one site, permanently
//
// `delete` exists because a consumer asking for their data to be removed should
// be a one-liner, not an improvisation: the site is a KV key prefix, so the whole
// tenancy is `kv.list({ prefix: ["c", site] })`.
import { parseArgs } from "@std/cli/parse-args";

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
  return {
    keys,
    days: days.size,
    first: sorted[0] ?? null,
    last: sorted.at(-1) ?? null,
  };
}

/** Irreversible: deletes every counter belonging to one site. */
export async function deleteSite(kv: Deno.Kv, site: string): Promise<number> {
  let n = 0;
  let batch: Promise<unknown>[] = [];
  for await (const row of kv.list({ prefix: ["c", site] })) {
    batch.push(kv.delete(row.key));
    n++;
    if (batch.length >= BATCH) {
      await Promise.all(batch);
      batch = [];
    }
  }
  await Promise.all(batch);
  return n;
}

if (import.meta.main) {
  const args = parseArgs(Deno.args, { string: ["site"], boolean: ["yes"] });
  const cmd = args._[0];
  const kv = await Deno.openKv();

  if (cmd === "list") {
    console.log((await listSites(kv)).join("\n") || "(no data)");
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
      "usage: deno task admin -- <list|usage|delete> [--site <id>] [--yes]",
    );
    Deno.exit(2);
  }
  kv.close();
}
