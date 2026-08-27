---
sidebar_position: 3
title: Dashboard & API
description: Endpoints, auth model and what the dashboard renders.
---

# Dashboard & API

## Endpoints

- **`GET /s.js`** — the browser beacon (~2.8KB minified). Config comes off the
  script tag: `data-site` (optional on a mapped custom domain) and
  `data-dev="1"` to collect from localhost, which is otherwise skipped. The
  endpoint is the script's own origin, so the beacon is always first-party to
  whatever domain served it.
- **`GET /e?s=<site>&v=<base64>`** — beacon, sent as a 1×1 gif-pixel image
  request (adblock resilience).
  `v = base64(encodeURIComponent(JSON.stringify({p,r,l,ls,tz,…})))`. Browser/OS
  are derived from the request `user-agent` header **server-side**; the client
  UA is ignored. Always answers with the same gif.
- **`GET /stats?site=<id>&day=YYYY-MM-DD`** — JSON counts. `day` defaults to
  today (UTC). Range: `&from=…&to=…` (inclusive) merges into totals. Add
  `&series=1` for a per-day series (`[[day, pv, uv, sessions, bot], …]`).
  **401** on a bad token _or_ an unresolved site.
- **`GET /sites`** — `[{id, host}]`, **admin token only**.
- **`GET /dashboard`** — the UI. `GET /` — `ok`.

## Auth

`Authorization: Bearer <token>` (what the dashboard uses — keeps the secret out
of access logs) **or** `?token=…` for curl convenience.

The tenancy boundary: `/stats` checks the token against the **resolved** site
only, never against the set of all tokens.

## What the dashboard renders

Site picker, period selector, uPlot trend chart, KPI tiles, day×hour heatmap,
breakdowns, CSV export, and a **show bot traffic** toggle. Breakdowns render as
two packed columns, each dim capped at its top 10 values behind a per-dim
_show all_ toggle, each row showing count + share of that dim's total. The
filter box searches every value, capped or not.

Bot traffic is **off by default** (remembered in `localStorage`). With it on you
get an amber **bot visits** KPI tile, a dashed `bots` line on the trend chart,
and the `bot` + `bot_kind` breakdowns. Strictly additive: bot hits never write
`pv`, so pageviews/visitors/sessions/bounce are bot-free either way, and
toggling only re-renders the already-loaded payload. The CSV export always
includes the bot dims.

See [Example dashboard](./example.md) for a screenshot of the whole thing.

## The `dowhour` exception

`dowhour` stores `"<dow>-<hh>"` — a **true day×hour joint counter**, which is
what the heatmap renders. It is the schema's only pairwise key and it is
intentional: `dow` and `hour` as separate counters are _marginals_, and
multiplying them into a grid would fabricate an outer product rather than show
real co-occurrence. Storing the joint key costs the same 1 write unit a
standalone `dow` dim would, so the honest version is free.

## Behavioral probe

Right after the pageview beacon, the client arms a one-shot listener set
(`pointerdown`/`keydown`/`touchstart`/`wheel`/`mousemove`, all
`{ passive: true, once: true }`). The first to land reports a verdict:
`hi[<bucket>]` where the bucket is beacon-to-interaction latency (`<150`,
`150-2000`, `>2000`), or — if `event.isTrusted === false`, i.e. a script called
`dispatchEvent` rather than a real user acting — `bot[synthetic]`.

`scroll` is deliberately **not** in the trigger set: SPA routers scroll-restore
on every route change and a browser-generated scroll event is `isTrusted`, which
would report a human on nearly every navigation.

Nothing beyond that verdict leaves the browser: no coordinates, no movement
deltas, no event trace, nothing written to `localStorage`. The verdict is a
plain independent counter, so it cannot be joined against `path`, `country` or
anything else — which is what keeps it inside the no-consent-banner claim. Read
the **human interaction** KPI as a daily trend, not a per-hit verdict.

Known ceiling: a CDP-driven browser using real `Input.dispatchMouseEvent`
produces **trusted** events, so genuinely stealthy headless automation passes
this probe. Catching that would need fingerprinting, which is out of scope by
design.

## curl smoke test

```bash
BASE=http://localhost:8123                 # or https://stats.<yourdomain>

V=$(deno eval 'console.log(btoa(encodeURIComponent(JSON.stringify(
  {p:"/docs/intro",r:"google.com",l:"de-DE",tz:"Europe/Berlin"}))))')

curl -i "$BASE/e?s=demo&v=$V" \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0) Firefox/126.0'
# → 200 image/gif;  Firefox / Windows / de

curl -s "$BASE/stats?site=demo&token=devtoken" | jq .
```
