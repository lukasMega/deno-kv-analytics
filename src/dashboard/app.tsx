import { useEffect, useMemo, useState } from "preact/hooks";
import { parseSites } from "./api.ts";
import { csv } from "./csv.ts";
import { formatRange, LAUNCH, periodRange } from "./dates.ts";
import { usePersistedState } from "./hooks/use-persisted-state.ts";
import { useStats } from "./hooks/use-stats.ts";
import { BreakdownGrid } from "./components/breakdown-grid.tsx";
import { Heatmap } from "./components/heatmap.tsx";
import { KpiGrid } from "./components/kpi-grid.tsx";
import { MapDialogs } from "./components/map-dialogs.tsx";
import { Toolbar } from "./components/toolbar.tsx";
import { TrafficChart } from "./components/traffic-chart.tsx";
import type { Period, Site } from "./types.ts";

export function App() {
  const [token, setToken] = usePersistedState("da_token", "devtoken");
  const [site, setSite] = usePersistedState("da_site", "");
  const [showBots, setShowBots] = useState(() =>
    localStorage.getItem("docs-analytics.showBots") === "1"
  );
  const [period, setPeriod] = useState<Period | null>("7d");
  const [day, setDay] = useState("");
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(() =>
    document.readyState !== "complete"
  );
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<"country" | "timezone" | string | null>(
    null,
  );
  const today = new Date().toISOString().slice(0, 10);
  const range = useMemo(
    () => day ? { from: day, to: day } : periodRange(period ?? "7d", today),
    [day, period, today],
  );
  const stats = useStats(token, site, range);
  const loading = pageLoading || sitesLoading || stats.state === "idle" ||
    stats.state === "loading";
  useEffect(() => {
    const loaded = () => setPageLoading(false);
    if (document.readyState === "complete") loaded();
    else globalThis.addEventListener("load", loaded);
    return () => globalThis.removeEventListener("load", loaded);
  }, []);
  useEffect(() => {
    const progress = document.getElementById("loadProgress");
    if (progress) {
      progress.hidden = !loading;
      progress.setAttribute(
        "aria-label",
        pageLoading ? "Loading page" : "Fetching data",
      );
    }
    document.getElementById("app")?.setAttribute("aria-busy", String(loading));
  }, [loading, pageLoading]);
  useEffect(() => {
    const controller = new AbortController();
    setSitesLoading(true);
    fetch("/sites", {
      headers: { authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : [])
      .then((value) => {
        if (!controller.signal.aborted) setSites(parseSites(value));
      }).catch(() => {}).finally(() => {
        if (!controller.signal.aborted) setSitesLoading(false);
      });
    return () => controller.abort();
  }, [token]);
  const exportCsv = () => {
    if (!stats.data) return;
    const url = URL.createObjectURL(
      new Blob([csv(stats.data)], { type: "text/csv" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `stats-${
      site.trim() || "site"
    }-${range.from}_${range.to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const status = stats.state === "empty"
    ? (
      <>
        pick a site first — <a href="/help">help</a>
      </>
    )
    : stats.state === "loading"
    ? "loading…"
    : stats.state === "unauthorized"
    ? "401 unauthorized — check token"
    : stats.state === "error"
    ? stats.error
    : stats.state === "ready"
    ? `loaded ${formatRange(range)}`
    : "";
  return (
    <>
      <div class="head">
        <h1>analytics</h1>
        <span class="links">
          <a href="/help">help &amp; setup</a>
        </span>
      </div>
      <section>
        <Toolbar
          token={token}
          site={site}
          sites={sites}
          showBots={showBots}
          day={day}
          period={period}
          launch={LAUNCH}
          today={today}
          onToken={setToken}
          onSite={setSite}
          onBots={(value) => {
            localStorage.setItem("docs-analytics.showBots", value ? "1" : "0");
            setShowBots(value);
          }}
          onDay={(value) => {
            setDay(value);
            setPeriod(value ? null : "7d");
          }}
          onPeriod={(value) => {
            setDay("");
            setPeriod(value);
          }}
          onLoad={stats.load}
          onExport={exportCsv}
        />
        <div
          class={`msg ${
            stats.state === "error" || stats.state === "unauthorized"
              ? "err"
              : stats.state === "ready"
              ? "ok"
              : ""
          }`}
          id="loadMsg"
        >
          {status}
        </div>
        {stats.data && (
          <div id="analytics">
            <KpiGrid
              data={stats.data}
              prior={stats.prior}
              showBots={showBots}
            />
            <div class="rangeLabel" id="rangeLabel">
              {site.trim()} · {formatRange(range)}
            </div>
            <div class="chartsRow">
              <details id="chartPanel" open>
                <summary>Traffic over time</summary>
                <div id="chartWrap">
                  <TrafficChart
                    series={stats.data.series ?? []}
                    showBots={showBots}
                  />
                </div>
              </details>
              <details id="heatmapPanel" open>
                <summary>day × hour (UTC)</summary>
                <div id="heatmapWrap">
                  <Heatmap
                    data={stats.data.dowhour as
                      | Record<string, number>
                      | undefined}
                  />
                </div>
              </details>
            </div>
            <input
              id="search"
              class="search"
              placeholder="Filter breakdowns…"
              value={search}
              onInput={(event) => setSearch(event.currentTarget.value)}
            />
            <BreakdownGrid
              data={stats.data}
              showBots={showBots}
              search={search}
              onOffset={setDialog}
              onCountry={() => setDialog("country")}
              onTimezone={(dimension) =>
                setDialog(dimension === "tz" ? "timezone" : "app_tz")}
            />
          </div>
        )}
      </section>
      <MapDialogs
        country={dialog === "country"
          ? stats.data?.country as Record<string, number>
          : undefined}
        timezone={dialog === "timezone"
          ? stats.data?.tz as Record<string, number>
          : dialog === "app_tz"
          ? stats.data?.app_tz as Record<string, number>
          : undefined}
        offset={dialog && dialog !== "country" && dialog !== "timezone" &&
            dialog !== "app_tz"
          ? dialog
          : null}
        close={() => setDialog(null)}
      />
    </>
  );
}
