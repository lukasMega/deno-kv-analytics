---
sidebar_position: 6
title: Example dashboard
description: Screenshot of the dashboard over 30 days of seeded demo traffic.
---

# Example dashboard

Run it yourself — no real data, no local KV touched:

```bash
deno task demo
```

That boots the **real** handler over an in-memory KV seeded with 30 days of
deterministic fake traffic (seeded LCG, shaped by weekday and hour so the
heatmap and trend chart actually mean something).

Below: `Last 30 days` over that seeded data.

![The dashboard: trend chart, KPI tiles, day×hour heatmap and breakdowns over 30 days of seeded traffic](/img/dashboard.png)

What is on screen, top to bottom:

- **KPI tiles** — pageviews, visitors, sessions, views/visit, bounce rate,
  engagement rate, human interaction, each with its delta against the prior
  period of equal length. The deltas read `—` in the screenshot because the
  seeded data starts exactly 30 days back: there is no prior period to compare
  against.
- **Trend chart** (uPlot, vendored — no CDN) — pageviews / visitors / sessions,
  plus a dashed `bots` line when _show bot traffic_ is on.
- **Day × hour heatmap** — rendered from the `dowhour` joint counter, the one
  pairwise dim in the schema.
- **Breakdowns** — every dim in two packed columns, top 10 per dim behind a
  _show all_ toggle, count + share of that dim's total on each row. The filter
  box searches every value and hides dims with no match.

Everything here comes from one `GET /stats?…&series=1` response; the period
selector and the bot toggle re-render the loaded payload rather than refetching.
