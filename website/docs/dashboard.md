---
sidebar_position: 6
title: Dashboard & API
description: Endpoints, the auth model, and what the dashboard renders.
---

# Dashboard & API

## Endpoints

- **`GET /s.js`** — the browser beacon (~2.8 KB minified). Config comes off the
  script tag: `data-site` (optional on a mapped custom domain) and `data-dev="1"`
  to collect from localhost, which is otherwise skipped.
- **`GET /e?s=<site>&v=<base64>`** — beacon, sent as a 1×1 gif-pixel image
  request. `v = base64(encodeURIComponent(JSON.stringify({p,r,l,ls,tz,…})))`.
  Browser/OS are derived from the request `user-agent` header **server-side**;
  the client UA is ignored. Always answers with the same gif, for every input.
- **`GET /stats?site=<id>&day=YYYY-MM-DD`** — JSON counts. `day` defaults to
  today (UTC). Range: `&from=…&to=…` (inclusive) merges into totals, read in
  parallel. Add `&series=1` for a per-day series
  (`[[day, pv, uv, sessions, bot], …]`). **401** on a bad token _or_ an
  unresolved site.
- **`GET /sites`** — `[{id, host}]`, **admin token only**. Powers the dashboard's
  site picker; a per-site token gets 401 there and you type the id instead.
- **`GET /badge?site=<id>&days=30`** — an SVG counter for a README, the one
  **unauthenticated** read. Opt-in per site via `BADGE_SITES`; see
  [Badge](./badge.md). **404** for a site that did not opt in _and_ for one that
  does not exist — the two are indistinguishable on purpose.
- **`GET /dashboard`** — the analytics UI. **`GET /help`** — guided setup. Both
  are served ungated: they hold no secret, the token is typed into the page, and
  a new operator has to reach `/help` _before_ they have a working token. Their
  assets (`/dashboard.css`, `/dashboard.js`, `/dash-charts.js`, `/da-common.js`,
  `/help.js`) and the vendored uPlot (`/vendor/uPlot.iife.min.js`,
  `/vendor/uPlot.min.css`) are served the same way. `GET /` — `ok`.

## Auth

`Authorization: Bearer <token>` — what the dashboard uses, since it keeps the
secret out of access logs — **or** `?token=…` for curl convenience.

The tenancy boundary: `/stats` checks the token against the **resolved** site
only, never against the set of all tokens.

## What the dashboard renders

![The dashboard: trend chart, KPI tiles, day×hour heatmap and breakdowns over 30 days of seeded traffic](/img/dashboard.png)

_Last 30 days over seeded demo data — `deno task demo` reproduces this exactly,
with no real traffic. The deltas read `—` because the seeded range starts exactly
30 days back, so there is no prior period to compare against._

- **KPI tiles** — pageviews, visitors, sessions, views/visit, bounce rate,
  engagement rate, human interaction, each with its delta against the prior
  period of equal length.
- **Trend chart** (uPlot, vendored — no CDN) — pageviews / visitors / sessions,
  plus a dashed `bots` line when _show bot traffic_ is on.
- **Day × hour heatmap** — rendered from the `dowhour` joint counter, the one
  pairwise dim in the schema
  ([why](./design.md#dowhour--the-one-pairwise-dim)).
- **Breakdowns** — every dim in two packed columns (one column under ~900px), top
  10 per dim behind a _show all_ toggle, count + share of that dim's total on
  each row. The filter box searches every value, capped or not, and hides dims
  with no match.
- **CSV export** — always includes the bot dims, regardless of the toggle.

Everything comes from one `GET /stats?…&series=1` response. The period selector
and the bot toggle re-render the loaded payload rather than refetching.

Bot traffic is **off by default** (remembered in `localStorage`). Turning it on
is strictly additive — bot hits never write `pv`, so
pageviews/visitors/sessions/bounce are bot-free either way
([why](./design.md#bots-are-counted-never-dropped)).

## `/help`

Setup, with a **Check** button on every step rather than a description of what
should happen:

1. collector reachable — `GET /` returns `ok`;
2. site id + token — one `/stats` probe, which 401s both for a wrong token and
   for a site that token does not own;
3. script tag installed — the snippet is rendered prefilled with your site id and
   this origin, and the check looks for pageviews in the last two days;
4. real traffic — the `host` dim contains the origin you pasted the tag on;
5. a second project — the other site id is live and readable.

Every check uses an endpoint that already exists, so nothing here can drift from
what the server does. The page also hosts the test-beacon and _Seed 30 random_
tools, which is what makes steps 3–4 checkable before real traffic arrives.

<details>
<summary><b>curl smoke test</b></summary>

```bash
BASE=http://localhost:8123                 # or https://stats.<yourdomain>

V=$(deno eval 'console.log(btoa(encodeURIComponent(JSON.stringify(
  {p:"/docs/intro",r:"google.com",l:"de-DE",tz:"Europe/Berlin"}))))')

curl -i "$BASE/e?s=demo&v=$V" \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0) Firefox/126.0'
# → 200 image/gif;  Firefox / Windows / de

curl -s "$BASE/stats?site=demo&token=devtoken" | jq .
```

A custom UA is the point of doing this with curl — it exercises `parseUA` in a
way the browser cannot.

</details>
