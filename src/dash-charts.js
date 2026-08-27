// The two chart renderers, split out of dashboard.js to keep that file under
// the repo's ~550-line ceiling. Both take their data as arguments and touch only
// their own container element — no shared state with the rest of the dashboard.
//
// Flat sibling of main.ts — Deploy uploads no subdirectories.

import { $ } from "/da-common.js";

// --- uPlot, loaded once on first render ---
let uplotReady = null;
function loadUplot() {
  if (uplotReady) return uplotReady;
  uplotReady = new Promise((resolve, reject) => {
    // vendored & served by this same collector — no CDN dependency
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/vendor/uPlot.min.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "/vendor/uPlot.iife.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("failed to load uPlot"));
    document.head.appendChild(script);
  });
  return uplotReady;
}

let chart = null;
export async function renderChart(series, showBots) {
  const el = $("chart");
  try {
    await loadUplot();
  } catch {
    // chart is optional — never let it block KPIs / breakdowns
    el.innerHTML =
      '<p class="hint">chart unavailable (uPlot failed to load — check /vendor/)</p>';
    return;
  }
  if (chart) {
    chart.destroy();
    chart = null;
  }
  el.innerHTML = "";
  if (!series.length) return;
  // rows are [day, pv, uv, sessions, bot] (older single-metric rows still plot pv)
  const xs = series.map((r) => Date.parse(r[0] + "T00:00:00Z") / 1000);
  const pv = series.map((r) => r[1] ?? 0);
  const uv = series.map((r) => r[2] ?? 0);
  const ss = series.map((r) => r[3] ?? 0);
  const bots = series.map((r) => r[4] ?? 0);
  const points = { show: series.length < 60 };
  const width = el.parentElement.clientWidth;
  // bot line is added only when opted in — its scale can dwarf pv on a quiet
  // day, and it is not a human metric
  const botSeries = showBots
    ? [{ label: "bots", stroke: "#d08770", width: 1, dash: [4, 4], points }]
    : [];
  const botData = showBots ? [bots] : [];
  chart = new uPlot(
    {
      width,
      height: 180,
      padding: [10, 10, 0, 0],
      legend: { show: true },
      cursor: { show: true },
      scales: { x: { time: true } },
      axes: [
        {
          stroke: "#6b7684",
          grid: { stroke: "#20262f" },
          ticks: { stroke: "#20262f" },
        },
        {
          stroke: "#6b7684",
          grid: { stroke: "#20262f" },
          ticks: { stroke: "#20262f" },
        },
      ],
      series: [
        {},
        {
          label: "pageviews",
          stroke: "#88c0d0",
          width: 2,
          fill: "rgba(136,192,208,0.15)",
          points,
        },
        { label: "unique visitors", stroke: "#a3be8c", width: 2, points },
        { label: "sessions", stroke: "#ebcb8b", width: 2, points },
        ...botSeries,
      ],
    },
    [xs, pv, uv, ss, ...botData],
    el,
  );
}
globalThis.addEventListener("resize", () => {
  if (!chart) return;
  chart.setSize({ width: $("chart").parentElement.clientWidth, height: 180 });
});

// --- day×hour heatmap (from the pairwise `dowhour` dim: real co-occurrence) ---
// Rows are Mon→Sun; the stored dow index is 0=Sun, hence the reordering.
const DOW_ROWS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [
  6,
  "Sat",
], [0, "Sun"]];
// sequential frost ramp, low→high; index 0 is used only for counts > 0
const HM_STEPS = ["#1f4854", "#2b6b7c", "#3a92a6", "#5db2c4", "#88c0d0"];
const HM_EMPTY = "#0e1116";

// sqrt (not linear) so the long tail of quiet hours stays distinguishable —
// traffic-by-hour is heavily skewed and a linear ramp collapses it to one color.
function hmStep(v, max) {
  if (!v) return HM_EMPTY;
  const t = Math.sqrt(v / max);
  return HM_STEPS[
    Math.min(HM_STEPS.length - 1, Math.floor(t * HM_STEPS.length))
  ];
}

export function renderHeatmap(dowhour) {
  const wrap = $("heatmapWrap");
  if (!dowhour || !Object.keys(dowhour).length) {
    wrap.innerHTML = '<div class="dim">day × hour (UTC)</div>' +
      '<p class="hint">no day×hour data for this range yet</p>';
    return;
  }
  const max = Math.max(...Object.values(dowhour));

  let h = '<div class="dim">day × hour (UTC)</div><div class="hmGrid">';
  h += '<div class="hmHead"></div>';
  for (let hr = 0; hr < 24; hr++) {
    h += '<div class="hmHead">' +
      (hr % 3 === 0 ? String(hr).padStart(2, "0") : "") + "</div>";
  }
  for (const [dow, label] of DOW_ROWS) {
    h += '<div class="hmRowLabel">' + label + "</div>";
    for (let hr = 0; hr < 24; hr++) {
      const hh = String(hr).padStart(2, "0");
      const v = dowhour[dow + "-" + hh] ?? 0;
      h += '<div class="hmCell" style="background:' + hmStep(v, max) +
        '" title="' +
        label + " " + hh + ":00 UTC · " + v + ' views"></div>';
    }
  }
  h += "</div>";

  // legend: identity is never color-alone — the swatch scale is labelled at both ends
  h += '<div class="hmLegend"><span>none</span>' +
    '<span class="hmSwatch hmCell" style="background:' + HM_EMPTY +
    '"></span><span>1</span>';
  for (const c of HM_STEPS) {
    h += '<span class="hmSwatch" style="background:' + c + '"></span>';
  }
  h += "<span>" + max + " views / hour (UTC)</span></div>";

  wrap.innerHTML = h;
}
