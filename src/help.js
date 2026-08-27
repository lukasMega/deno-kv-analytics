// /help — guided setup. Every step verifies itself against the live collector
// using only endpoints that already exist (`/`, `/stats`, `/sites`), so the
// tutorial can never drift from what the server actually does.
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
  tokenOk,
} from "/da-common.js";

// --- snippets -----------------------------------------------------------

// Env var name mirrors tokenFor() on the server: uppercase, every non-alnum
// character to `_`. Keep in sync with sites.ts.
const envVar = (id) =>
  "STATS_TOKEN_" + id.toUpperCase().replace(/[^A-Z0-9]/g, "_");

function renderSnippets() {
  const id = $("site").value.trim() || "my-project";
  $("envSnippet").textContent = 'SITES="' + id + '"\n' + envVar(id) +
    "=<a long random string>";
  $("tagSnippet").textContent = '<script defer src="' + location.origin +
    '/s.js" data-site="' + id + '"><\/script>';
}

// --- checks -------------------------------------------------------------

function verdict(n, pass, text) {
  const el = $("v" + n);
  el.className = "verdict " + (pass ? "ok" : "err");
  el.textContent = (pass ? "✓ " : "✗ ") + text;
  const step = $("step" + n);
  step.classList.toggle("pass", pass);
  step.classList.toggle("fail", !pass);
}

// Yesterday→today rather than today alone: a hit sent just before UTC midnight
// lands on the previous day key and would otherwise read as "nothing arrived".
function recentRange() {
  const t = todayIso();
  const d = new Date(t + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return "from=" + iso(d) + "&to=" + t;
}

async function recentStats() {
  const res = await statsFetch("/stats?" + recentRange());
  if (res.status === 401) return { status: 401 };
  if (!res.ok) return { status: res.status };
  return { status: 200, data: await res.json() };
}

const CHECKS = {
  async 1() {
    const res = await fetch("/");
    const body = (await res.text()).trim();
    return res.ok && body === "ok"
      ? [true, "collector responding"]
      : [false, "GET / returned " + res.status + " " + esc(body.slice(0, 40))];
  },

  async 2() {
    if (!$("site").value.trim()) return [false, "enter a site id above"];
    // A single /stats probe answers both halves at once: the server returns 401
    // for a wrong token *and* for a site this token does not own.
    return (await tokenOk())
      ? [true, "token opens this site"]
      : [false, "401 — wrong token, or the id is not in SITES"];
  },

  async 3() {
    const { status, data } = await recentStats();
    if (status === 401) return [false, "401 — finish step 2 first"];
    if (status !== 200) return [false, "/stats returned " + status];
    const pv = data.pv?._ ?? 0;
    return pv > 0 ? [true, pv + " pageviews in the last 2 days"] : [
      false,
      "no pageviews yet — tag not loading, or blocked by an ad blocker",
    ];
  },

  async 4() {
    const want = $("origin").value.trim().replace(/\/+$/, "");
    if (!want) return [false, "enter the origin you pasted the tag on"];
    const { status, data } = await recentStats();
    if (status === 401) return [false, "401 — finish step 2 first"];
    if (status !== 200) return [false, "/stats returned " + status];
    const hosts = Object.keys(data.host || {});
    if (hosts.includes(want)) return [true, "traffic from " + want];
    return [
      false,
      hosts.length
        ? "not seen — origins so far: " + hosts.slice(0, 3).join(", ")
        : "no origins recorded yet",
    ];
  },

  async 5() {
    const other = $("site2").value.trim();
    if (!other) return [false, "enter the second site id"];
    if (other === $("site").value.trim()) {
      return [false, "that is the same id as above"];
    }
    // Built by hand rather than via statsFetch, which always appends the site
    // from the toolbar — here the whole point is to ask about a different one.
    const res = await fetch(
      "/stats?site=" + encodeURIComponent(other) + "&day=" + todayIso(),
      { headers: { authorization: "Bearer " + $("token").value } },
    );
    if (res.status === 401) {
      return [
        false,
        "401 — add it to SITES, or paste " + envVar(other) + " above",
      ];
    }
    return res.ok
      ? [true, "both projects readable"]
      : [false, "/stats returned " + res.status];
  },
};

for (const btn of document.querySelectorAll(".check")) {
  btn.onclick = async () => {
    const n = btn.dataset.step;
    $("v" + n).textContent = "…";
    try {
      const [pass, text] = await CHECKS[n]();
      verdict(n, pass, text);
    } catch (e) {
      verdict(n, false, String(e));
    }
  };
}

for (const btn of document.querySelectorAll(".copy")) {
  btn.onclick = async () => {
    await navigator.clipboard.writeText($(btn.dataset.copy).textContent);
    const was = btn.textContent;
    btn.textContent = "copied ✓";
    setTimeout(() => {
      btn.textContent = was;
    }, 1200);
  };
}

// --- test beacon tool (moved here from the dashboard) --------------------

async function fire(over) {
  // mirror the client: opaque base64 token on GET /e, like the gif-pixel beacon
  const payload = {
    p: over?.p ?? $("p").value,
    r: over?.r ?? $("r").value,
    l: over?.l ?? $("l").value,
    ls: over?.ls ?? $("ls").value,
    tz: over?.tz ?? $("tz").value,
    h: over?.h ?? $("h").value,
  };
  // optional extras: viewport/UTM/visitor-session flags/custom events
  if (over?.vw) payload.vw = over.vw;
  if (over?.us) payload.us = over.us;
  if (over?.um) payload.um = over.um;
  if (over?.uc) payload.uc = over.uc;
  if (over?.u) payload.u = over.u;
  if (over?.s) payload.s = over.s;
  if (over?.b) payload.b = over.b;
  if (over?.ev) {
    payload.ev = over.ev;
    if (over.t) payload.t = over.t;
  }
  const v = btoa(encodeURIComponent(JSON.stringify(payload)));
  // top-level `s` is the tenant site id (separate from any `s` inside the
  // base64 payload above, which is an unrelated visitor-session flag)
  const params = { v };
  const site = $("site").value.trim();
  if (site) params.s = site;
  const res = await fetch("/e?" + new URLSearchParams(params));
  return res.status;
}

// The beacon controls are gated by the stats token: /e itself is public (it must
// accept real beacons) — this only stops the dev tool from writing into a site
// the operator cannot read back.
$("fire").onclick = async () => {
  const m = $("fireMsg");
  if (!(await tokenOk())) {
    m.className = "msg err";
    m.textContent = "401 unauthorized — fix step 2 first";
    return;
  }
  try {
    const s = await fire();
    m.className = "msg " + (s === 200 ? "ok" : "err");
    m.textContent = "GET /e → " + s + (s === 200 ? " ✓" : "");
  } catch (e) {
    m.className = "msg err";
    m.textContent = String(e);
  }
};

const PATHS = ["/", "/docs/intro", "/docs/setup", "/docs/protocol", "/faq"];
// spread across all ref_group buckets so the grouping breakdown has something to show
const REFS = [
  "google.com",
  "github.com",
  "direct",
  "duckduckgo.com",
  "twitter.com",
  "news.ycombinator.com",
];
const LANGS = ["en-US", "de-DE", "fr-FR", "es-ES", "en-GB"];
const TZS = ["Europe/Berlin", "America/New_York", "Asia/Tokyo", "UTC"];
const HOSTS = ["docs.example.com", "localhost:3000", "example.com"];
const VWS = ["<640", "640-1024", ">1024"];
const UTM_SOURCES = ["newsletter", "twitter", "github"];
const UTM_MEDIUMS = ["email", "social", "referral"];
const UTM_CAMPAIGNS = ["launch", "summer26"];
const EVENTS = [
  { ev: "outbound", t: "github.com" },
  { ev: "outbound", t: "twitter.com" },
  { ev: "download", t: "release-v1.2.3.zip" },
];
// behavioral-probe verdicts, so the human-interaction KPI and the `hi`/`bot`
// breakdowns aren't stuck at zero when seeding locally
const HI_BUCKETS = ["<150", "150-2000", ">2000"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

$("seed").onclick = async () => {
  const m = $("fireMsg");
  if (!(await tokenOk())) {
    m.className = "msg err";
    m.textContent = "401 unauthorized — fix step 2 first";
    return;
  }
  m.className = "msg";
  m.textContent = "seeding…";
  let ok = 0;
  for (let i = 0; i < 30; i++) {
    const over = {
      p: pick(PATHS),
      r: pick(REFS),
      l: pick(LANGS),
      ls: "",
      tz: pick(TZS),
      h: pick(HOSTS),
      vw: pick(VWS),
    };
    if (Math.random() < 0.3) over.us = pick(UTM_SOURCES);
    if (Math.random() < 0.3) over.um = pick(UTM_MEDIUMS);
    if (Math.random() < 0.15) over.uc = pick(UTM_CAMPAIGNS);
    if (Math.random() < 0.4) over.u = "1";
    if (Math.random() < 0.3) over.s = "1";
    const s = await fire(over);
    if (s === 200) ok++;
    // mirror the client probe: most pageviews see real input, a few look
    // synthetic. Not counted in ok/35 — these are follow-up beacons, not seeds.
    const roll = Math.random();
    if (roll < 0.7) await fire({ ev: "hi", t: pick(HI_BUCKETS) });
    else if (roll < 0.78) await fire({ ev: "bot", t: "synthetic" });
  }
  for (let i = 0; i < 5; i++) {
    const ev = pick(EVENTS);
    const s = await fire({ ev: ev.ev, t: ev.t });
    if (s === 200) ok++;
  }
  m.className = "msg ok";
  m.textContent = "seeded " + ok + "/35 ✓";
};

// --- init ---------------------------------------------------------------

bindTokenAndSite(renderSnippets);
$("site").addEventListener("input", renderSnippets);
$("token").onchange = () => loadSites();
renderSnippets();
loadSites();
