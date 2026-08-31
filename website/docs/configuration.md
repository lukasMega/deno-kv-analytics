---
sidebar_position: 4
title: Configuration
description: Environment variables, the site allowlist, Host to site resolution, and the operator CLI.
---

# Configuration

## Required

| env var | what |
| --- | --- |
| `SITES` | allowlist, `id[:host]` comma-separated — e.g. `acme:stats.acme.dev,blog` |
| `STATS_TOKEN` | **admin** token: reads any site, the only token allowed on `/sites` |

Site ids match `^[a-z0-9][a-z0-9_-]{0,31}$`. A malformed or duplicate entry
throws at boot rather than silently creating a site nobody writes to.

## Optional

| env var | what |
| --- | --- |
| `STATS_TOKEN_<ID>` | per-site token (`my-site` → `STATS_TOKEN_MY_SITE`); reads only that site |
| `PORT` | listen port for a self-hosted run; unset lets Deno pick (Deploy sets it) |
| `KV_PATH` | pins one local sqlite file for every local task ([why](./design.md#which-database-a-process-opens)); Deploy never sets it |
| `LEGACY_SITE` | migration bridge only — see [below](#migrating-from-the-single-site-layout) |
| `BADGE_SITES` | comma-separated site ids allowed a public README [badge](./badge.md); unset → none. Also switches on that site's all-time counter (+1 write unit per pageview) |

Unset must mean "no access" — never "any token matches".

## How a request is mapped to a site

1. **The request Host**, if a site claims that domain. Preferred: the Host is not
   settable by page JS, so a page cannot claim to be a different tenant, and a
   consumer on their own `stats.` subdomain needs no client config at all.
2. **`?s=`** (beacon) / **`?site=`** (stats), but only for an allowlisted id —
   the fallback for the shared `*.deno.net` hostname and for local dev.
3. **The only configured site**, if exactly one exists (single-tenant setup).

Unresolved → the beacon writes **nothing** and still returns the same 1×1 gif.
Not a 4xx: the response must not tell a prober which sites exist, and a
misconfigured consumer should degrade to a no-op rather than to a broken image on
every page. An open site param would also let anyone mint unbounded KV prefixes
on the shared write budget, which is why the allowlist is not optional.

## Adding a site

1. Append `id:stats.theirdomain` to `SITES`.
2. Add their domain under Settings → Domains.
3. Give them the tag:
   `<script defer src="https://stats.theirdomain/s.js"></script>` (no `data-site`
   needed once the Host is mapped).
4. Optionally set `STATS_TOKEN_<ID>` so they can read their own stats without the
   admin token.

Editing environment variables on Deno Deploy creates a new revision by itself —
no git push, no code change.

For projects that share a host (several GitHub Pages repos under one
`user.github.io`), see [Several projects](./multiple-projects.md). The `/help`
page on your own collector walks the same steps and verifies each one.

## Operator CLI

Raw KV, not HTTP:

```bash
deno task admin -- list                        # site ids that actually hold data
deno task admin -- size                        # approx stored bytes, per site
deno task admin -- usage --site acme           # key count + day range
deno task admin -- delete --site acme --yes    # irreversible: erase one tenancy
```

Any command takes `--db <uuid>` to run against the **deployed** database instead
of the local one; that needs `DENO_KV_ACCESS_TOKEN`. Without it you are looking
at whatever `deno task dev` wrote on this machine.

<details>
<summary><b>How accurate is <code>size</code>?</b></summary>

An estimate. KV exposes no size API — the billed number lives only in the Deploy
console — so it walks the rows and adds up key and value lengths. Index and
replication overhead are invisible from userland, so the real figure is higher.
Good enough to answer "are we near the free tier", not for billing. It costs a
read unit per 4 KiB scanned, so it is not a cron-friendly call.

</details>

`delete` exists because "please remove my data" should be a one-liner, not an
improvisation — the site is a KV prefix.

## Migrating from the single-site layout

Only relevant if you ran this collector before it was multi-tenant: existing keys
are `["c", day, dim, value]` and must become `["c", site, day, dim, value]`.

<details>
<summary><b>The five-step procedure</b></summary>

1. Set `LEGACY_SITE=<site>` on the deployment **before** migrating. `/stats` then
   reads _and sums_ both layouts, so the dashboard stays correct throughout.
2. `deno task migrate -- --site <site> --dry-run` — check the key count.
3. Capture the current totals for a settled past day (`/stats?from=…&to=…`). That
   file is your rollback evidence.
4. `deno task migrate -- --site <site>`. It copies and deletes in one atomic tx
   per key — crash-safe, and rerunnable because a rerun simply finds fewer legacy
   keys. It uses `.sum()`, not `.set()`, so hits arriving mid-migration are added
   to rather than overwritten by the migrated count.
5. Verify the totals match, re-run `--dry-run` until it reports 0, then unset
   `LEGACY_SITE`.

</details>
