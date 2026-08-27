---
sidebar_position: 3
title: Configuration
description: Environment variables, site allowlist, Host to site resolution, and deploying to the new Deno Deploy.
---

# Configuration

| env var            | what                                                                     |
| ------------------ | ------------------------------------------------------------------------ |
| `SITES`            | allowlist, `id[:host]` comma-separated — e.g. `acme:stats.acme.dev,blog` |
| `STATS_TOKEN`      | **admin** token: reads any site, the only token allowed on `/sites`      |
| `STATS_TOKEN_<ID>` | per-site token (`my-site` → `STATS_TOKEN_MY_SITE`); reads only that site |
| `LEGACY_SITE`      | migration bridge only — see below                                       |

Site ids match `^[a-z0-9][a-z0-9_-]{0,31}$`. A malformed or duplicate entry
throws at boot rather than silently creating a site nobody writes to.

Unset must mean "no access" — never "any token matches".

## How a request is mapped to a site

1. **The request Host**, if a site claims that domain. Preferred: the Host is
   not settable by page JS, so a page cannot claim to be a different tenant, and
   a consumer on their own `stats.` subdomain needs no client config at all.
2. **`?s=`** (beacon) / **`?site=`** (stats), but only for an allowlisted id —
   the fallback for the shared `*.deno.net` hostname and for local dev.
3. **The only configured site**, if exactly one exists (single-tenant setup).

Unresolved → the beacon writes **nothing** and still returns the same 1×1 gif.
Not a 4xx: the response must not tell a prober which sites exist, and a
misconfigured consumer should degrade to a no-op rather than to a broken image
on every page. An open site param would also let anyone mint unbounded KV
prefixes on the shared write budget, which is why the allowlist is not optional.

## Adding a site

1. Append `id:stats.theirdomain` to `SITES`.
2. Add their domain under Settings → Domains.
3. Give them the tag:
   `<script defer src="https://stats.theirdomain/s.js"></script>` (no
   `data-site` needed once the Host is mapped).
4. Optionally set `STATS_TOKEN_<ID>` so they can read their own stats without
   the admin token.

For projects that share a host (several GitHub Pages repos under one
`user.github.io`), see [Several projects](./multiple-projects.md). The `/help`
page on your own collector walks the same steps and verifies each one.

## Deploy (new Deno Deploy — `console.deno.com`)

1. `deno task build-client`, commit `src/s.js`, then `deno deploy` — or link the
   GitHub repo in `console.deno.com`, point at `src/main.ts`, leave the build
   command empty (plain TS, no build step). **Do not** use `deployctl` — that is
   Deploy Classic only (shut down 2026-07-20).
2. **Databases → Provision Database → Deno KV**, then **Assign** to the app. KV
   is not auto-provisioned; without this `Deno.openKv()` fails.
3. **Settings → Environment Variables**: `SITES`, `STATS_TOKEN` (long random
   secret), and a `STATS_TOKEN_<ID>` per site you want to hand out separately.
4. **Settings → Domains**: add `stats.<yourdomain>` + the shown DNS record, for
   **each** site. One app can hold several custom domains — that is what makes
   Host-based resolution work, and it keeps every beacon first-party, which is
   what keeps it off adblock filter lists.

:::warning[Deploy caveat]

Asset files must live **flat** beside the entrypoint `src/main.ts` — not in a
subdirectory — and be read with `Deno.readTextFile`. Deno Deploy bundles sibling
`new URL` files but skips subdirectories, and ignores `with { type: "text" }` at
runtime. That applies to `src/s.js`, the uPlot pair, and every file the UI is
built from: `dashboard.html`, `help.html`, `dashboard.css`, `dashboard.js`,
`dash-charts.js`, `da-common.js`, `help.js`.

It is also why `deno.json` scopes its excludes to `fmt`/`lint` only: a top-level
`exclude` is honored by the Deploy upload and silently drops those files (they
404).

:::

## Operator CLI

Raw KV, not HTTP:

```bash
deno task admin -- list                        # site ids that actually hold data
deno task admin -- usage --site acme           # key count + day range
deno task admin -- delete --site acme --yes    # irreversible: erase one tenancy
```

`delete` exists because "please remove my data" should be a one-liner, not an
improvisation — the site is a KV prefix.

## Migrating from the single-site layout

If you ran this collector before it was multi-tenant, existing keys are
`["c", day, dim, value]` and must become `["c", site, day, dim, value]`.

1. Set `LEGACY_SITE=<site>` on the deployment **before** migrating. `/stats`
   then reads _and sums_ both layouts, so the dashboard stays correct
   throughout.
2. `deno task migrate -- --site <site> --dry-run` — check the key count.
3. Capture the current totals for a settled past day (`/stats?from=…&to=…`).
   That file is your rollback evidence.
4. `deno task migrate -- --site <site>`. It copies and deletes in one atomic tx
   per key — crash-safe, and rerunnable because a rerun simply finds fewer
   legacy keys. It uses `.sum()`, not `.set()`, so hits arriving mid-migration
   are added to rather than overwritten by the migrated count.
5. Verify the totals match, re-run `--dry-run` until it reports 0, then unset
   `LEGACY_SITE`.
