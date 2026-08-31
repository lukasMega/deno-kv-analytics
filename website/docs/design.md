---
sidebar_position: 9
title: Design notes
description: Why the schema, the write budget, the bot handling and the Deploy layout are the way they are — the reasoning behind the collector, in one place.
---

# Design notes

Everything here is _why_, not _how_. Nothing on this page is needed to install
or run the collector; it is the reasoning you want before changing it.

## Data model

```
key   = ["c", site, day, dim, value]     // exactly 5 segments
value = bigint, via kv.atomic().sum(key, 1n)
```

One exception, deliberately outside that prefix:

```
key   = ["t", site, "pv"]                // all-time pageviews, never pruned
```

It is separate because everything under `["c", …]` is day-keyed and therefore
deleted by `prune` after 400 days — an "all time" number summed from those keys
would quietly start shrinking. Written only for sites in `BADGE_SITES`, in the
same atomic commit as the day counters, so it cannot drift from `pv`. Reading it
is one point get instead of 400.

One atomic commit per hit. Dims are counted **independently** — no
co-occurrence, so no cross-dim segmentation. That is precisely what keeps the
no-consent-banner claim true: there is no row to reconstruct and no join to
perform.

<details>
<summary><b>Why <code>site</code> is a key segment, not a dim</b></summary>

It gives per-site `kv.list` prefixes for read, prune, export and delete-a-site
for free, and makes cross-site leakage a key-construction bug (loud, testable)
rather than a filtering bug (silent). Reads filter on key **length**, because a
site id may legitimately look like a date and would otherwise collide with the
4-segment pre-tenancy prefix.

</details>

<details>
<summary><b>Every dim a hit can write</b></summary>

A **pageview** (`d.ev` absent) always writes 12 dims: `pv`, `path`, `host`,
`ref`, `ref_group`, `lang`, `tz`, `browser`, `os`, `device`, `hour` (UTC,
`00`–`23`), `dowhour`.

`pv` is a raw hit counter, never deduped: one reader reloading four times is
`pv` +4 (and `uv` +1, `sessions` +1). An SPA route change counts as a pageview
too — the beacon wraps `pushState`/`replaceState` and listens for `popstate`.

Plus, only when present:

- `country` — server-side, and **only if** a fronting CDN sets a country header
  like `cf-ipcountry`. Bare Deno Deploy exposes no visitor geo, so this dim
  simply never fires. No IP is ever read or stored.
- `viewport`, `utm_source`, `utm_medium`, `utm_campaign` — from the beacon.
- `uv` (first hit of day), `sessions` (new session), `bounce` (prior session had
  one pageview) — derived from a `localStorage` id that never leaves the
  browser.

An **event** (`d.ev` set) writes only `event` + `event_target` and does **not**
increment `pv` — except the two behavioral-probe verdicts (`ev=hi`, `ev=bot`),
which the server routes to their own dims.

Every stored value is clamped to **128 chars**, so a hostile or buggy client
cannot inflate KV cost. Unknown fields (like `z`) are ignored.

`day`, `hour` and `dowhour` all come from **one** clock read per hit, so a
request landing on the midnight boundary cannot be filed under one day carrying
the next day's hour.

</details>

## Write budget

The canonical numbers — every other page links here rather than restating them.

The Deno KV free tier is roughly **300K write units/month**. A pageview writes
12 counters, one write unit each:

| traffic                           | cost     | budget                               |
| --------------------------------- | -------- | ------------------------------------ |
| pageview, no interaction          | 12 units | ≈ **25K pv/mo**                      |
| pageview + behavioral probe fires | 13 units | ≈ **23K pv/mo**                      |
| bot hit                           | 2 units  | does not compete — never writes `pv` |

Add **1 unit** to each pageview row for a site listed in `BADGE_SITES` (the
all-time counter): 13 → ≈23K pv/mo, 14 → ≈21K pv/mo. Sites without a badge are
unaffected, which is the reason that write is gated rather than unconditional.

That budget is **shared across every site on the deployment**, not per site.
Eight projects at an even split is ~3K pageviews each. There is no per-site cap
today; watch the per-site `pv` on the dashboard if one project going viral is a
risk.

**Adding a dim is a budget change, not a cosmetic one.** It costs a write unit
on every pageview of every site.

A top-level `Deno.cron` prunes days older than 400, **per site** — the "first
in-range day → stop" early exit is only valid inside one site's prefix, because
keys sort by site then day. A single scan with that break would prune the first
site and let every other one grow forever.

`deno task admin -- size` estimates stored bytes per site (see
[Configuration](./configuration.md#operator-cli)).

## Bots are counted, never dropped

A hit whose User-Agent matches [`isbot`](https://github.com/omrilotan/isbot)
writes `bot["ua"]` (a running total) and `bot_kind[<match>]` (which pattern
fired — `googlebot`, `facebookexternalhit`, …; bounded cardinality, same
128-char clamp) instead of `pv`, then returns the same gif so behavior is
unchanged for the caller.

`isbot` covers the JS-capable set a hand-rolled UA regex misses: headless
Chromium, `Chrome-Lighthouse`, AI crawlers like GPTBot/ClaudeBot/PerplexityBot.

Counting rather than dropping makes the filter tunable against real traffic —
compare `bot`/`bot_kind` over time — instead of guesswork with no signal at all.

Display is strictly additive: bot hits never write `pv`, so
pageviews/visitors/sessions/bounce are bot-free whether or not the dashboard's
_show bot traffic_ toggle is on.

## The behavioral probe (`hi` / `bot[synthetic]`)

Right after the pageview beacon fires, the client arms a one-shot listener set —
`pointerdown`, `keydown`, `touchstart`, `wheel`, `mousemove`, all
`{ passive: true, once: true }`. The first to land reports a verdict:

- `hi[<bucket>]` — beacon-to-interaction latency, bucketed `<150`, `150-2000`,
  `>2000`.
- `bot[synthetic]` — if `event.isTrusted === false`, i.e. a script called
  `dispatchEvent` rather than a real user acting. It shares the `bot` dim with
  UA-detected crawlers so both detection methods total in one place.

`scroll` is deliberately **not** in the trigger set: SPA routers scroll-restore
on every route change, and a browser-generated scroll event is `isTrusted` —
which would report a human on nearly every navigation. `wheel` + `touchstart`
cover real scroll intent without the false positive.

These stay off `event`/`event_target` because `hi` fires on roughly every
pageview; folding it in would bury the download/outbound bars and interleave
latency buckets with filenames.

**Nothing beyond that verdict leaves the browser**: no coordinates, no movement
deltas, no event trace, and nothing written to `localStorage`. `mousemove` is in
the set purely for its `isTrusted` bit, not to track motion. The pageview beacon
is never delayed or gated on this — it fires immediately for every visitor,
mouse or no mouse. The verdict is a plain independent counter, so it cannot be
joined against `path`, `country` or anything else, which is what keeps it inside
the no-consent-banner claim.

Read the **human interaction** KPI (`hi total / pv`) as a daily trend, not a
per-hit verdict: a real visitor can legitimately bounce before touching
anything.

<details>
<summary><b>Known ceiling</b></summary>

A CDP-driven browser using real `Input.dispatchMouseEvent` produces **trusted**
events, so genuinely stealthy headless automation passes this probe. Catching
that would need fingerprinting, which is out of scope by design.

</details>

## `dowhour` — the one pairwise dim

`dowhour` stores `"<dow>-<hh>"` (dow `0`=Sun…`6`=Sat, UTC — 168 possible
values): a **true day×hour joint counter**, which is what the dashboard heatmap
renders.

It is the schema's only pairwise key and it is intentional. `dow` and `hour` as
separate independent counters are _marginals_; multiplying them into a grid
would fabricate an outer product rather than show real co-occurrence. Storing
the joint key directly costs the same 1 write unit a standalone `dow` dim would,
so the honest version is free. Per-weekday totals are recovered by summing
`dowhour` over hours — no separate `dow` dim exists.

Do not add a second pairwise dim without accepting the same tradeoff.

## Beacon and ingest details

<details>
<summary><b><code>ref_group</code> — referrer bucketing</b></summary>

Classified **server-side at ingest** into `search` / `social` / `internal` /
`direct` / `referral`, so the grouping is consistent and lands in the CSV export
instead of being re-derived per dashboard render.

`internal` is a referrer whose host equals the beacon's own origin (a full-page
reload inside the site), which keeps it out of the acquisition numbers. The
client sends `r: ""` for direct traffic; that is normalized to `direct` rather
than stored as an empty key.

</details>

<details>
<summary><b><code>z</code> — why the payload carries a random field</b></summary>

The beacon is an `Image()` GET, and a browser collapses an image request whose
URL exactly repeats an earlier one — verified in Chrome,
`cache-control:
no-store` notwithstanding. Without a nonce every _repeated_
beacon is silently lost: the same `hi` latency bucket on a second pageview, an
A→B→A→B SPA path loop, a second click on the same download link.

`z` is 6 random chars, sent inside the opaque payload rather than as a visible
`?_=<ts>` param so the URL keeps its bland shape. The server ignores it; it is
never stored.

</details>

<details>
<summary><b>Why the beacon looks the way it does</b></summary>

A bland `/e` path plus an opaque base64 `v` token dodges EasyPrivacy's generic
`/i.gif?` pixel rule. The endpoint is the script's own origin, so the beacon is
always **first-party** to whatever domain served it — which is the main reason
Host-based tenancy is worth its complexity.

</details>

## Deploy layout: assets must be flat siblings

:::warning[This one breaks silently]

Deno Deploy bundles sibling `new URL(…, import.meta.url)` files but **skips
subdirectories**, and ignores `with { type: "text" }` at runtime. So every
runtime asset must sit **flat** beside the entrypoint `src/main.ts` and be read
with `Deno.readTextFile`: `s.js`, the uPlot pair, and every UI file
(`dashboard.html`, `help.html`, `dashboard.css`, `dashboard.js`,
`dash-charts.js`, `da-common.js`, `help.js`).

That is why the vendored uPlot sits flat in `src/` rather than in `vendor/`, and
why the entrypoint is `src/main.ts` rather than a root `main.ts`.

It is also why `deno.json` scopes its excludes to `fmt`/`lint` only: a top-level
`exclude` is honored by the Deploy upload and silently drops those files — they
404 in production while everything passes locally.

:::

Related: `src/s.js` is build output but **is** committed, because Deploy runs
the repo with no build step. `mise run check-beacon` fails the build if it
drifts from `src/client/beacon.ts`. Never hand-edit it.

## Which database a process opens

`Deno.openKv()` with no argument does not mean "the project database" locally:
the sqlite file is keyed to the _calling script's_ origin, so `main.ts`,
`admin.ts` and `migrate.ts` each silently got their own. `admin list` reported
nothing while `deno task dev` was happily writing.

`src/kv.ts` is the single answer. `KV_PATH` (set to `local.db` by the local
tasks) pins one file; `--db <uuid>` targets the deployed database via
`DENO_KV_ACCESS_TOKEN`; neither set keeps the bare call, which is what Deploy
needs.

## Non-goal: user-flow Sankey

A multi-hop flow diagram needs per-visitor page sequences, which requires a
cookie or a fingerprint — that would break the no-consent-banner model, so it
will not be built. The degenerate 1-hop version (pairwise `ref_group` → landing
page) is a grouped bar chart bent into ribbons and is not worth its write cost
either.

## Non-goal: path-prefix routing

Mapping `user.github.io/proj-a` → site `proj-a` would add a second input to site
resolution that page JS can influence, to replace one attribute the operator
sets once. `data-site` stays.

## Repository layout

All application code is under `src/`, including runtime assets. `scripts/` holds
build tooling that never ships.

<details>
<summary><b>File-by-file</b></summary>

| file                              | what                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `src/main.ts`                     | routing, ingest, KV reads — also the Deploy entrypoint                           |
| `src/classify.ts`                 | request → dimension values: `parseUA`, `botKind`, `refGroup`, `country`, `clamp` |
| `src/sites.ts`                    | site allowlist, Host→site resolution, per-site tokens                            |
| `src/kv.ts`                       | `openKv()` — which database, plus `taskArgs()`                                   |
| `src/client/beacon.ts`            | browser beacon → built to `src/s.js`, served at `/s.js`                          |
| `src/admin.ts`                    | operator CLI: list / size / usage / delete                                       |
| `src/migrate.ts`                  | one-shot rekey of pre-multi-site data                                            |
| `src/dashboard.html` `.js` `.css` | the UI; `src/dash-charts.js` holds trend chart + heatmap                         |
| `src/help.html` / `src/help.js`   | guided setup, one live check per step                                            |
| `src/da-common.js`                | token/site controls + `/stats` fetch, shared by both pages                       |
| `src/uPlot.*`                     | vendored uPlot js+css (flat sibling, **not** a `vendor/` dir)                    |
| `src/*_test.ts`                   | round-trip tests over in-memory KV (`deno task test`)                            |

</details>
