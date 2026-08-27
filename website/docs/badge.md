---
sidebar_position: 7
title: README badge
description: A public SVG view-counter badge for a README — opt-in per site, one number, no token.
---

# README badge

`GET /badge` renders a shields-style SVG from one number: the site's `pv` total
over a window.

```markdown
![views](https://stats.example.com/badge?site=acme)
```

![views (30d) 12](/img/badge.svg)

## Turn it on

Set `BADGE_SITES` to the ids that may be counted publicly:

```
BADGE_SITES=acme,blog
```

Unset means **no site has a badge** — the same rule as the stats tokens: unset is
"no access", never "everything matches". A site that did not opt in returns the
same **404** as a site that does not exist, so the endpoint cannot be used to
enumerate ids.

The badge is the only unauthenticated read in the collector, which is why it is
deliberately narrow: one dim (`pv`), one site, one number. No path list, no
referrers, no bot or event data, and no parameter that widens it.

## Parameters

| param | default | notes |
| --- | --- | --- |
| `site` | resolved from Host | needed on the shared `*.deno.net` host; ignored when a mapped custom domain already resolves the site |
| `days` | `30` | window, today inclusive; clamped to 1…400 (`RETENTION_DAYS`) |
| `label` | `views (<days>d)` | max 24 chars, `[\w .%+-]` only |
| `color` | `0b6bcb` | hex, 3 or 6 digits |

```markdown
![hits](https://stats.example.com/badge?site=acme&days=400&label=all%20time&color=8957e5)
```

400 days is as far back as the badge can reach because `prune` deletes older
counters — see [Design notes](./design.md).

## What it does not do

It is **not** a hit counter. GitHub proxies README images through Camo, which
caches them and fetches on GitHub's behalf, so a README view neither reaches your
collector nor increments anything. The number shown is what the
[beacon](./dashboard.md) already collected on your site; the badge only displays
it.

For the same reason the response is cached for 5 minutes — a shorter TTL would
buy nothing against Camo's own caching.

## Cost

Point reads (`getMany`, 10 keys per call), so a 30-day badge is 3 KV round trips
and **zero writes**. It adds no dim, so it does not touch the write budget that
[Design notes](./design.md) accounts for.
