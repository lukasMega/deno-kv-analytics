---
sidebar_position: 7
title: README badge
description: A public SVG view-counter badge for a README — opt-in per site, one number, no token.
---

# README badge

`GET /badge` renders a shields-style SVG from one number: the site's `pv` total
over a window — raw page loads, not unique visitors (see
[Design notes](./design.md)).

```markdown
![views](https://stats.example.com/badge?site=acme)
```

![views (30d) 12](/img/badge.svg)

## Turn it on

Set `BADGE_SITES` to the ids that may be counted publicly:

```
BADGE_SITES=acme,blog
```

Unset means **no site has a badge** — the same rule as the stats tokens: unset
is "no access", never "everything matches". A site that did not opt in returns
the same **404** as a site that does not exist, so the endpoint cannot be used
to enumerate ids.

Opting a site in also switches on its **all-time counter** (below), which costs
one write unit per pageview. Sites left out of `BADGE_SITES` pay nothing.

The badge is the only unauthenticated read in the collector, which is why it is
deliberately narrow: one dim (`pv`), one site, one or two numbers. No path list,
no referrers, no bot or event data, and no parameter that widens it to another
dim.

## All-time views

`days` counts a rolling window, so it can never reach past the 400-day retention
limit. `days=all` reads a separate lifetime counter instead — its own key
outside the day-keyed prefix, so `prune` never touches it:

```markdown
![views](https://stats.example.com/badge?site=acme&days=all)
```

`total=1` puts both numbers in one image — window on the left, all-time on the
right:

```markdown
![views](https://stats.example.com/badge?site=acme&total=1)
```

:::note

The counter starts at **0** the moment the site is added to `BADGE_SITES`.
Pageviews collected before that are not backfilled, so on an existing site "all
time" means "since you turned the badge on". Use `days=400` if you want the
history that is still in KV.

:::

## Parameters

| param        | default                | notes                                                                                                 |
| ------------ | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `site`       | resolved from Host     | needed on the shared `*.deno.net` host; ignored when a mapped custom domain already resolves the site |
| `days`       | `30`                   | window, today inclusive; clamped to 1…400 (`RETENTION_DAYS`). `all` → the lifetime counter            |
| `total`      | `0`                    | `1` adds a second box with the all-time count; ignored when `days=all`                                |
| `label`      | depends on the above   | max 24 chars, `[\w .%+-]` only                                                                        |
| `color`      | `0b6bcb`               | value box, hex 3 or 6 digits                                                                          |
| `totalColor` | `8957e5`               | the all-time box, only with `total=1`                                                                 |
| `labelColor` | `555`                  | the label box                                                                                         |

Anything that is not a valid hex color falls back to the default rather than
reaching the SVG.

```markdown
![hits](https://stats.example.com/badge?site=acme&days=all&label=all%20time&color=8957e5)
```

400 days is as far back as the *window* can reach because `prune` deletes older
counters — see [Design notes](./design.md).

## What it does not do

It is **not** a hit counter. GitHub proxies README images through Camo, which
caches them and fetches on GitHub's behalf, so a README view neither reaches
your collector nor increments anything. The number shown is what the
[beacon](./dashboard.md) already collected on your site; the badge only displays
it.

For the same reason the response is cached for 5 minutes — a shorter TTL would
buy nothing against Camo's own caching.

## Cost

Point reads (`getMany`, 10 keys per call), so a 30-day badge is 3 KV round trips
and **zero writes**. `days=all` is a single `get`, which is why the lifetime
counter exists at all — summing 400 day keys would be 40 round trips per render.

The one cost is on the write side: a site in `BADGE_SITES` writes 13 counters
per pageview instead of 12. See the [write budget](./design.md#write-budget).
