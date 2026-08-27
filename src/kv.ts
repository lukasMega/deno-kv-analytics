// Which KV database a process opens.
//
// `Deno.openKv()` with no argument does not mean "the project database" locally:
// the sqlite file is keyed to the calling script's origin, so `src/main.ts`,
// `src/admin.ts` and `src/migrate.ts` each silently got their _own_ database.
// `admin list` then reported nothing while `deno task dev` was happily writing.
// On Deploy the bare call is correct — it binds the project database — so the
// no-env path must stay exactly that.
//
//   KV_PATH=./local.kv   one shared file for every local task (set in deno.json)
//   --db <uuid>          the deployed database, via DENO_KV_ACCESS_TOKEN
/**
 * `Deno.args` with the `deno task` separator removed.
 *
 * `deno task admin -- size --db X` forwards a literal `--` as argv[0], and
 * parseArgs treats that as the end-of-flags terminator: everything after it
 * lands in `_` and no flag is ever parsed. `--site`/`--yes`/`--db` all silently
 * did nothing. Strip it so the documented invocations work.
 */
export function taskArgs(argv: string[] = Deno.args): string[] {
  return argv[0] === "--" ? argv.slice(1) : argv;
}

export function openKv(dbId?: string): Promise<Deno.Kv> {
  // v2 is the new Deploy (console.deno.com); Classic used the unversioned path.
  if (dbId) {
    return Deno.openKv(`https://api.deno.com/v2/databases/${dbId}/connect`);
  }
  return Deno.openKv(Deno.env.get("KV_PATH") || undefined);
}
