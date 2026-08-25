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

## Files

| file               | what                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------- |
| `main.ts`          | collector: `/e`, `/stats`, `/sites`, `/s.js`, `/dashboard`                            |
| `sites.ts`         | site allowlist, Host→site resolution, per-site tokens                                 |
| `client/beacon.ts` | browser beacon → built to `s.js`, served at `/s.js`                                   |
| `migrate.ts`       | one-shot rekey of pre-multi-site data                                                 |
| `admin.ts`         | operator CLI: list / usage / delete a site                                            |
| `dashboard.html`   | UI served at `/dashboard`                                                             |
| `*_test.ts`        | round-trip tests over in-memory KV (`deno task test`)                                 |
| `uPlot.*`          | vendored uPlot js+css (flat, sibling of `main.ts` — see below), served at `/vendor/*` |
| `deno.json`        | tasks + `unstable: [kv, cron]`                                                        |

## Local run (real KV, SQLite-backed)

```bash
deno task build-client   # client/beacon.ts -> s.js
deno task dev            # http://localhost:8000  (STATS_TOKEN=devtoken, SITES=demo:localhost:8000)
```

Then open **http://localhost:8000/dashboard** — the same code that deploys. Pick
the site (`demo`), send a beacon (or "Seed 30 random"), then Load with token
`devtoken`.

## Configuration

| env var            | what                                                                            |
| ------------------ | ------------------------------------------------------------------------------- |
| `SITES`            | allowlist, `id[:host]` comma-separated — e.g. `acme:stats.acme.dev,blog`        |
| `STATS_TOKEN`      | **admin** token: reads any site, the only token allowed on `/sites`             |
| `STATS_TOKEN_<ID>` | per-site token (`my-site` → `STATS_TOKEN_MY_SITE`); reads only that site        |
| `LEGACY_SITE`      | migration bridge only — see [Migrating](#migrating-from-the-single-site-layout) |

Site ids match `^[a-z0-9][a-z0-9_-]{0,31}$`. A malformed or duplicate entry
throws at boot rather than silently creating a site nobody writes to.

### How a request is mapped to a site

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

## Endpoints

- **`GET /s.js`** — the browser beacon (built from `client/beacon.ts`, ~2.8KB
  minified). Config comes off the script tag: `data-site` (optional on a mapped
  custom domain) and `data-dev="1"` to collect from localhost, which is
  otherwise skipped. The endpoint is the script's own origin, so the beacon is
  always first-party to whatever domain served it.
- **`GET /e?s=<site>&v=<base64>`** — beacon, sent as a 1×1 gif-pixel image
  request (adblock resilience).
  `v = base64(encodeURIComponent(JSON.stringify({p,r,l,ls,tz,…})))`; fields: `p`
  path, `h` origin, `r` referrer host, `l` language, `ls` languages, `tz` IANA
  timezone, `vw` viewport bucket, `utm_*`, the `u`/`s`/`b` visit flags, and `z`
  (a random cache-buster — see below). Bland `/e` path + opaque `v` token dodge
  EasyPrivacy's generic `/i.gif?` pixel rule. Browser/OS derived from the
  request `user-agent` header **server-side** (client UA ignored). Bots are
  detected via [`npm:isbot`](https://github.com/omrilotan/isbot) (covers the
  JS-capable set a hand-rolled UA regex misses — headless Chromium,
  `Chrome-Lighthouse`, AI crawlers like GPTBot/ClaudeBot/PerplexityBot,
  `facebookexternalhit`, …) and **counted, not silently dropped** — see
  `bot`/`bot_kind` below — then served the same → **1×1 gif** (`image/gif`).
- **`GET /stats?site=<id>&day=YYYY-MM-DD`** — JSON counts. Auth via
  `Authorization: Bearer <token>` (dashboard — keeps the secret out of access
  logs) **or** `?token=…` (curl convenience); the admin token or that site's own
  token. `day` defaults to today (UTC). Range: `&from=YYYY-MM-DD&to=YYYY-MM-DD`
  (inclusive) merges into totals; days are read in parallel. Add `&series=1` to
  also get a per-day series (`series: [[day, pv, uv, sessions, bot], …]`) for
  the multi-line trend chart; `bot` is that day's total over the `bot` dim (ua +
  synthetic) and is never part of `pv`. **401** on a bad token _or_ an
  unresolved site.
- **`GET /sites`** — `[{id, host}]`, **admin token only**. Powers the
  dashboard's site picker; a per-site token gets 401 and the dashboard falls
  back to typing the id.
- **`GET /dashboard`** — the UI (site picker, period selector, uPlot trend
  chart, KPI tiles, day×hour heatmap, breakdowns, CSV export, **show bot
  traffic** toggle). Breakdowns render as two packed columns (CSS multi-column,
  one column under ~900px), each dim capped at its **top 10** values behind a
  per-dim _show all_ toggle, each row showing count + share of that dim's total.
  The filter box searches every value, capped or not, and hides dims with no
  match. `GET /vendor/uPlot.iife.min.js` + `/vendor/uPlot.min.css` serve the
  **vendored** uPlot (no CDN dependency). `GET /` — `ok`.

**Deploy caveat** (bit this project once): asset files must live **flat** beside
`main.ts` — not in a subdirectory — and be read with `Deno.readTextFile`. Deno
Deploy bundles sibling new-URL files but skips subdirs, and ignores
`with { type: "text" }` at runtime. That applies to `dashboard.html`, `s.js` and
the uPlot pair. It is also why `deno.json` scopes its excludes to `fmt`/`lint`
only: a top-level `exclude` is honored by the Deploy upload and silently drops
those files (they 404).

## Data model (Deno KV)

`key = ["c", site, day, dim, value]`, `value = bigint` via
`kv.atomic().sum(key, 1n)`, one atomic commit per hit. Dims are counted
**independently** (no co-occurrence → no cross-dim segmentation), with exactly
one deliberate exception: `dowhour`.

`site` is a **key segment, not a dim**: that gives per-site `kv.list` prefixes
for read, prune, export and delete-a-site for free, and makes cross-site leakage
a key-construction bug (loud, testable) rather than a filtering bug (silent).
Reads filter on key length, because a site id may legitimately look like a date
and would otherwise collide with the 4-segment legacy prefix.

**Pageview** (`d.ev` absent) always writes 12 dims: `pv`, `path`, `host`, `ref`,
`ref_group`, `lang`, `tz`, `browser`, `os`, `device`, `hour` (UTC hour,
`00`–`23`), `dowhour`. Plus, only when present: `country` (server-side, **only
if** a fronting CDN sets a country header like `cf-ipcountry` — bare Deno Deploy
exposes no visitor geo, so this dim just never fires; no IP is ever read or
stored), and from the beacon `viewport`, `utm_source`, `utm_medium`,
`utm_campaign`, plus the localStorage-derived flags `uv` (first hit of day),
`sessions` (new session), `bounce` (prior session had 1 pageview). Every stored
value is clamped to 128 chars so a hostile/buggy client can't inflate KV cost.
Unknown fields (like `z`) are ignored. **Event** (`d.ev` set) writes only
`event` + `event_target` and does **not** increment `pv` — except for the two
behavioral-probe verdicts (`ev=hi`, `ev=bot`), which the server routes to their
own dims (below).

**Bot traffic** never reaches the pageview path: a hit whose UA matches `isbot`
writes `bot["ua"]` (a running total) and `bot_kind[<match>]` (which isbot
pattern fired, e.g. `googlebot`, `facebookexternalhit` — bounded cardinality,
same 128-char clamp as every other dim) instead of `pv`, then returns the same
gif so behavior is unchanged for the caller. This makes the filter tunable
against real traffic (compare `bot`/`bot_kind` counts over time) instead of
guesswork, and replaces the old approach of dropping bot hits with no signal at
all.

**Dashboard display**: bot traffic is **off by default** behind the _show bot
traffic_ checkbox (remembered in `localStorage`). With it on you get a separate
amber **bot visits** KPI tile (with the same prior-period delta as the other
tiles), a dashed `bots` line on the trend chart, and the `bot` + `bot_kind`
breakdowns. It is strictly additive display: bot hits never write `pv`, so
pageviews/visitors/sessions/bounce are bot-free either way, and toggling only
re-renders the already-loaded payload (no refetch). The CSV export always
includes the bot dims regardless of the checkbox.

**Behavioral probe**: the client arms a one-shot listener set
(`pointerdown`/`keydown`/`touchstart`/`wheel`/`mousemove`, all
`{ passive: true, once: true }`) right after the pageview beacon fires. The
first of those to land reports a verdict, which the server files under a
dedicated dim: `hi[<bucket>]` where the bucket is beacon-to-interaction latency
(`<150`, `150-2000`, `>2000`), or — if `event.isTrusted === false`, i.e. a
script called `dispatchEvent` rather than a real user acting — `bot[synthetic]`,
sharing the `bot` dim with UA-detected crawlers (`bot[ua]`) so both detection
methods total in one place. Keeping these off `event`/`event_target` matters:
`hi` fires on roughly every pageview, so folding it in would bury the
download/outbound bars and interleave latency buckets with filenames.

`scroll` is deliberately **not** in the trigger set — SPA routers scroll-restore
on every route change and a browser-generated scroll event is `isTrusted`, which
would report a human on nearly every navigation. `wheel` + `touchstart` cover
real scroll intent without the false positive.

**Nothing beyond that verdict leaves the browser**: no coordinates, no movement
deltas, no event trace, and nothing is written to `localStorage`. `mousemove` is
in the trigger set purely for its `isTrusted` bit, not for tracking motion. The
pageview beacon itself is never delayed or gated on this — it still fires
immediately for every visitor, mouse or no mouse. The verdict is a plain
independent counter like every other dim, so it can't be joined against `path`,
`country`, or anything else, which is what keeps this inside the
no-consent-banner claim. The dashboard shows it as the **human interaction** KPI
(`hi total / pv`); read it as a daily trend, not a per-hit verdict — a real
visitor can legitimately bounce before touching anything.

Known ceiling: a CDP-driven browser using real `Input.dispatchMouseEvent`
produces **trusted** events, so genuinely stealthy headless automation passes
this probe. Catching that would need fingerprinting, which is out of scope by
design.

`day`, `hour` and `dowhour` all come from **one** clock read per hit, so a
request landing on the midnight boundary can't be filed under one day carrying
the next day's hour.

### `z` — why the payload carries a random field

The beacon is an `Image()` GET, and a browser collapses an image request whose
URL exactly repeats an earlier one — verified in Chrome,
`cache-control: no-store` notwithstanding. Without a nonce, every _repeated_
beacon is silently lost: the same `hi` latency bucket on a second pageview, an
A→B→A→B SPA path loop, a second click on the same download link. `z` is 6 random
chars, sent inside the opaque payload rather than as a visible `?_=<ts>` param
so the URL keeps its bland shape. The server ignores it; it is never stored.

### `ref_group` — referrer bucketing

`ref_group` classifies the referrer host **server-side at ingest** into `search`
/ `social` / `internal` / `direct` / `referral`, so the grouping is consistent
and lands in the CSV export instead of being re-derived per dashboard render.
`internal` is a referrer whose host equals the beacon's own origin (a full-page
reload inside the site), which keeps it out of the acquisition numbers. The
client sends `r: ""` for direct traffic; that is normalized to `direct` (not
stored as an empty key).

### `dowhour` — the one pairwise dim

`dowhour` stores `"<dow>-<hh>"` (dow `0`=Sun…`6`=Sat UTC, 168 possible values) —
a **true day×hour joint counter**, which is what the dashboard heatmap renders.
This is the schema's only pairwise key and it is intentional: `dow` and `hour`
as separate independent counters are _marginals_, and multiplying them into a
grid would fabricate an outer product rather than show real co-occurrence.
Storing the joint key directly costs the same 1 extra write unit as a standalone
`dow` dim would, so the honest version is free. Per-weekday totals are recovered
by summing `dowhour` over hours — no separate `dow` dim exists.

**Non-goal: user-flow Sankey.** A multi-hop flow diagram needs per-visitor page
sequences, which requires a cookie or fingerprint — that would break the
no-consent-banner model, so it will not be built. The degenerate 1-hop version
(pairwise `ref_group → landing page`) is just a grouped bar chart bent into
ribbons and isn't worth its write cost either.

### Write budget (shared by all sites)

Free tier ≈ 300K write units/mo ÷ 12 base pageview dims ≈ **~25K pageviews/mo**
for a pageview that sees no interaction. Most pageviews also arm the behavioral
probe (above), which — if it fires — is a _second_ beacon costing **1** more
write unit (the single `hi` dim; the bucket is the value, not a second key), so
budget for engaged traffic is 300K ÷ 13 ≈ **~23K pv/mo**; bounces that never
trigger the probe stay at the ~25K figure. (Bot hits cost 2 write units each but
don't compete with the pv budget — they never write `pv`.) That budget is
**shared across every site on the deployment** — watch per-site `pv` on the
dashboard. A top-level `Deno.cron` prunes days older than 400, per site (the
"first in-range day → stop" early exit is only valid inside one site's prefix; a
single scan with that break would prune the first site and let every other one
grow forever).

## Operator CLI

```bash
deno task admin -- list                        # site ids that actually hold data
deno task admin -- usage --site acme           # key count + day range
deno task admin -- delete --site acme --yes    # irreversible: erase one tenancy
```

`delete` exists because "please remove my data" should be a one-liner, not an
improvisation — the site is a KV prefix.

## curl smoke test

```bash
BASE=http://localhost:8000                 # or https://stats.<yourdomain>

V=$(deno eval 'console.log(btoa(encodeURIComponent(JSON.stringify(
  {p:"/docs/intro",r:"google.com",l:"de-DE",tz:"Europe/Berlin"}))))')

curl -i "$BASE/e?s=demo&v=$V" \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0) Firefox/126.0'
# → 200 image/gif;  Firefox / Windows / de  (custom UA tests parseUA — the browser can't)

curl -s "$BASE/stats?site=demo&token=devtoken" | jq .
```

## Deploy (new Deno Deploy — `console.deno.com`)

1. `deno task build-client`, commit `s.js`, then from this dir: `deno deploy`
   (follow prompts) — or link the GitHub repo in `console.deno.com`, point at
   `main.ts`, leave the build command empty (plain TS, no build step). **Do
   not** use `deployctl` — that's Deploy Classic only (shut down 2026-07-20).
2. **Databases → Provision Database → Deno KV**, then **Assign** to the app. KV
   is not auto-provisioned; without this `Deno.openKv()` fails.
3. **Settings → Environment Variables**: `SITES`, `STATS_TOKEN` (long random
   secret), and a `STATS_TOKEN_<ID>` per site you want to hand out separately.
4. **Settings → Domains**: add `stats.<yourdomain>` + the shown DNS record, for
   **each** site. One app can hold several custom domains — that is what makes
   Host-based site resolution work, and it keeps every beacon first-party, which
   is what keeps it off adblock filter lists.

## Adding a site

1. Append `id:stats.theirdomain` to `SITES`.
2. Add their domain under Settings → Domains.
3. Give them the tag:
   `<script defer src="https://stats.theirdomain/s.js"></script>` (no
   `data-site` needed once the Host is mapped).
4. Optionally set `STATS_TOKEN_<ID>` so they can read their own stats without
   the admin token.

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
   `LEGACY_SITE` and delete that branch in `readStats`.

## Privacy

See [docs/privacy-template.md](docs/privacy-template.md) for a privacy note you
can adapt for a site that uses this collector, and `docs/design-notes/` for the
reasoning behind the schema and the bot detection.

## License

MIT — see [LICENSE](LICENSE).
