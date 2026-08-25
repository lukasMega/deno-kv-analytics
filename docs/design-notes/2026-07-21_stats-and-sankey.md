# docs-analytics — new statistics + Sankey verdict

```
Date: 2026-07-21
Scope: docs-analytics/main.ts (ingest: new dims; server classification)
       docs-analytics/dashboard.html (KPI tiles, heatmap render, ref grouping)
       docs-analytics/main_test.ts (cover new dims / classification)
       docs-analytics/README.md (document new dims)
       NOT touched: KV key layout ["c", day, dim, value] (single-counter model kept)
Status: DONE ██████████ (implemented + committed 2026-07-29 — `117019b`,
        which also carries the separate bot-detection plan's changes)
Goal: add high-value, privacy-safe stats to the cookieless collector without
      breaking the no-session-join / no-consent-banner model. Decide Sankey.
```

## Context

Collector (`main.ts`) stores every dimension as an **independent per-day
counter**: `kv.atomic().sum(["c", day, dim, value], 1n)`. Dims today:
`pv, uv,
sessions, bounce, path, host, ref, lang, tz, browser, os, device, hour, country,
viewport, utm_source, utm_medium, utm_campaign, event, event_target`.

Key property: **no co-occurrence, no session sequence**. Each dim aggregated
alone → cannot cross two dims (e.g. which `ref` led to which `path`). This is
the privacy design (no cookie/fingerprint → no consent banner). Any feature
needing joint/sequence data fights that model.

Dashboard (`dashboard.html`) reads `GET /stats?from&to[&series]`, renders KPI
tiles, a uPlot trend (pv/uv/sessions), and sorted bar breakdowns per dim.

## Sankey — verdict: SKIP

Multi-hop user-flow Sankey needs transition data (A→B, journey sequences).
Schema has none. Two ways to get it, both rejected:

- **Session sequences** (ordered page paths per visitor) → breaks
  no-cookie/no-fingerprint model. Hard no.
- **Pairwise counters** (`["flow", "ref_group>landing"]`) → 1-hop only, ~2–3×
  write-units on that key, and the result is a grouped bar bent into ribbons.
  Low value for the cost.

Conclusion: real Sankey is **incompatible with this collector's privacy model**;
the degenerate 1-hop version isn't worth the write cost. Do not build.

## Proposed stats (by cost tier)

### Tier A — dashboard-only, no ingest change (do first)

- **Referrer grouping**: bucket `ref` host into search / social / direct /
  referral client-side in `renderBreakdowns` (or a dedicated tile). Cleaner than
  raw host list. Pure `dashboard.html`.
- **Engagement rate KPI** = `1 − bounce/sessions` (both already stored). One
  tile in the `.kpiRow`, mirror existing `renderKpis` delta logic.

### Tier B — one new single counter each (1 extra `tx.sum`, cheap)

- **`dow`** (day-of-week, `0`–`6` UTC) at ingest → enables a **day×hour
  heatmap** on the dashboard (best bang/buck viz; pairs with existing `hour`).
- **`ref_group`** classified server-side at ingest (search/social/direct/
  referral) — cheaper + consistent vs client bucketing; supersedes Tier-A ref
  grouping if taken.
- **`load_ms` bucket**: client beacon sends `performance` navigation timing;
  server buckets (e.g. `<1s,1-3s,3-5s,>5s`) → page-load distribution. Needs a
  new optional beacon field on the docs-site client
  (`docs-site/src/analytics.ts`).
- **`depth`** scroll-depth bucket (25/50/75/100) via existing `ev` event channel
  — no schema change, client emits `ev=scroll,t=75`.

### Tier C — pairwise (only if ~2× write cost accepted on that key)

- `utm_source × utm_campaign` — campaign attribution table.
- `country × path` — geo content interest.
- `ref_group × landing` — honest 1-hop acquisition table (bar, not Sankey).

## Recommended batch (high value / near-zero cost / no privacy hit)

1. `dow` dim + **day×hour heatmap** (Tier B) — flagship addition.
2. **Referrer grouping** (Tier A, or `ref_group` Tier B if server-side
   preferred).
3. **Engagement-rate KPI tile** (Tier A). Optionally add `load_ms` (Tier B) —
   needs docs-site client change, so separate.

## Implementation sketch (recommended batch)

### main.ts (ingest)

- In the non-event branch, after `hour`:
  ```ts
  const dow = String(new Date().getUTCDay()); // 0=Sun … 6=Sat, UTC
  dims.push(["dow", dow]);
  ```
- (If choosing server-side ref grouping) add helper `refGroup(host: string)` →
  search/social/direct/referral; push `["ref_group", refGroup(...)]`.

### dashboard.html

- **Heatmap**: needs day×hour counts. Current `/stats` sums `hour` across the
  range (loses per-day granularity) — decide: (a) new `?heatmap=1` that returns
  `dow×hour` matrix from the `dow`+`hour` dims (still independent, so it's a
  marginal heatmap, not true joint) OR (b) accept marginal `hour` bar +
  standalone `dow` bar. NOTE: independent `dow` and `hour` cannot produce a TRUE
  joint day×hour matrix — same co-occurrence limitation as Sankey. For a true
  heatmap you'd need a pairwise `["dowhour", "d-hh"]` key (Tier C cost). Flag
  this before building: **true heatmap = pairwise; marginal = free.**
- **Engagement KPI**: add tile in `.kpiRow`, extend `renderKpis` + `DELTA_IDS`.
- **Ref grouping**: post-process `data.ref` in `renderBreakdowns`, or render new
  `ref_group` dim if added server-side (add to `DIM_ORDER`).

### main_test.ts

- Assert `dow` written on a pageview beacon; assert `ref_group` classification
  if added; assert heatmap endpoint shape if added.

### README.md

- Document any new dims + the Sankey non-goal (privacy rationale).

## Open decision before coding — RESOLVED 2026-07-29

- **Heatmap fidelity** → **true joint `dowhour`**. Storing
  `["dowhour","<dow>-<hh>"]` costs the same 1 extra write unit as a standalone
  `dow` dim would, so the honest version was free; per-weekday totals are
  recovered by summing over hours, and no separate `dow` dim was added. Marginal
  `dow`×`hour` was rejected as a fabricated outer product.
- **Referrer grouping** → **server-side `ref_group`** (Tier B, not Tier-A client
  bucketing): consistent classification, present in the CSV export.

## What shipped

- `main.ts`: `refGroup()` (search / social / internal / direct / referral) +
  `ref_group` dim; `dowhour` joint dim; `day`/`hour`/`dow` now come from **one**
  clock read (fixes a midnight-boundary day/hour skew); `d.r || "direct"` — the
  client sends `r:""` for direct traffic, which `??` was storing as an empty
  key.
- `dashboard.html`: day×hour heatmap (sequential single-hue frost ramp, sqrt
  scale so the skewed hour distribution doesn't collapse, empty cells ringed so
  "no data" reads as a hole, labelled legend, per-cell tooltip); engagement-rate
  KPI tile (derived from the _rounded_ bounce % so the two tiles always read as
  complements); `ref_group` in `DIM_ORDER`; `CSV_DIMS = DIM_ORDER + dowhour`;
  seed refs widened to cover every bucket.
- `main_test.ts`: 4 new tests (joint counter + hour-marginal agreement, ingest
  classification incl. empty referrer, `refGroup` unit table). 13/13 pass.
- `README.md`: 12 base dims, `ref_group` + `dowhour` sections, one-clock-read
  note, Sankey non-goal with the privacy rationale, write budget 30K → **~25K
  pv/mo**.

Verified end-to-end in a browser against a local collector (real beacons → KV →
`/stats` → render), plus a synthetic full matrix to eyeball the ramp.

## Not done (deferred, unchanged from above)

- `load_ms` (Tier B) — needs a `docs-site/src/analytics.ts` client change.
- `depth` scroll-depth (Tier B, via the `ev` channel).
- All Tier C pairwise tables.
