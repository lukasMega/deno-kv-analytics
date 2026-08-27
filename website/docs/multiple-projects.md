---
sidebar_position: 4
title: Several projects
description: Tracking a fleet of small sites — GitHub Pages projects on a shared host, one site id each, and the write budget they share.
---

# Tracking several projects

One deployment already serves many sites: every counter is keyed under a `site`
segment, each site has its own token, and `prune` walks each one separately. This
page is the reasoning; the hands-on flow, with a check after every step, lives at
**`/help`** on your own collector.

## One site id per project

GitHub Pages projects usually share a host — `user.github.io/proj-a`,
`user.github.io/proj-b`. Host-based resolution cannot separate those, so each
project gets its own id and declares it on the tag:

```html
<script defer src="https://<collector>/s.js" data-site="proj-a"></script>
```

```
SITES="proj-a,proj-b,acme:acme.dev"
STATS_TOKEN_PROJ_A=…
STATS_TOKEN_PROJ_B=…
```

A bare id in `SITES` is selectable only through `?s=` / `data-site`; `id:host`
also maps a custom domain, and on such a domain `data-site` is optional because
the Host already answers the question.

There is deliberately **no path-prefix routing** (`user.github.io/proj-a` → site
`proj-a`). It would add a second input to site resolution that page JS can
influence, to replace one attribute the operator sets once.

## Adding one is an env edit, not a deploy

Editing environment variables on Deno Deploy creates a new revision by itself —
no git push and no code change. That is why the site allowlist stays in `SITES`
rather than in a runtime registry: a registry would trade a two-field form for a
mutation endpoint, stored token hashes, and a cache-invalidation story across
isolates.

## The write budget is shared, not per site

A pageview writes 12 counters — one write unit each. The Deno KV free tier is
roughly 300K write units/month, so the **whole deployment** carries about **25K
pageviews/month**, split across every site on it. Eight projects at an even split
is ~3K pageviews each.

Two consequences worth knowing before you add the fifth project:

- Adding a **dimension** is a budget change, not a cosmetic one — it costs a
  write unit on every pageview of every site.
- One project going viral spends the shared budget. There is no per-site cap
  today; watch the pageview counts on the dashboard if that becomes a risk.

Bot hits and custom events write their own, much smaller, set of counters and
never write `pv`.

## Reading them back

`STATS_TOKEN` is the admin token: it reads any site and is the only token allowed
on `/sites`, which is what fills the dashboard's site picker. A per-site
`STATS_TOKEN_<ID>` reads exactly one site — hand it out and the holder cannot see
any other project. The check is against the *resolved* site, never against the
set of all tokens.
