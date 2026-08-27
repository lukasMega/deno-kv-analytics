# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in this repository.

## What this is

Cookieless, multi-tenant pageview collector on Deno KV, deployed to the **new**
Deno Deploy (`console.deno.com`, not `deployctl`/Deploy Classic). No cookies, no
IP, no fingerprint → no consent banner. `README.md` covers the data model,
tenancy and privacy reasoning in depth and is current. `.claude/design-notes/`
holds the older schema/bot-detection plans (gitignored, absent from a fresh
clone).

## Commands

```bash
deno task dev            # watch on :8123, STATS_TOKEN=devtoken, SITES=demo:localhost:8123
deno task test           # main_test.ts sites_test.ts e2e_test.ts
deno task build-client   # src/client/beacon.ts -> src/s.js (minified IIFE)
deno task check-size     # fails if src/s.js > 4096 bytes
deno fmt && deno lint
deno test --allow-env --filter "prune walks every site" src/sites_test.ts
```

Bare `deno test` fails — the suite needs `--allow-env`, hence the task. KV/cron
come from `unstable: ["kv","cron"]` in deno.json, so no `--unstable-*` flags.

`mise.toml` wraps the same tasks (`mise run test|lint|check|beforeCommit`);
`beforeCommit` is the CI job in one command. `mise run docs`/`docs-build` drive
the Docusaurus site in `website/`, kept out of `beforeCommit` so the Deno CI job
needs no Node toolchain.

The docs site's beacon is configured by two build-time env vars,
`COLLECTOR_ORIGIN` (scheme optional) and `COLLECTOR_SITE_ID`, supplied as
**repo-level** Actions variables. Never hardcode the host — not even split
across expressions, which still reconstructs it. Unset omits the beacon tag
entirely; emitting `src="undefined/s.js"` is the failure this guards, and it
404s on every page without failing the build.

Operator tooling (raw KV, not HTTP):

```bash
deno task admin -- list | usage --site <id> | delete --site <id> --yes
deno task migrate -- --site <id> [--dry-run]
```

## Architecture

All application code lives in `src/`, including runtime assets — they must stay
flat siblings of `src/main.ts` (see Deploy invariant). `scripts/` holds build
tooling that never ships.

- `src/main.ts` — pure helpers (`parseUA`, `botKind`, `refGroup`, `eq`,
  `readStats`, `prune`) + `createHandler(kv, sites)`. `Deno.serve`/`Deno.cron`
  run only under `import.meta.main` so tests can import the handler; on Deploy
  that guard is true, so the cron still registers at module top level.
- `src/sites.ts` — tenancy: `loadSites()` parses `SITES`, `resolveSite()` maps a
  request to a site id, `tokenFor()` maps an id to its env var.
- `src/client/beacon.ts` — browser script, built to `src/s.js`, served at
  `/s.js`. Edit the `.ts`; `s.js` is generated (fmt/lint-excluded). The
  `client/` subdir is safe: build input, never read at runtime.
- `src/dashboard.html` — `/dashboard` markup; logic in `src/dashboard.js` (+
  `src/dash-charts.js` for the uPlot trend chart and day×hour heatmap), styles
  in `src/dashboard.css`. Fetches `/stats` and `/sites`.
- `src/help.html` / `src/help.js` — guided setup at `/help`. Each step checks
  itself against `/`, `/stats`, `/sites`; no endpoint exists only for the
  tutorial, so it cannot drift from the server. Hosts the test-beacon/seed tool
  that used to live in the dashboard.
- `src/da-common.js` — token/site controls and `statsFetch`, shared by both
  pages. Contract: the importing page has `#token` and `#site` inputs.
- `src/admin.ts` / `src/migrate.ts` — CLI; both export their functions for
  tests.

Routes: `GET /e` (beacon → 1×1 gif), `/stats`, `/sites`, `/dashboard`, `/help`,
`/s.js`, `/vendor/uPlot.*`, the `UI_ASSETS` table (`/dashboard.css`,
`/dashboard.js`, `/dash-charts.js`, `/da-common.js`, `/help.js`), `/` → `ok`.
Both HTML pages are ungated: they carry no secret, the token is typed in, and a
new operator must reach `/help` before they have one.

## Invariants that break silently if violated

**Deploy bundles only flat siblings of the entrypoint.** `dashboard.html`,
`help.html`, `dashboard.css`, `dashboard.js`, `dash-charts.js`, `da-common.js`,
`help.js`, `s.js`, `uPlot.iife.min.js`, `uPlot.min.css` must stay next to
`src/main.ts` and be read via `new URL("./x", import.meta.url)` +
`Deno.readTextFile`. Subdirectories are not uploaded and `with { type: "text" }`
is ignored at runtime — hence no `src/vendor/`, hence the entrypoint is
`src/main.ts`, hence `deno.json` scopes excludes to `fmt`/`lint` only (a
top-level `exclude` drops files from the upload and they 404).

**KV key = `["c", site, day, dim, value]`, exactly 5 segments**, value a bigint
via `kv.atomic().sum(key, 1n)`. Reads filter on `key.length` because a site id
may legitimately look like a date and collide with the 4-segment legacy prefix.

**Dims are counted independently** — no co-occurrence, so no cross-dim
segmentation, which is what keeps the no-consent claim true. One deliberate
exception: `dowhour` (`"<dow>-<hh>"`) is a real joint counter for the heatmap.
Do not add a second pairwise dim without accepting the same tradeoff.

**Every added dim costs a write unit per pageview.** Free tier ≈ 300K write
units/mo; 12 base pageview dims ≈ 25K pv/mo. Adding a dim is a budget change.

**A null site writes nothing.** `resolveSite` returning `null` must still return
the gif (never a 4xx — a prober must not learn which sites exist) and must not
write, or anyone could mint unbounded KV prefixes on the shared budget.

**Tenancy boundary:** `/stats` checks the per-site token against the _resolved_
site only, never against the set of all tokens. `STATS_TOKEN` is admin (reads
any site, only token allowed on `/sites`); `STATS_TOKEN_<ID>` is per-site
(`my-site` → `STATS_TOKEN_MY_SITE`). Unset must mean "no access", never "any
token matches".

**`prune` loops per site.** Keys sort by site then day, so the "first in-range
day → stop" early exit is only valid inside one site's prefix.

**Bots are counted, not dropped**: `bot["ua"]` + `bot_kind[<token>]`, never
`pv`. `hi` (behavioral probe) and `bot["synthetic"]` are their own dims and stay
out of `event`/`event_target`.

**Every value is clamped to 128 chars** before it reaches a key.

## Migration state (temporary)

`LEGACY_SITE=<id>` makes `readStats` read _and sum_ both the 4- and 5-segment
layouts while `migrate.ts` rekeys. `migrate` copies+deletes in one atomic tx per
key and uses `.sum()` not `.set()`, so it is crash-safe and rerunnable. Once
`--dry-run` reports 0 legacy keys, unset the env var and delete that branch in
`readStats`.

## Conventions

- Tests use `Deno.openKv(":memory:")` and set env vars (`STATS_TOKEN`, `SITES`,
  `LEGACY_SITE`) at module top level; they drive `createHandler` with real
  `Request` objects rather than starting a server.
- Comments explain _why_ a non-obvious choice was made (Deploy quirks, privacy
  tradeoffs, write cost). Match that, and update the comment when the reasoning
  changes.
- Files stay under ~550 lines; extract a new module rather than growing
  `main.ts`.
- `npm:`/`jsr:` specifiers go in `deno.json` imports, not inline — `deno lint`
  rejects inline ones.
