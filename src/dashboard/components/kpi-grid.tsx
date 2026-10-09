import { delta, metrics } from "../metrics.ts";
import type { Stats } from "../types.ts";

const tiles = [
  ["pageviews", "pageviews"],
  ["visitors", "unique visitors"],
  ["sessions", "sessions"],
  ["viewsPerVisit", "views / visit"],
  ["bounce", "bounce rate"],
  ["engagement", "engagement rate"],
  ["human", "human interaction"],
] as const;

export function KpiGrid(
  { data, prior, showBots }: {
    data: Stats;
    prior: Stats | null;
    showBots: boolean;
  },
) {
  const current = metrics(data);
  const before = prior ? metrics(prior) : null;
  const rows = [
    ...tiles,
    ...(showBots ? [["bots", "bot visits"] as const] : []),
    ...((current.apps.numeric || before?.apps.numeric)
      ? [["apps", "app pings"] as const]
      : []),
  ];
  return (
    <div class="kpiRow">
      {rows.map(([id, label]) => {
        const change = before
          ? delta(current[id].numeric, before[id].numeric)
          : { text: "—", className: "flat" };
        return (
          <div class={`kpiTile${id === "bots" ? " bot" : ""}`}>
            <div class="kpiVal">{current[id].value}</div>
            <div class="kpiLabel">{label}</div>
            <div class={`kpiDelta ${change.className}`}>{change.text}</div>
          </div>
        );
      })}
    </div>
  );
}
