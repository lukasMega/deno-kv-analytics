// KV read helpers, split out of main.ts to keep that file under the line cap.
// Owns every counter *read* path: per-day stats, the badge's windowed and
// all-time pageview counts, and the `BADGE_SITES` opt-in set.

// Sum a key prefix into { dim: { value: count } }.
//
// `len` is the exact key length this layout produces, and it is load-bearing:
// a site id is allowed to look like a date (`2026-08-25` matches the id regex),
// so the legacy prefix ["c", day] would otherwise also match the 5-segment keys
// of a same-named site. Rows of the wrong length are skipped, not merged.
async function readPrefix(
  kv: Deno.Kv,
  prefix: Deno.KvKey,
  len: number,
  out: Record<string, Record<string, number>> = {},
) {
  // .sum() stores Deno.KvU64 (bigint wrapper) — count is at .value.value
  for await (const row of kv.list<Deno.KvU64>({ prefix })) {
    if (row.key.length !== len) continue;
    const dim = row.key[len - 2] as string;
    const value = row.key[len - 1] as string;
    (out[dim] ??= {})[value] = (out[dim][value] ?? 0) + Number(row.value.value);
  }
  return out;
}

/**
 * Read one site's counters for one day.
 *
 * `LEGACY_SITE` is the migration bridge: while `migrate.ts` is rekeying the
 * pre-multi-site data (`["c", day, …]` → `["c", site, day, …]`), that site's
 * rows exist in both layouts, so both are read and **summed** — migrate copies
 * and deletes in one atomic tx per key, so a key is never counted twice. Unset
 * the env var (and delete this branch) once the migration is verified done.
 */
export async function readStats(kv: Deno.Kv, site: string, day: string) {
  const out = await readPrefix(kv, ["c", site, day], 5);
  if (Deno.env.get("LEGACY_SITE") === site) {
    await readPrefix(kv, ["c", day], 4, out);
  }
  return out;
}

/**
 * Sum the `pv` counter over the last `days` days (today inclusive).
 *
 * Point reads, not `readStats`: the badge needs one number, and a per-day
 * `kv.list` would walk every dim of every day (hundreds of keys) to find it.
 * `getMany` takes at most 10 keys per call, hence the chunking — 30 days is 3
 * round trips.
 */
export async function readPvRange(
  kv: Deno.Kv,
  site: string,
  days: number,
  now = new Date(),
): Promise<number> {
  const keys: Deno.KvKey[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(["c", site, d.toISOString().slice(0, 10), "pv", "_"]);
  }
  let total = 0;
  for (let i = 0; i < keys.length; i += 10) {
    const rows = await kv.getMany<Deno.KvU64[]>(keys.slice(i, i + 10));
    for (const row of rows) if (row.value) total += Number(row.value.value);
  }
  return total;
}

/**
 * The all-time `pv` counter for a site.
 *
 * Deliberately **not** under `["c", site, day, …]`: `prune` deletes day
 * counters past `RETENTION_DAYS`, so a "total" summed from them silently starts
 * shrinking once a site is older than that. Its own prefix survives prune, is
 * one point read instead of 400, and stays out of `readStats`/`/stats` (which
 * are per-day by definition).
 */
export const totalKey = (site: string): Deno.KvKey => ["t", site, "pv"];

/** All-time pageviews for a site. Zero until the site opts into `BADGE_SITES`. */
export async function readPvTotal(kv: Deno.Kv, site: string): Promise<number> {
  const row = await kv.get<Deno.KvU64>(totalKey(site));
  return row.value ? Number(row.value.value) : 0;
}

/**
 * Sites allowed a public badge. Unset → nobody (never "all sites").
 *
 * Also gates the all-time counter write: it costs a write unit on every
 * pageview, so only sites that can actually display it should pay for it.
 */
export function badgeSites(): Set<string> {
  return new Set(
    (Deno.env.get("BADGE_SITES") ?? "")
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
}
