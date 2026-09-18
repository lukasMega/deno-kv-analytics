# deno-kv-analytics

[![views](https://tst.lukasmega.deno.net/badge?site=deno-kv-analytics&total=1&label=docs%20views%2030d%20%2B%20all)](https://lukasmega.github.io/deno-kv-analytics/badge)

A very simple analytics tool: one script tag, one dashboard page. It counts
pageviews and a handful of dimensions — not sessions, funnels or user journeys —
which is exactly the level of insight a small site usually wants. Good fit for a
**GitHub Pages site** (`*.github.io`), a docs site or a personal blog: static
hosting gives you no server-side logs at all, and this fills that gap without a
cookie banner or a third-party account. This repo's own docs site is the live
example.

Cookieless pageview collector on Deno KV. No cookies, no IP storage, no
fingerprint → **no consent banner**. Stores daily aggregate counts. Runs on the
**new** Deno Deploy ([`console.deno.com`](https://console.deno.com)).

**Deploy once, track many sites.** Every counter is keyed under a `site` segment
and a request maps to a site by its Host, so each site points its own
`stats.<their-domain>` at the same deployment. Adding a site is one env var.

Add one tag to a page and you are collecting:

```html
<script defer src="https://stats.example.com/s.js" data-site="acme"></script>
```

📖 **[Documentation](https://lukasmega.github.io/deno-kv-analytics/)** ·
[Quickstart](https://lukasmega.github.io/deno-kv-analytics/quickstart) ·
[Deploy](https://lukasmega.github.io/deno-kv-analytics/deploy) ·
[Design notes](https://lukasmega.github.io/deno-kv-analytics/design) ·
[Privacy](https://lukasmega.github.io/deno-kv-analytics/privacy)

> **⚠️ Experimental project:** this is just simple, not production ready
> project. The author does not plan to add support for more features.

## See it

```bash
deno task demo
```

The real handler over an in-memory KV seeded with 30 days of deterministic fake
traffic. No account, no database, nothing written to disk.

![The dashboard: KPI tiles, trend chart, day×hour heatmap and independent per-dimension breakdowns](docs/dashboard.png)

## Run it

```bash
deno task dev     # builds the beacon, then serves http://localhost:8123
```

Then open **http://localhost:8123/help** — token `devtoken`, site `demo`. That
page probes the live server on every step, and it is the same code that deploys.

## Deploy it

1. `console.deno.com` → **New App** → your fork. Entrypoint `src/main.ts`, build
   command **empty**. Not `deployctl` — that is Deploy Classic, shut down
   2026-07-20.
2. **Databases → Provision Database → Deno KV**, then **Assign** to the app.
   Easy to miss; without it every route 500s.
3. **Settings → Environment Variables**: `SITES` and `STATS_TOKEN`. That is the
   whole required set.
4. **Settings → Domains**: `stats.<yourdomain>` + the DNS record it shows.
5. Open `/help` on the deployment and run the checks.

Step by step, with links to the official Deno docs:
**[Getting started](https://lukasmega.github.io/deno-kv-analytics/deploy)**.

## Configure it

| env var                            | what                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| `SITES`                            | **required** — allowlist, `id[:host]` comma-separated, e.g. `acme:stats.acme.dev,blog` |
| `STATS_TOKEN`                      | **required** — admin token: reads any site, the only token allowed on `/sites`         |
| `STATS_TOKEN_<ID>`                 | per-site token (`my-site` → `STATS_TOKEN_MY_SITE`); reads only that site               |
| `BADGE_SITES`                      | site ids allowed a public README badge; unset → none                                   |
| `PORT` · `KV_PATH` · `LEGACY_SITE` | self-hosting, local KV file, migration bridge                                          |

Full semantics, Host→site resolution and the operator CLI:
**[Configuration](https://lukasmega.github.io/deno-kv-analytics/configuration)**.

## Badge it

```markdown
![views](https://stats.example.com/badge?site=acme) <!-- last 30 days -->
![views](https://stats.example.com/badge?site=acme&days=all) <!-- all time -->
![views](https://stats.example.com/badge?site=acme&total=1) <!-- both -->
```

An SVG view counter for a README — the badge at the top of this file is this
collector counting its own docs site. Opt-in per site, no token, colors and
label configurable:
**[Badge](https://lukasmega.github.io/deno-kv-analytics/badge)**.

<details>
<summary><b>Tasks</b></summary>

```bash
deno task dev            # watch on :8123 (builds the beacon first)
deno task demo           # seeded UI, in-memory KV
deno task test           # main / app-ingest / sites / kv / badge / migrate / e2e
deno task build-client   # src/client/beacon.ts -> src/s.js
deno task sizes          # measure byte cost -> scripts/.sizes.csv
deno task admin -- list | size | usage --site <id> | delete --site <id> --yes
```

`mise run test|lint|check|beforeCommit` wraps the same things; `beforeCommit` is
the CI job in one command. `mise run docs` / `docs-build` drive the Docusaurus
site in `website/`.

</details>

## How it works

```mermaid
flowchart TD
  V["Visitor's page<br/>#60;script src=/s.js#62;"]
  B["Beacon<br/>client/beacon.ts"]
  C["Collector<br/>src/main.ts"]
  K[("Deno KV<br/>c · site · day · dim · value")]
  D["Dashboard /dashboard"]

  V -->|"loads /s.js"| B
  B -->|"GET /e → 1×1 gif"| C
  C -->|"bot UA → bot + bot_kind"| K
  C -->|"else → 12 pageview dims"| K
  K -->|"GET /stats + token"| D
```

A pageview writes 12 independent counters — no co-occurrence, so no cross-dim
segmentation, which is what keeps the no-consent claim true. Bots are counted,
not dropped. On the KV free tier that is ≈25K pageviews/month, shared across
every site on the deployment.

The schema, the write budget, the bot handling, the behavioral probe and the
Deno Deploy layout rules all have one home:
**[Design notes](https://lukasmega.github.io/deno-kv-analytics/design)**.

## How big is it

```bash
deno task sizes   # rebuilds the beacon, writes scripts/.sizes.csv
```

Measured, not estimated — [scripts/.sizes.csv](scripts/.sizes.csv) is the
output.

| shipped to the visitor | raw     | gzip        |
| ---------------------- | ------- | ----------- |
| client bundle (`s.js`) | 2.72 kB | **1.37 kB** |

That is the whole cost of tracking a page: 1.37 kB gzip, once, cached, plus a
43-byte gif per pageview. The collector, the dashboard and the charts never
reach a visitor. `deno task check-size` fails CI if the bundle passes 4 kB.

## Privacy

[docs/privacy-template.md](docs/privacy-template.md) is a visitor-facing privacy
note you can adapt for a site that uses this collector. It claims only what the
code actually does — keep the two in step if you extend the collector.

## License

MIT — see [LICENSE](LICENSE).
