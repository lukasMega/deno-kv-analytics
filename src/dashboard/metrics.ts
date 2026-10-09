import type { CountMap, Stats } from "./types.ts";

export const dimTotal = (counts?: CountMap): number =>
  Object.values(counts ?? {}).reduce((total, count) => total + count, 0);

export interface Metric {
  value: string;
  numeric: number;
}
export interface DashboardMetrics {
  pageviews: Metric;
  visitors: Metric;
  sessions: Metric;
  viewsPerVisit: Metric;
  bounce: Metric;
  engagement: Metric;
  human: Metric;
  bots: Metric;
  apps: Metric;
}

export function metrics(data: Stats): DashboardMetrics {
  const pageviews = data.pv?._ ?? 0;
  const visitors = data.uv?._ ?? 0;
  const sessions = data.sessions?._ ?? 0;
  const bounce = data.bounce?._ ?? 0;
  const bouncePercent = sessions ? (bounce / sessions) * 100 : 0;
  const bounceShown = Number(bouncePercent.toFixed(0));
  const human = pageviews
    ? (dimTotal(data.hi as CountMap) / pageviews) * 100
    : 0;
  return {
    pageviews: { value: String(pageviews), numeric: pageviews },
    visitors: { value: String(visitors), numeric: visitors },
    sessions: { value: String(sessions), numeric: sessions },
    viewsPerVisit: {
      value: (visitors ? pageviews / visitors : 0).toFixed(1),
      numeric: visitors ? pageviews / visitors : 0,
    },
    bounce: { value: `${bounceShown}%`, numeric: bouncePercent },
    engagement: {
      value: `${sessions ? 100 - bounceShown : 0}%`,
      numeric: sessions ? 100 - bouncePercent : 0,
    },
    human: { value: `${human.toFixed(0)}%`, numeric: human },
    bots: {
      value: String(dimTotal(data.bot as CountMap)),
      numeric: dimTotal(data.bot as CountMap),
    },
    apps: {
      value: String(dimTotal(data.app as CountMap)),
      numeric: dimTotal(data.app as CountMap),
    },
  };
}

export function delta(
  current: number,
  previous: number,
): { text: string; className: string } {
  if (!previous) return { text: "—", className: "flat" };
  const percent = ((current - previous) / previous) * 100;
  return {
    text: `${percent > 0 ? "▲" : percent < 0 ? "▼" : "–"} ${
      Math.abs(percent).toFixed(0)
    }%`,
    className: percent > 0 ? "up" : percent < 0 ? "down" : "flat",
  };
}

export const heatmapColor = (value: number, max: number): string => {
  const steps = ["#1f4854", "#2b6b7c", "#3a92a6", "#5db2c4", "#88c0d0"];
  if (!value) return "#0e1116";
  return steps[
    Math.min(
      steps.length - 1,
      Math.floor(Math.sqrt(value / max) * steps.length),
    )
  ];
};
