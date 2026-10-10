export type CountMap = Record<string, number>;

export type SeriesRow = readonly [
  day: string,
  pageviews: number,
  visitors: number,
  sessions: number,
  bots: number,
  appPings: number,
];

export type Period =
  | "today"
  | "7d"
  | "14d"
  | "30d"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "lastYear"
  | "all";

export interface Stats {
  site?: string;
  latest?: Record<string, string[]>;
  series?: SeriesRow[];
  pv?: CountMap;
  uv?: CountMap;
  sessions?: CountMap;
  bounce?: CountMap;
  [dimension: string]:
    | CountMap
    | Record<string, string[]>
    | SeriesRow[]
    | string
    | undefined;
}

export interface Site {
  id: string;
  host?: string;
}

export interface Range {
  from: string;
  to: string;
}
