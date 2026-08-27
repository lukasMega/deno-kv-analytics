---
sidebar_position: 1
slug: /
title: Introduction
description: Cookieless, multi-tenant pageview collector on Deno KV — no cookies, no IP storage, no fingerprint, no consent banner.
---

# deno-kv-analytics

Cookieless pageview collector on Deno KV. No cookies, no IP storage, no
fingerprint → **no consent banner**. Stores daily aggregate counts. Runs on the
**new** Deno Deploy (`console.deno.com`).

**Deploy once, track many sites.** Every counter is keyed under a `site`
segment, and a request is mapped to a site by its Host — so each site points its
own `stats.<their-domain>` at the same deployment, and adding a site is one env
var.

Add one tag to a page and you are collecting:

```html
<script defer src="https://stats.example.com/s.js" data-site="acme"></script>
```

On a mapped custom domain, `data-site` is not needed — the collector resolves
the site from the request Host.

## Local run

```bash
deno task build-client   # src/client/beacon.ts -> src/s.js
deno task dev            # http://localhost:8123  (STATS_TOKEN=devtoken, SITES=demo:localhost:8123)
```

Then open **http://localhost:8123/help** — the same code that deploys. Enter
token `devtoken` and site `demo`, run the checks, send a beacon (or "Seed 30
random"), then switch to **/dashboard** to read it back.

To browse a populated UI without any real data, `deno task demo` boots the real
handler over an in-memory KV seeded with 30 days of deterministic fake traffic.
See [Example dashboard](./example.md).

## What a pageview stores

`key = ["c", site, day, dim, value]`, `value = bigint` via
`kv.atomic().sum(key, 1n)`, one atomic commit per hit. Dims are counted
**independently** — no co-occurrence, so no cross-dim segmentation. That is
exactly what keeps the no-consent claim true.

A pageview always writes 12 dims: `pv`, `path`, `host`, `ref`, `ref_group`,
`lang`, `tz`, `browser`, `os`, `device`, `hour`, `dowhour`. Plus, when present:
`country` (only if a fronting CDN sets a country header — bare Deno Deploy
exposes no visitor geo, and no IP is ever read or stored), `viewport`, `utm_*`,
and the localStorage-derived flags `uv`, `sessions`, `bounce`.

Every stored value is clamped to 128 chars, so a hostile or buggy client cannot
inflate KV cost.

### Write budget

Free tier ≈ 300K write units/mo ÷ 12 base pageview dims ≈ **~25K pageviews/mo**.
Most pageviews also arm the behavioral probe, which — if it fires — costs one
more write unit, so budget ~23K pv/mo for engaged traffic. The budget is
**shared across every site** on the deployment. Adding a dim is a budget change,
not a cosmetic one.

A top-level `Deno.cron` prunes days older than 400, per site.

## Bots are counted, not dropped

A hit whose User-Agent matches [`isbot`](https://github.com/omrilotan/isbot)
writes `bot["ua"]` and `bot_kind[<match>]` instead of `pv`, then gets the same
1×1 gif so behavior is unchanged for the caller. That makes the filter tunable
against real traffic instead of guesswork.

## Non-goal: user-flow Sankey

A multi-hop flow diagram needs per-visitor page sequences, which requires a
cookie or fingerprint — that would break the no-consent-banner model, so it will
not be built.
