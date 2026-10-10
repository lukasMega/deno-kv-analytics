import type { CountMap, SeriesRow, Site, Stats } from "./types.ts";

function countMap(value: unknown): CountMap | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const out: CountMap = {};
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === "number") out[key] = count;
  }
  return out;
}

export function parseStats(value: unknown): Stats {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid stats response");
  }
  const raw = value as Record<string, unknown>;
  const stats: Stats = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (key === "latest") {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        stats.latest = Object.fromEntries(
          Object.entries(entry).filter(([, values]) =>
            Array.isArray(values) &&
            values.every((value) => typeof value === "string")
          ),
        );
      }
      continue;
    }
    if (key === "series") continue;
    const counts = countMap(entry);
    if (counts) stats[key] = counts;
    else if (key === "site" && typeof entry === "string") stats.site = entry;
  }
  if (raw.series !== undefined) {
    if (!Array.isArray(raw.series)) throw new Error("invalid series response");
    stats.series = raw.series.map((row): SeriesRow => {
      if (
        !Array.isArray(row) || row.length !== 6 || typeof row[0] !== "string" ||
        row.slice(1).some((item) => typeof item !== "number")
      ) throw new Error("invalid series row");
      return row as unknown as SeriesRow;
    });
  }
  return stats;
}

export function parseSites(value: unknown): Site[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return typeof row.id === "string"
      ? [{
        id: row.id,
        host: typeof row.host === "string" ? row.host : undefined,
      }]
      : [];
  });
}
