import { heatmapColor } from "../metrics.ts";
import type { CountMap } from "../types.ts";
const days = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [
  6,
  "Sat",
], [0, "Sun"]];
export function Heatmap({ data }: { data?: CountMap }) {
  if (!data || !Object.keys(data).length) {
    return <p class="hint">no day×hour data for this range yet</p>;
  }
  const max = Math.max(...Object.values(data));
  return (
    <>
      <div class="hmGrid">
        <div class="hmHead" />
        {Array.from(
          { length: 24 },
          (_, hour) => (
            <div class="hmHead">
              {hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}
            </div>
          ),
        )}
        {days.flatMap((
          [day, label],
        ) => [
          <div class="hmRowLabel" key={`${day}-label`}>{label}</div>,
          ...Array.from({ length: 24 }, (_, hour) => {
            const count = data[`${day}-${String(hour).padStart(2, "0")}`] ?? 0;
            return (
              <div
                key={`${day}-${hour}`}
                class="hmCell"
                style={{ background: heatmapColor(count, max) }}
                title={`${label} ${
                  String(hour).padStart(2, "0")
                }:00 UTC · ${count} views`}
              />
            );
          }),
        ])}
      </div>
      <div class="hmLegend">
        <span>none</span>
        <span class="hmSwatch hmCell" style={{ background: "#0e1116" }} />
        <span>1</span>
        <span>{max} views / hour (UTC)</span>
      </div>
    </>
  );
}
