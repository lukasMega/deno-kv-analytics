import type { Period, Site } from "../types.ts";

const periods: [Period, string][] = [
  ["today", "Today"],
  ["7d", "Last 7 days"],
  ["14d", "Last 14 days"],
  ["30d", "Last 30 days"],
  ["thisMonth", "This month"],
  ["lastMonth", "Last month"],
  ["thisYear", "This year"],
  ["lastYear", "Last year"],
  ["all", "All time"],
];

export function Toolbar(
  props: {
    token: string;
    survey?: boolean;
    site: string;
    sites: Site[];
    showBots: boolean;
    day: string;
    period: Period | null;
    launch: string;
    today: string;
    onToken(value: string): void;
    onSite(value: string): void;
    onBots(value: boolean): void;
    onDay(value: string): void;
    onPeriod(value: Period): void;
    onLoad(): void;
    onExport(): void;
  },
) {
  return (
    <>
      <div class="toolbar">
        <input
          id="token"
          type="password"
          value={props.token}
          placeholder="token"
          aria-label="Token"
          autocomplete="off"
          onInput={(event) => props.onToken(event.currentTarget.value)}
        />
        <label class="tokenReveal">
          <input
            id="showToken"
            type="checkbox"
            aria-controls="token"
            onChange={(event) => {
              const token = document.getElementById(
                "token",
              ) as HTMLInputElement;
              token.type = event.currentTarget.checked ? "text" : "password";
            }}
          />{" "}
          Show token
        </label>
        <input
          id="site"
          list="siteList"
          value={props.site}
          placeholder="site id"
          autocomplete="off"
          onInput={(event) => props.onSite(event.currentTarget.value)}
        />
        <datalist id="siteList">
          {props.sites.map((site) => (
            <option value={site.id}>{site.host ?? site.id}</option>
          ))}
        </datalist>
        {!props.survey && (
          <label class="toggle" for="showBots">
            <input
              type="checkbox"
              id="showBots"
              checked={props.showBots}
              onChange={(event) => props.onBots(event.currentTarget.checked)}
            />{" "}
            bots
          </label>
        )}
        <input
          id="day"
          type="date"
          value={props.day}
          min={props.launch}
          max={props.today}
          title="single day — overrides period buttons"
          onChange={(event) => props.onDay(event.currentTarget.value)}
        />
        <button id="load" type="button" class="alt" onClick={props.onLoad}>
          Load
        </button>
        {!props.survey && (
          <details class="moreActions" id="moreActions">
            <summary aria-label="More actions">⋯</summary>
            <div id="actionsDropdown">
              <button id="exportCsv" type="button" onClick={props.onExport}>
                Export CSV
              </button>
            </div>
          </details>
        )}
      </div>
      <div class="periods" id="periods">
        {periods.map(([value, label]) => (
          <button
            type="button"
            class={props.period === value ? "active" : ""}
            aria-pressed={props.period === value}
            onClick={() => props.onPeriod(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
