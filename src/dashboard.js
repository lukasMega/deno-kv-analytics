// Dashboard logic, extracted from dashboard.html so the markup stays readable
// and /help can reuse the shared half (see da-common.js).
//
// Flat sibling of main.ts — Deploy uploads no subdirectories.

import {
  $,
  bindTokenAndSite,
  esc,
  iso,
  loadSites,
  statsFetch,
  todayIso,
} from "/da-common.js";
import { renderChart, renderHeatmap } from "/dash-charts.js";

// --- period math (UTC, matches server) ---
const LAUNCH = "2026-06-23";
function addDays(dayStr, n) {
  const d = new Date(dayStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
const clampFrom = (from) => (from < LAUNCH ? LAUNCH : from);

function periodRange(period) {
  const t = todayIso();
  const now = new Date(t + "T00:00:00Z");
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  let from, to = t;
  switch (period) {
    case "today":
      from = t;
      break;
    case "7d":
      from = addDays(t, -6);
      break;
    case "14d":
      from = addDays(t, -13);
      break;
    case "30d":
      from = addDays(t, -29);
      break;
    case "thisMonth":
      from = iso(new Date(Date.UTC(y, m, 1)));
      break;
    case "lastMonth":
      from = iso(new Date(Date.UTC(y, m - 1, 1)));
      to = iso(new Date(Date.UTC(y, m, 0)));
      break;
    case "thisYear":
      from = iso(new Date(Date.UTC(y, 0, 1)));
      break;
    case "lastYear":
      from = iso(new Date(Date.UTC(y - 1, 0, 1)));
      to = iso(new Date(Date.UTC(y - 1, 11, 31)));
      break;
    case "all":
      from = LAUNCH;
      break;
    default:
      from = t;
  }
  from = clampFrom(from);
  if (to < from) to = from;
  return { from, to };
}

// --- bot visibility (opt-in, remembered across reloads) ---
// Bots are stored in their own dims and never touch `pv`/`uv`/`sessions`, so
// this toggle only changes what is *shown*: it re-renders from `lastRender`
// without refetching.
const BOTS_KEY = "docs-analytics.showBots";
let showBots = localStorage.getItem(BOTS_KEY) === "1";

const DIM_ORDER = [
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
  // traffic-quality dims last: `hi` (human-interaction latency buckets)
  "hi",
];
// bot dims are rendered only with the toggle on: `bot` (how a bot was caught:
// ua / synthetic) and `bot_kind` (which isbot pattern fired — this is what
// makes the filter tunable against real traffic). Always in the CSV, though —
// an export shouldn't silently depend on a UI checkbox.
const BOT_DIMS = ["bot", "bot_kind"];
// `dowhour` renders as the heatmap, not a bar list, but still belongs in an export
const CSV_DIMS = [...DIM_ORDER, ...BOT_DIMS, "dowhour"];

// rows past this are rendered but collapsed behind the per-dim "show all"
// toggle — high-cardinality dims (path, ref, event_target) otherwise dominate
// the page height. A search query overrides the cap (see applyFilter).
const BD_TOP = 10;

function renderBreakdowns(data) {
  const wrap = $("breakdowns");
  let h = "";
  const keys = [];
  for (const dim of showBots ? [...DIM_ORDER, ...BOT_DIMS] : DIM_ORDER) {
    const obj = data[dim];
    if (!obj) continue;
    const rows = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    const max = rows.length ? rows[0][1] : 1;
    // bar width is relative to the dim's largest value; the printed % is the
    // share of the dim total — two different denominators on purpose
    const total = rows.reduce((a, r) => a + r[1], 0);
    h += '<div class="bdGroup"><div class="dim">' + dim + "</div>";
    rows.forEach(([k, v], i) => {
      const pct = max ? Math.round((v / max) * 100) : 0;
      const share = total ? Math.round((v / total) * 100) : 0;
      h += '<div class="barRow' + (i >= BD_TOP ? " extra" : "") + '">' +
        '<div class="barFill" style="width:' + pct + '%"></div>' +
        '<span class="barLabel">' + esc(k) + "</span>" +
        '<span class="barCount">' + v + '<span class="barPct">' + share +
        "%</span></span></div>";
      keys.push(k);
    });
    if (rows.length > BD_TOP) {
      h += '<button class="bdMore" type="button">+ show all ' + rows.length +
        "</button>";
    }
    h += "</div>";
  }
  wrap.innerHTML = h ||
    '<p class="hint">no data for this range — see <a href="/help">help</a></p>';
  wrap.querySelectorAll(".barRow").forEach((el, i) => {
    el.dataset.label = keys[i].toLowerCase();
  });
  applyFilter();
}

// one click handler for every "show all" button (delegated — the buttons are
// re-created on each render)
$("breakdowns").onclick = (e) => {
  const btn = e.target.closest(".bdMore");
  if (!btn) return;
  const group = btn.closest(".bdGroup");
  group.classList.toggle("open");
  const n = group.querySelectorAll(".barRow").length;
  btn.textContent = group.classList.contains("open")
    ? "− show top " + BD_TOP
    : "+ show all " + n;
  applyFilter();
};

function applyFilter() {
  const q = $("search").value.trim().toLowerCase();
  for (const group of document.querySelectorAll(".bdGroup")) {
    // a query searches the *whole* dim, not just its visible top rows
    const open = q ? true : group.classList.contains("open");
    let shown = 0;
    for (const row of group.querySelectorAll(".barRow")) {
      const match = !q || row.dataset.label.includes(q);
      row.style.display = match && (open || !row.classList.contains("extra"))
        ? ""
        : "none";
      if (match) shown++;
    }
    const btn = group.querySelector(".bdMore");
    if (btn) btn.style.display = q ? "none" : "";
    // drop a dim entirely when nothing in it matches, so the grid closes up
    group.style.display = shown ? "" : "none";
  }
}
$("search").oninput = applyFilter;

function fmtRange(from, to) {
  return from === to ? from : from + " → " + to;
}

// prior period = same length, immediately before `from` (UTC, clamped by caller)
function priorRange(from, to) {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const pTo = addDays(from, -1);
  const pFrom = addDays(pTo, -(days - 1));
  return { from: pFrom, to: pTo };
}

function fmtDelta(cur, prev) {
  if (!prev) return { text: "—", cls: "flat" };
  const pct = ((cur - prev) / prev) * 100;
  const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "–";
  const cls = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  return { text: arrow + " " + Math.abs(pct).toFixed(0) + "%", cls };
}

function setDelta(id, cur, prev) {
  const el = $(id);
  const { text, cls } = fmtDelta(cur, prev);
  el.className = "kpiDelta " + cls;
  el.textContent = text;
}

const DELTA_IDS = [
  "kpiPvDelta",
  "kpiUvDelta",
  "kpiSessionsDelta",
  "kpiViewsPerVisitDelta",
  "kpiBounceDelta",
  "kpiEngagementDelta",
  "kpiHumanDelta",
  "kpiBotDelta",
];

// total across every value of a dim (the `hi` dim is split into latency buckets,
// but the KPI only cares that the probe fired at all)
const dimTotal = (obj) => Object.values(obj || {}).reduce((a, b) => a + b, 0);

function renderKpis(data, prior) {
  const pv = data.pv?._ ?? 0;
  const uv = data.uv?._ ?? 0;
  const sessions = data.sessions?._ ?? 0;
  const bounce = data.bounce?._ ?? 0;
  // share of pageviews that saw real input. The probe fires at most once per
  // pageview, so hi ≤ pv. Read as a trend, not a per-hit verdict — a genuine
  // visitor can leave before touching anything.
  const humanPct = pv ? (dimTotal(data.hi) / pv) * 100 : 0;
  const viewsPerVisit = uv ? pv / uv : 0;
  const bouncePct = sessions ? (bounce / sessions) * 100 : 0;
  // engagement = share of sessions that were NOT a bounce (complement of bounce
  // rate, from the same two counters — no extra dim)
  const engagementPct = sessions ? 100 - bouncePct : 0;

  $("kpiPv").textContent = pv;
  $("kpiUv").textContent = uv;
  $("kpiSessions").textContent = sessions;
  $("kpiViewsPerVisit").textContent = viewsPerVisit.toFixed(1);
  // derive the displayed engagement % from the *rounded* bounce % so the two
  // tiles always read as complements (63% / 37%, never 63% / 38%)
  const bounceShown = Number(bouncePct.toFixed(0));
  $("kpiBounce").textContent = bounceShown + "%";
  $("kpiEngagement").textContent = (sessions ? 100 - bounceShown : 0) + "%";
  $("kpiHuman").textContent = humanPct.toFixed(0) + "%";
  // bot total = every value of the `bot` dim (ua + synthetic). Separate tile,
  // hidden unless opted in; it is never folded into pv/uv/sessions.
  const bots = dimTotal(data.bot);
  $("kpiBotTile").style.display = showBots ? "" : "none";
  $("kpiBot").textContent = bots;

  if (!prior) {
    for (const id of DELTA_IDS) {
      $(id).className = "kpiDelta flat";
      $(id).textContent = "—";
    }
    return;
  }
  const ppv = prior.pv?._ ?? 0;
  const puv = prior.uv?._ ?? 0;
  const psessions = prior.sessions?._ ?? 0;
  const pbounce = prior.bounce?._ ?? 0;
  const pViewsPerVisit = puv ? ppv / puv : 0;
  const pBouncePct = psessions ? (pbounce / psessions) * 100 : 0;
  const pEngagementPct = psessions ? 100 - pBouncePct : 0;
  const pHumanPct = ppv ? (dimTotal(prior.hi) / ppv) * 100 : 0;
  setDelta("kpiPvDelta", pv, ppv);
  setDelta("kpiUvDelta", uv, puv);
  setDelta("kpiSessionsDelta", sessions, psessions);
  setDelta("kpiViewsPerVisitDelta", viewsPerVisit, pViewsPerVisit);
  setDelta("kpiBounceDelta", bouncePct, pBouncePct);
  setDelta("kpiEngagementDelta", engagementPct, pEngagementPct);
  setDelta("kpiHumanDelta", humanPct, pHumanPct);
  setDelta("kpiBotDelta", bots, dimTotal(prior.bot));
}

let lastRender = null;
async function renderAnalytics(data, prior, from, to) {
  lastRender = { data, prior, from, to };
  $("analytics").style.display = "";
  $("rangeLabel").textContent = $("site").value.trim() + " · " +
    fmtRange(from, to);
  renderKpis(data, prior);
  await renderChart(data.series || [], showBots);
  renderHeatmap(data.dowhour);
  renderBreakdowns(data);
}

let activePeriod = "7d";
function setActivePeriodButton() {
  for (const b of document.querySelectorAll("#periods button")) {
    b.classList.toggle("active", b.dataset.period === activePeriod);
  }
}
for (const b of document.querySelectorAll("#periods button")) {
  b.onclick = () => {
    activePeriod = b.dataset.period;
    $("day").value = "";
    setActivePeriodButton();
    loadStats();
  };
}
$("day").onchange = () => {
  if ($("day").value.trim()) {
    activePeriod = null;
    setActivePeriodButton();
  } else {
    activePeriod = "7d";
    setActivePeriodButton();
  }
  loadStats();
};

let lastData = null;

async function loadStats() {
  const m = $("loadMsg");
  // multi-tenant: every /stats row is namespaced by site, so an empty site
  // would just come back empty — don't bother firing the request
  if (!$("site").value.trim()) {
    m.className = "msg";
    m.innerHTML = 'pick a site first — <a href="/help">help</a>';
    $("analytics").style.display = "none";
    return;
  }
  const dayVal = $("day").value.trim();
  let from, to;
  if (dayVal) from = to = dayVal;
  else ({ from, to } = periodRange(activePeriod || "7d"));

  m.className = "msg";
  m.textContent = "loading…";
  const url = "/stats?series=1&from=" + from + "&to=" + to;
  try {
    const res = await statsFetch(url);
    if (res.status === 401) {
      m.className = "msg err";
      m.textContent = "401 unauthorized — check token";
      $("analytics").style.display = "none";
      return;
    }
    const data = await res.json();
    m.className = "msg ok";
    m.textContent = "loaded " + fmtRange(from, to);

    // best-effort comparison vs the equal-length immediately-prior period
    let prior = null;
    const { from: pFrom, to: pTo } = priorRange(from, to);
    if (pTo >= LAUNCH) {
      try {
        const pRes = await statsFetch(
          "/stats?from=" + clampFrom(pFrom) + "&to=" + pTo,
        );
        if (pRes.ok) prior = await pRes.json();
      } catch { /* comparison is best-effort */ }
    }

    lastData = data;
    await renderAnalytics(data, prior, from, to);
  } catch (e) {
    m.className = "msg err";
    m.textContent = String(e);
  }
}
$("load").onclick = loadStats;

$("showBots").checked = showBots;
$("showBots").onchange = () => {
  showBots = $("showBots").checked;
  localStorage.setItem(BOTS_KEY, showBots ? "1" : "0");
  // no refetch — the bot counts are already in the loaded payload
  const r = lastRender;
  if (r) renderAnalytics(r.data, r.prior, r.from, r.to);
};

bindTokenAndSite(loadStats);
$("token").onchange = () => loadSites();

function csvCell(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

$("exportCsv").onclick = () => {
  if (!lastData) return;
  const rows = [["dim", "value", "count"]];
  for (const dim of CSV_DIMS) {
    const obj = lastData[dim];
    if (!obj) continue;
    for (const [v, c] of Object.entries(obj)) rows.push([dim, v, c]);
  }
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const site = $("site").value.trim() || "site";
  a.download = "stats-" + site + "-" + lastRender.from + "_" + lastRender.to +
    ".csv";
  a.click();
  URL.revokeObjectURL(url);
};

$("day").min = LAUNCH;
$("day").max = todayIso();

setActivePeriodButton();
loadSites();
loadStats();
