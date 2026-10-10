import { useMemo, useState } from "preact/hooks";
import type { CountMap, Stats } from "../types.ts";

const dimensions = [
  "path",
  "country",
  "app_tz",
  "tz",
  "host",
  "ref_group",
  "ref",
  "browser",
  "os",
  "device",
  "lang",
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
  "app_version",
  "app_device",
];
const bots = ["bot", "bot_kind"];
const top = 10;
export function BreakdownGrid(
  { data, showBots, search, onOffset, onCountry, onTimezone }: {
    data: Stats;
    showBots: boolean;
    search: string;
    onOffset(value: string): void;
    onCountry(): void;
    onTimezone(dimension: "tz" | "app_tz"): void;
  },
) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cards, setCards] = useState(true);
  const query = search.trim().toLowerCase();
  const groups = useMemo(
    () =>
      [...dimensions, ...(showBots ? bots : [])].flatMap((dimension) => {
        const counts = data[dimension] as CountMap | undefined;
        const values = Object.entries(counts ?? {}).sort((left, right) =>
          right[1] - left[1]
        ).filter(([value]) => !query || value.toLowerCase().includes(query));
        return values.length
          ? [{
            dimension,
            values,
            total: values.reduce((sum, [, count]) => sum + count, 0),
          }]
          : [];
      }),
    [data, showBots, query],
  );
  return (
    <>
      <div class="breakdownViews" role="group" aria-label="Breakdown view">
        <button
          type="button"
          id="viewCards"
          aria-pressed={cards}
          onClick={() => setCards(true)}
        >
          Cards
        </button>
        <button
          type="button"
          id="viewBars"
          aria-pressed={!cards}
          onClick={() => setCards(false)}
        >
          Original bars
        </button>
      </div>
      <div id="breakdowns" class={cards ? "cards" : ""}>
        {groups.length
          ? [
            groups.filter(({ dimension }) =>
              ["path", "country", "app_tz", "tz"].includes(dimension)
            ),
            groups.filter(({ dimension }) =>
              !["path", "country", "app_tz", "tz"].includes(dimension)
            ),
          ].map((section, index) => (
            <div class={index === 0 ? "bdPriority" : "bdRemaining"}>
              {section.map(({ dimension, values, total }) => {
                const open = expanded.has(dimension) || !!query;
                const max = values[0][1];
                const visible = open ? values : values.slice(0, top);
                return (
                  <div class="bdGroup">
                    <div class="dim">
                      {dimension}
                      {dimension === "country" && (
                        <button
                          class="mapButton"
                          type="button"
                          aria-label="Show country traffic on map"
                          onClick={onCountry}
                        >
                          🌐
                        </button>
                      )}
                      {(dimension === "tz" || dimension === "app_tz") && (
                        <button
                          class="mapButton"
                          type="button"
                          aria-label={dimension === "app_tz"
                            ? "Show app timezone traffic on map"
                            : "Show timezone traffic on map"}
                          onClick={() => onTimezone(dimension)}
                        >
                          🌐
                        </button>
                      )}
                    </div>
                    {visible.map(([value, count]) => (
                      <div
                        class="barRow"
                        tabindex={dimension === "app_tz_offset" ? 0 : undefined}
                        role={dimension === "app_tz_offset"
                          ? "button"
                          : undefined}
                        onClick={() =>
                          dimension === "app_tz_offset" && onOffset(value)}
                        onKeyDown={(event) => {
                          if (
                            dimension === "app_tz_offset" &&
                            (event.key === "Enter" || event.key === " ")
                          ) {
                            event.preventDefault();
                            onOffset(value);
                          }
                        }}
                      >
                        <div
                          class="barFill"
                          style={{ width: `${Math.round(count / max * 100)}%` }}
                        />
                        <span class="barLabel" title={value}>{value}</span>
                        {data.latest?.[dimension]?.includes(value) && (
                          <span
                            class="newBadge"
                            title="Latest recorded value in this date range"
                          >
                            NEW
                          </span>
                        )}
                        <span class="barCount">
                          {count}
                          <span class="barPct">
                            {Math.round(count / total * 100)}%
                          </span>
                        </span>
                      </div>
                    ))}
                    {values.length > top && !query && (
                      <button
                        class="bdMore"
                        type="button"
                        onClick={() =>
                          setExpanded((old) => {
                            const next = new Set(old);
                            next.has(dimension)
                              ? next.delete(dimension)
                              : next.add(dimension);
                            return next;
                          })}
                      >
                        {open
                          ? `− show top ${top}`
                          : `+ show all ${values.length}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))
          : (
            <p class="hint">
              no data for this range — see <a href="/help">help</a>
            </p>
          )}
      </div>
    </>
  );
}
