# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in this repository.

## What this is

Cookieless, multi-tenant pageview collector on Deno KV, deployed to the **new**
Deno Deploy (`console.deno.com`, not `deployctl`/Deploy Classic). No cookies, no
IP, no fingerprint → no consent banner.

Docs have one home per topic and `README.md` is a landing page that links out —
do not re-explain a mechanism there. The reasoning (schema, write budget, bot
handling, behavioral probe, Deploy layout rules, repo layout) lives in
`website/docs/design.md`; env vars in `configuration.md`; deploy steps in
`deploy.md`; endpoints in `dashboard.md`. Adding the same fact to a second file
is how these drifted before. `.claude/design-notes/` holds the older
schema/bot-detection plans (gitignored, absent from a fresh clone).

## Commands

```bash
deno task dev            # build-client, then watch on :8123 (devtoken, demo:localhost:8123)
deno task demo           # seeded in-memory UI, touches no KV on disk
deno task test           # main_test sites_test kv_test badge_test e2e_test
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
deno task admin -- list | size | usage --site <id> | delete --site <id> --yes
deno task admin -- size --db <uuid>   # deployed DB; needs DENO_KV_ACCESS_TOKEN
deno task migrate -- --site <id> [--db <uuid>] [--dry-run]
```

## Architecture

All application code lives in `src/`, including runtime assets — they must stay
flat siblings of `src/main.ts` (see Deploy invariant). `scripts/` holds build
tooling that never ships.

- `src/main.ts` — routing, ingest and KV reads: `eq`, `readStats`, `prune` +
  `createHandler(kv, sites)`. `Deno.serve`/`Deno.cron` run only under
  `import.meta.main` so tests can import the handler; on Deploy that guard is
  true, so the cron still registers at module top level.
- `src/classify.ts` — request → dimension values: `parseUA`, `botKind`,
  `refGroup`, `country`, `clamp` (the 128-char cap). Pure and separately
  testable; owns the isbot dependency.
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
- `src/kv.ts` — `openKv()`, the single answer to "which database". A bare
  `Deno.openKv()` keys its local sqlite file to the _calling script's_ origin,
  so main/admin/migrate each opened a different one and `admin list` came back
  empty during dev. `KV_PATH` (set to `local.db` in the local tasks) pins one
  file; `--db <uuid>` targets the deployed database; neither set keeps the bare
  call, which is what Deploy needs. Also exports `taskArgs()`: both CLIs must
  parse through it, because `deno task x -- …` forwards a literal `--` that
  parseArgs reads as the end-of-flags terminator, silently dropping every flag.
- `src/badge.ts` — README badge SVG: `badgeSvg`, `formatCount`, `safeLabel`,
  `safeColor`. Pure (no KV, no Deno API); `main.ts` owns the `/badge` route and
  the reading.

Routes: `GET /e` (beacon → 1×1 gif), `/stats`, `/sites`, `/badge`, `/dashboard`,
`/help`, `/s.js`, `/vendor/uPlot.*`, the `UI_ASSETS` table (`/dashboard.css`,
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

**One key lives outside that prefix: `["t", site, "pv"]`** (`totalKey` in
`main.ts`), the all-time pageview count behind `/badge?days=all`. It is separate
precisely so `prune` cannot delete it, and it is written only for sites in
`BADGE_SITES` — a site with no badge pays no write unit for it. Anything that
walks a site's data must walk **both** prefixes: `admin.ts` `deleteSite` and
`sizeOf` do, and an erasure that missed `["t", site]` would leave a live total
behind.

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

**`/badge` is the only unauthenticated read.** Opt-in per site via `BADGE_SITES`
(unset → no badge, never "all sites"), and it exposes only `pv` counts: a
clamped window (`days`, point `getMany`s, never `readStats`), the all-time total
(`days=all`, one `get` on `totalKey`), or both (`total=1`). A site that did not
opt in returns the same 404 as one that does not exist — otherwise the badge
enumerates site ids. Widening it to another dim reopens the authenticated-read
boundary. Every `?color=`/`?labelColor=`/`?totalColor=` goes through `safeColor`
and `?label=` through `safeLabel` before it reaches the SVG.

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
