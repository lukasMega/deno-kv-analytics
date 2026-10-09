import type { Period, Range } from "./types.ts";

export const LAUNCH = "2026-06-23";

export function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}

export function clampFrom(from: string): string {
  return from < LAUNCH ? LAUNCH : from;
}

export function periodRange(period: Period, today: string): Range {
  const now = new Date(`${today}T00:00:00Z`);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  let from = today;
  let to = today;
  switch (period) {
    case "7d":
      from = addDays(today, -6);
      break;
    case "14d":
      from = addDays(today, -13);
      break;
    case "30d":
      from = addDays(today, -29);
      break;
    case "thisMonth":
      from = iso(new Date(Date.UTC(year, month, 1)));
      break;
    case "lastMonth":
      from = iso(new Date(Date.UTC(year, month - 1, 1)));
      to = iso(new Date(Date.UTC(year, month, 0)));
      break;
    case "thisYear":
      from = iso(new Date(Date.UTC(year, 0, 1)));
      break;
    case "lastYear":
      from = iso(new Date(Date.UTC(year - 1, 0, 1)));
      to = iso(new Date(Date.UTC(year - 1, 11, 31)));
      break;
    case "all":
      from = LAUNCH;
      break;
  }
  from = clampFrom(from);
  return { from, to: to < from ? from : to };
}

export function priorRange({ from, to }: Range): Range {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const priorTo = addDays(from, -1);
  return { from: addDays(priorTo, -(days - 1)), to: priorTo };
}

export const formatRange = ({ from, to }: Range) =>
  from === to ? from : `${from} → ${to}`;
