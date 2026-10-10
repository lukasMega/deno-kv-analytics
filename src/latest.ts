// Last committed values per dimension/day. Old counters have no ordering data.
//
// Allowlist, not every dim: each row is one extra `set` write unit per ping, and
// "NEW value" only means something for slow-moving dims (a new country, browser,
// OS, campaign, app version/device). path/ref/hour/dowhour churn on every hit and
// bot/hi/event dims are not visitor attributes, so they would just burn budget.
// One row per dim, never merged: a single row would be a joint profile of the
// last ping and break "dims are counted independently". Rows written by one
// commit still share a versionstamp, which raw KV access can use to link the
// last-seen values of these dims for a day (accepted; see design.md).
export const LATEST_DIMS: ReadonlySet<string> = new Set([
  "country",
  "browser",
  "os",
  "utm_source",
  "app_os",
  "app_version",
  "app_device",
]);

export function withLatest(
  tx: Deno.AtomicOperation,
  site: string,
  day: string,
  dims: [string, string][],
): Deno.AtomicOperation {
  const values: Record<string, string[]> = {};
  for (const [dim, value] of dims) {
    if (LATEST_DIMS.has(dim)) (values[dim] ??= []).push(value);
  }
  for (const [dim, entries] of Object.entries(values)) {
    tx = tx.set(["latest", site, day, dim], [...new Set(entries)]);
  }
  return tx;
}

export async function readLatest(
  kv: Deno.Kv,
  site: string,
  from: string,
  to: string,
): Promise<Record<string, string[]>> {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  // toISOString() throws RangeError on an invalid date.
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return {};
  end.setUTCDate(end.getUTCDate() + 1);
  const values: Record<string, string[]> = {};
  for await (
    const row of kv.list<string[]>({
      start: ["latest", site, from],
      end: ["latest", site, end.toISOString().slice(0, 10)],
    })
  ) {
    values[row.key[3] as string] = row.value;
  }
  return values;
}
