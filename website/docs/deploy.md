---
sidebar_position: 2
title: Getting started
description: Deploy the collector to the new Deno Deploy — create the app, provision Deno KV, set env vars, map a domain, verify with /help.
---

# Getting started

End-to-end setup on the **new** Deno Deploy
([`console.deno.com`](https://console.deno.com)). Roughly ten minutes, most of
it waiting on DNS.

:::danger[Not `deployctl`]

This project targets the new Deno Deploy. **Deploy Classic**
([docs](https://docs.deno.com/deploy/classic/)) and its `deployctl` CLI shut
down 2026-07-20 — `deployctl deploy` either fails or publishes to a platform
that no longer serves traffic. The current CLI is `deno deploy`
([reference](https://docs.deno.com/runtime/reference/cli/deploy/)).

:::

## 0. Try it locally first

Cheaper to fix a mistake here than in the dashboard.

```bash
git clone https://github.com/lukasMega/deno-kv-analytics
cd deno-kv-analytics
deno task build-client   # src/client/beacon.ts -> src/s.js
deno task dev            # http://localhost:8123
```

Open **http://localhost:8123/help**, enter token `devtoken` and site `demo`, and
run the checks. That page is the same code that deploys, so a green run locally
means the deployed one will behave identically.

## 1. Create the app

Link the GitHub repo — pushes then redeploy on their own.

1. [`console.deno.com`](https://console.deno.com) → **New App** → pick your fork
   of the repo.
2. **Entrypoint**: `src/main.ts`. Not `main.ts` — the runtime assets are flat
   siblings of the entrypoint, which is why everything lives under `src/`.
3. **Install / build command**: leave both **empty**. Plain TypeScript, no build
   step. See [Builds](https://docs.deno.com/deploy/reference/builds/).
4. **Runtime mode**: dynamic (it is a server, not a static site).

Or from the terminal, per the
[CLI reference](https://docs.deno.com/runtime/reference/cli/deploy/):

```bash
deno deploy create --org <your-org> --app <your-app> \
  --source github --owner <gh-owner> --repo deno-kv-analytics \
  --runtime-mode dynamic --entrypoint src/main.ts
```

:::warning[Commit `src/s.js`]

The browser beacon is build output but **is** committed on purpose — Deploy runs
the repo with no build step. After changing `src/client/beacon.ts`, run
`deno task build-client` and commit the result, or the deployed beacon silently
lags behind its source. `mise run check-beacon` fails the build if they drift.

:::

## 2. Provision Deno KV and assign it

**This is the step that is easy to miss.** KV is not auto-provisioned; without
it `Deno.openKv()` throws on the first request and every route 500s.

**Databases → Provision Database → Deno KV**, then **Assign** it to the app.
Deploy injects the credentials, so `Deno.openKv()` takes no arguments — see
[Databases](https://docs.deno.com/deploy/reference/databases/) and the
[`Deno.openKv` API](https://docs.deno.com/api/deno/~/Deno.openKv).

Same thing from the CLI:

```bash
deno deploy database provision my-kv --kind denokv --org <your-org>
deno deploy database assign my-kv --app <your-app>
```

## 3. Set environment variables

**Settings → Environment Variables**
([reference](https://docs.deno.com/deploy/reference/env-vars-and-contexts/)):

| var                | value                                                       |
| ------------------ | ----------------------------------------------------------- |
| `SITES`            | `acme:stats.acme.dev` — the allowlist, `id[:host]`, comma-separated |
| `STATS_TOKEN`      | a long random secret; admin token, reads any site           |
| `STATS_TOKEN_<ID>` | optional per-site token (`my-site` → `STATS_TOKEN_MY_SITE`) |

Generate the admin token with something you did not think up yourself:

```bash
openssl rand -base64 32
```

Unset means **no access**, never "any token matches". Full semantics in
[Configuration](./configuration.md).

## 4. Verify before wiring up a domain

Your app is live at `https://<your-app>.deno.net`. Open
**`https://<your-app>.deno.net/help`** and run the checks with the real
`STATS_TOKEN`. On the shared `*.deno.net` host no site can claim the domain, so
the beacon needs `data-site` — that is expected here and goes away in step 5.

`GET /` returning `ok` means the app booted; if `/stats` 500s instead, KV is
unassigned (step 2).

## 5. Map a custom domain

**Settings → Domains**: add `stats.<yourdomain>` and create the DNS record it
shows ([Custom domains](https://docs.deno.com/deploy/reference/domains/)).

One app holds several custom domains — that is what makes Host-based tenancy
work, and it keeps every beacon **first-party**, which is what keeps it off
adblock filter lists.

Once the Host is mapped, the tag needs no `data-site`:

```html
<script defer src="https://stats.yourdomain/s.js"></script>
```

Migrating a domain off Deploy Classic? Follow
[that tutorial](https://docs.deno.com/examples/migrate_custom_domain_tutorial/) — the
DNS records differ.

## 6. Read the data

`https://stats.yourdomain/dashboard`, token typed into the page. Both
`/dashboard` and `/help` are served ungated on purpose: they carry no secret,
and a new operator must be able to reach `/help` before they have a token.

## Where to go next

- [Configuration](./configuration.md) — env vars, Host→site resolution, the
  operator CLI.
- [Several projects](./multiple-projects.md) — many sites on one deployment.
- [Dashboard & API](./dashboard.md) — `/stats` JSON, CSV export.
- [Privacy](./privacy.md) — what is stored, and why no consent banner.

## Watch the write budget

The free tier is roughly **300K write units/month**. A pageview writes 12 dims,
so ≈25K pageviews/month. Every dim you add is a budget change, not a cosmetic
one — see [Configuration](./configuration.md).
