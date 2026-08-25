# docs-analytics — bot/crawler detection (A + B + D + behavioral)

```
Date: 2026-07-29
Scope: docs-analytics/main.ts       (A: count-don't-drop; D: npm:isbot)
       docs-analytics/main_test.ts  (bot dim assertions, isbot coverage)
       docs-analytics/deno.json     (npm: specifier — lockfile update)
       docs-analytics/README.md     (new dims + write-budget revision)
       docs-site/src/analytics.ts   (B: navigator.webdriver; behavioral probe)
       NOT touched: KV key layout ["c", day, dim, value]; consent/cookie model
Status: Implemented █████████░ — A/B/D + probe shipped in `117019b`; follow-up
        pass (uncommitted) closes the readout gaps. 15/15 tests pass.
        Done since `117019b`:
        - `scroll` removed from the probe trigger set (Docusaurus scroll
          restoration fires a *trusted* event → false `hi` on every SPA nav).
        - probe verdicts routed server-side to their own dims (`hi[<bucket>]`,
          `bot[synthetic]`) instead of `event`/`event_target`, which they were
          burying. Side effect: probe now costs 1 write unit, not 2.
        - `bot`/`bot_kind`/`hi` added to the dashboard's `DIM_ORDER` (they were
          being collected and never rendered).
        - "human interaction" KPI tile (`hi total / pv`) — the readout the
          README already documented but nothing computed.
        - local seeder emits probe verdicts so the new tile isn't stuck at 0.
        Second follow-up (uncommitted):
        - `bot_kind` no longer stores `isbotMatch`'s raw UA substring, which was
          wrong at both ends (every `*Bot` crawler collapsed to "Bot"; and
          "facebookexternalhit/1.1" fragmented per version). New `botKind()`
          helper widens to the product token and drops the version →
          "claudebot", "gptbot", "googlebot". Covered by a unit test.
        - `npm:`/`jsr:` moved to a deno.json `imports` map (`deno lint`'s
          no-import-prefix rejected the inline specifiers).
        - deno.json `exclude` for the vendored uPlot assets, so lint/fmt stop
          reporting 572 problems in a minified bundle that isn't ours.
        NOTE: `deno fmt` disagrees with the repo's oxfmt style (it unwraps the
        aligned ternary chains in `parseUA`). Do NOT run `deno fmt` on this dir.
        STILL OPEN: `npm:isbot` resolution on the new Deno Deploy is UNVERIFIED
        and it is now the only bot filter in the path — see "Open decisions".
        Resolved: the co-landing 2026-07-21 plan (ref_group/dowhour/dashboard)
        was NOT separated — both plans ship together in `117019b`.
Goal: raise bot-detection fidelity beyond the hand-rolled UA regex, keep every
      signal aggregate-only so the no-cookie/no-consent-banner claim survives.
```

## Privacy caveat (flagged, then proceeding as instructed)

README.md:3 sells the collector as "no fingerprint → **no consent banner**".
Behavioral timing + mouse-movement checks are the class of signal that normally
erodes that claim. This plan keeps them defensible by constraining what leaves
the browser:

- **No coordinates.** `clientX/clientY`, movement deltas, and event traces never
  leave the page. Only a verdict does.
- **No per-visitor accumulation.** One boolean-ish verdict per pageview, then
  the listeners detach. Nothing persisted to `localStorage`.
- **No new joinable dim.** The verdict lands in the existing independent-counter
  `event` channel — it cannot be crossed with `path`, `country`, or anything
  else.

Net: an aggregate daily count of "how many pageviews showed human interaction",
which is not a fingerprint (no cross-visit identity, no entropy retained). If
the scope ever widens to storing coordinates/deltas/timing histograms per
visitor, the consent-banner claim must be re-evaluated — call that out in
review.

## Current state

| where             | what                                                            |
| ----------------- | --------------------------------------------------------------- |
| `main.ts:10-11`   | hand-rolled `BOT` regex                                         |
| `main.ts:133`     | `if (BOT.test(ua)) return gif();` — **silent drop**, no counter |
| `analytics.ts:17` | beacon is `new Image()` from a Docusaurus route hook            |

Implicit filter already in place: the beacon needs JS + DOM, so curl / wget /
python / classic Googlebot never reach `/e`. The server UA check is a backstop.
The real exposure is **JS-capable** clients: Playwright/Puppeteer-Chromium,
`Chrome-Lighthouse`, agentic AI browsers, `facebookexternalhit`,
`Google-InspectionTool` — none of which match the current regex.

Known false-positive risk in the current regex: bare substrings `fetch`,
`preview`, `monitor`, `scrap` match inside otherwise-legit UA strings.

## Item A — count bots instead of dropping silently

`main.ts`, in the `/e` handler, replacing the bare `return gif()`:

```ts
if (isbot(ua)) {
  const match = isbotMatch(ua) ?? "unknown";
  await kv.atomic()
    .sum(["c", today(), "bot", "ua"], 1n)
    .sum(["c", today(), "bot_kind", clamp(match)], 1n)
    .commit();
  return gif();
}
```

- Behavior unchanged for the visitor (still a 200 gif, still no `pv`).
- `bot` = total; `bot_kind` = which pattern fired, so the filter is tunable
  against real traffic instead of guesswork.
- Cost: 2 write units per bot hit. Bots reaching `/e` are rare (JS required), so
  this is noise against the ~30K pv/mo budget.
- `bot_kind` cardinality is bounded by isbot's pattern list (~O(100) rows/day
  worst case) and each value passes through the existing `clamp` (128 chars).

## Item D — replace the regex with `npm:isbot`

Verified against isbot **5.2.1** (`npm view` + unpacked `index.d.ts`): named
exports `isbot` and `isbotMatch` both exist; the package ships ESM (`index.mjs`)
via its `exports` map, so a Deno `npm:` specifier resolves cleanly.

```ts
import { isbot, isbotMatch } from "npm:isbot@5";
```

- Delete the `BOT` const at `main.ts:10-11`.
- isbot is maintained and covers AI crawlers (GPTBot, ClaudeBot, PerplexityBot,
  Bytespider) plus the JS-capable set the hand regex misses.
- **Deploy risk to verify:** new Deno Deploy (console.deno.com) must resolve the
  `npm:` specifier at deploy time with no build command configured. Confirm on a
  test deploy _before_ this is the only bot filter in the path. Fallback if it
  fails: vendor isbot's exported `list` into a local const and build the matcher
  at module load (`createIsbotFromList` is also exported).
- `deno.lock` will gain the npm entry — commit it.

## Item B — `navigator.webdriver`

`docs-site/src/analytics.ts`, guarding both beacon entry points:

```ts
// CDP/WebDriver-controlled browser (Playwright, Puppeteer, Selenium).
// Spec-mandated true under automation; trivially spoofable, but automation
// rarely bothers on a docs site.
const automated = typeof navigator !== "undefined" &&
  navigator.webdriver === true;
```

Early-return in `track()` and `trackEvent()` alongside the existing
`navigator.onLine` guard (`analytics.ts:51`, `analytics.ts:82`).

Catches the single largest JS-capable bot category the UA check cannot see, for
one line and zero requests.

## Behavioral probe — timing + mouse movement

### Design

The pageview beacon fires **immediately, unchanged** — no gating, no delay. Real
users who never move a mouse (mobile, keyboard-only, screen readers) must not be
dropped, and a deferred beacon would lose fast bounces. The behavioral signal is
therefore **additive and one-shot**, sent on the existing custom-event channel
(`ev`), which writes only `event` + `event_target` and never touches `pv`.

One-shot listener set installed per pageview, all
`{ passive: true, once: true }`: `pointerdown`, `keydown`, `touchstart`,
`wheel`, `scroll`, `mousemove`.

On the first event to fire:

1. **`event.isTrusted === false`** → synthetic, JS-dispatched. Real user input
   is always trusted; a script calling `dispatchEvent` is not. Emit
   `trackEvent('bot', 'synthetic')`.
2. Otherwise emit `trackEvent('hi', <latencyBucket>)` where latency = ms from
   beacon send to first interaction, bucketed:
   - `<150` — cursor already in motion at load, or scripted. Ambiguous by
     itself; bucketed so it can be judged against volume, **not** treated as a
     verdict.
   - `150-2000` — typical human orientation window.
   - `>2000` — slow reader / background tab.
3. Detach every remaining listener (all six) regardless of which fired.

Reset the installed-flag on SPA route change so each pageview probes once —
mirror how `installClickTracking` guards itself at `analytics.ts:88`, but
per-pageview rather than once per session.

### Mouse-movement specifics

`mousemove` is included in the one-shot set purely for its `isTrusted` bit. No
coordinate sampling, no delta analysis, no straight-line/teleport heuristics —
those need retained per-visitor traces, which is exactly the line the privacy
caveat above draws. `isTrusted` catches synthetic-cursor automation; genuinely
stealthy headless (real CDP `Input.dispatchMouseEvent` produces trusted events)
is **out of scope and will not be caught** — accept that ceiling rather than
escalate to fingerprinting.

### Reading the result

The most useful number is an **absence**: `1 − (event.hi / pv)` per day is the
share of pageviews with no observed human interaction. Bot-heavy days move it.
Interpret as a trend, not a per-hit verdict — a real user can bounce before
touching anything.

### Cost

+1 write unit on pageviews that see interaction (10 → 11 dims). Free-tier budget
falls from ~30K to ~27K pv/mo. Update the write-budget line in README.md:68.

**As shipped the numbers differ** — the 2026-07-21 plan landed `ref_group` +
`dowhour` in the same commit, taking the pageview base from 10 to **12** dims,
and the probe's verdict is a _second beacon_ (2 write units: `event` +
`event_target`), not +1 dim. README now documents **~25K pv/mo** for a pageview
that never triggers the probe and **~21K pv/mo** for engaged traffic. Bot hits
cost 2 write units but don't compete with the pv budget (they never write `pv`).

## Implementation order

1. **A** — count-don't-drop, keeping the existing regex. Ships alone, zero risk,
   immediately produces the baseline needed to judge step 2.
2. **D** — swap in isbot, after confirming `npm:` resolution on a test deploy.
   Compare `bot`/`bot_kind` counts against the step-1 baseline.
3. **B** — `navigator.webdriver` guard. One line, independent of 1–2.
4. **Behavioral probe** — last; the largest surface and the only item with a
   privacy dimension to review.

## Tests (`main_test.ts`)

- Rewrite `"bots are skipped"` (currently `main_test.ts:53`): still assert
  `stats.pv === undefined`, and additionally assert `stats.bot.ua === 1` plus a
  non-empty `stats.bot_kind`.
- New case: a UA the old regex missed but isbot catches (e.g.
  `facebookexternalhit/1.1`) → no `pv`, `bot` counted. This is the regression
  that proves item D did something.
- New case: a normal Firefox UA still writes `pv` and writes **no** `bot` dim.
- New case: `ev: 'hi', t: '150-2000'` → `stats.event.hi === 1`,
  `stats.event_target['150-2000'] === 1`, `stats.pv === undefined` (behavioral
  beacon must not inflate pageviews).

Client-side (`analytics.ts`) has no test harness in this repo — verify B and the
probe manually via the local dashboard (`deno task dev` → `/dashboard`), and by
driving the built docs site under Playwright to confirm `navigator.webdriver`
suppresses the beacon.

## README.md updates

- New dims: `bot`, `bot_kind`, and the `hi` / `bot=synthetic` events.
- Revised write budget (~27K pv/mo).
- Replace the `/bot|crawl|spider|preview|monitor/i` claim at README.md:35-36
  with the isbot reference.
- Short note on the behavioral probe and why it stays consent-free (no
  coordinates, no persistence, no joinable dim).

## Open decisions

- **`npm:isbot` on Deploy** — blocks item D. Test-deploy first; vendored-`list`
  fallback documented above.
- **`bot_kind` cardinality** — bounded and cheap as analyzed, but if the pattern
  spread turns out noisy in practice, collapse to a coarse bucket (ai / search /
  social / tooling / other) instead of the raw match.
- **`<150` latency bucket** — kept as an observation, not a verdict. Decide
  after a week of real data whether it is worth acting on at all.
