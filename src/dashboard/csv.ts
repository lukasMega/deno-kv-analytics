import type { CountMap, Stats } from "./types.ts";

export const CSV_DIMS = [
  "path",
  "host",
  "ref_group",
  "ref",
  "browser",
  "os",
  "device",
  "country",
  "lang",
  "tz",
  "hour",
  "viewport",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "event",
  "event_target",
  "hi",
  "app_os",
  "app_os_version",
  "app_tz_offset",
  "app_tz",
  "app_version",
  "app_device",
  "bot",
  "bot_kind",
  "app",
  "dowhour",
];

export function csvCell(value: unknown): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csv(data: Stats): string {
  const rows: unknown[][] = [["dim", "value", "count"]];
  for (const dimension of CSV_DIMS) {
    const counts = data[dimension] as CountMap | undefined;
    for (const [value, count] of Object.entries(counts ?? {})) {
      rows.push([dimension, value, count]);
    }
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
