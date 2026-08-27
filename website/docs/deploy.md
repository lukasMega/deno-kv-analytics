---
sidebar_position: 3
title: Getting started
description: Deploy the collector to the new Deno Deploy — create the app, provision Deno KV, set two env vars, map a domain, verify with /help.
---

# Getting started

End-to-end setup on the **new** Deno Deploy
([`console.deno.com`](https://console.deno.com)). Roughly ten minutes, most of it
waiting on DNS.

Try it locally first — [Quickstart](./quickstart.md) is two commands and it is
cheaper to fix a mistake there than in the console.

:::danger[Not `deployctl`]

This project targets the new Deno Deploy. **Deploy Classic**
([docs](https://docs.deno.com/deploy/classic/)) and its `deployctl` CLI shut down
2026-07-20 — `deployctl deploy` either fails or publishes to a platform that no
longer serves traffic. The current CLI is `deno deploy`
([reference](https://docs.deno.com/runtime/reference/cli/deploy/)).

:::

## 1. Create the app

Link the GitHub repo — pushes then redeploy on their own.

1. [`console.deno.com`](https://console.deno.com) → **New App** → pick your fork
   of the repo.
2. **Entrypoint**: `src/main.ts`. Not `main.ts` — runtime assets must be flat
   siblings of the entrypoint, which is why everything lives under `src/` ([why](./design.md#deploy-layout-assets-must-be-flat-siblings)).
3. **Install / build command**: leave both **empty**. Plain TypeScript, no build
   step. See [Builds](https://docs.deno.com/deploy/reference/builds/).
4. **Runtime mode**: dynamic (it is a server, not a static site).

<details>
<summary><b>Same thing from the terminal</b></summary>

Per the [CLI reference](https://docs.deno.com/runtime/reference/cli/deploy/):

```bash
deno deploy create --org <your-org> --app <your-app> \
  --source github --owner <gh-owner> --repo deno-kv-analytics \
  --runtime-mode dynamic --entrypoint src/main.ts
```

</details>

:::warning[Commit `src/s.js`]

The browser beacon is build output but **is** committed on purpose — Deploy runs
the repo with no build step. After changing `src/client/beacon.ts`, run
`deno task build-client` and commit the result, or the deployed beacon silently
lags behind its source. `mise run check-beacon` fails the build if they drift.

:::

## 2. Provision Deno KV and assign it

**This is the step that is easy to miss.** KV is not auto-provisioned; without it
`Deno.openKv()` throws on the first request and every route 500s.

**Databases → Provision Database → Deno KV**, then **Assign** it to the app.
Deploy injects the credentials, so `Deno.openKv()` takes no arguments — see
[Databases](https://docs.deno.com/deploy/reference/databases/) and the
[`Deno.openKv` API](https://docs.deno.com/api/deno/~/Deno.openKv).

<details>
<summary><b>Same thing from the terminal</b></summary>

```bash
deno deploy database provision my-kv --kind denokv --org <your-org>
deno deploy database assign my-kv --app <your-app>
```

</details>

## 3. Set two environment variables

**Settings → Environment Variables**
([reference](https://docs.deno.com/deploy/reference/env-vars-and-contexts/)):

| var | value |
| --- | --- |
| `SITES` | `acme:stats.acme.dev` — the allowlist, `id[:host]`, comma-separated |
| `STATS_TOKEN` | a long random secret; the admin token, reads any site |

That is the whole required set. Generate the token with something you did not
think up yourself:

```bash
openssl rand -base64 32
```

Everything else is optional — per-site tokens, `PORT`, the migration bridge. See
[Configuration](./configuration.md).

## 4. Verify with `/help`

Your app is live at `https://<your-app>.deno.net`. Open
**`https://<your-app>.deno.net/help`** and run the checks with the real
`STATS_TOKEN`.

Each step probes the running server rather than describing what should happen, so
a green run is the deployment actually working. `GET /` returning `ok` means the
app booted; if `/stats` 500s instead, KV is unassigned (step 2).

On the shared `*.deno.net` host no site can claim the domain, so the beacon needs
`data-site` here. That goes away in step 5.

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
[that tutorial](https://docs.deno.com/examples/migrate_custom_domain_tutorial/) —
the DNS records differ.

## 6. Read the data

`https://stats.yourdomain/dashboard`, token typed into the page. Both
`/dashboard` and `/help` are served ungated on purpose: they carry no secret, and
a new operator must be able to reach `/help` before they have a token.

## Next

- [Configuration](./configuration.md) — all env vars, Host→site resolution, the
  operator CLI.
- [Several projects](./multiple-projects.md) — many sites on one deployment.
- [Dashboard & API](./dashboard.md) — `/stats` JSON, CSV export.
- [Design notes](./design.md) — the write budget you are now spending.
