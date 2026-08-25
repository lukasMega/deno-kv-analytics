// Browser beacon. Built to a minified IIFE at ../s.js by `deno task build-client`
// and served by the collector itself, so a consumer needs one tag and no build:
//
//   <script defer src="https://stats.example.com/s.js" data-site="acme"></script>
//
// On a custom domain the collector resolves the site from the Host, so even
// `data-site` is optional there. The endpoint is the script's own origin — the
// beacon is therefore always first-party to whatever domain served this file.
//
// No cookies. No IP. No fingerprint. localStorage holds only visit/session
// bookkeeping (see computeFlags) and nothing that identifies the visitor ever
// leaves the browser.

const script = document.currentScript as HTMLScriptElement | null;
const config = script?.dataset ?? ({} as DOMStringMap);
const SITE = config.site ?? "";

// Same-origin as this script: no second host to configure, and nothing to get
// out of sync when a consumer moves domains.
const ORIGIN = script?.src
  ? new URL(script.src, location.href).origin
  : location.origin;
const ENDPOINT = `${ORIGIN}/e`;

// The Docusaurus version of this file gated on `NODE_ENV !== 'production'`, which
// does not exist in a plain script tag. Local hosts are the practical equivalent;
// `data-dev="1"` opts back in for testing the real pipeline.
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.local)$/i;
const enabled = config.dev === "1" || !LOCAL.test(location.hostname);

// Sends the opaque beacon shared by pageviews and custom events.
function send(payload: Record<string, string>): void {
  // `z` is a cache-buster, and it is not optional: an `new Image()` request whose
  // URL exactly repeats an earlier one is collapsed by the browser (verified in
  // Chrome, `cache-control: no-store` and all), so without it every *repeated*
  // beacon is silently lost — the same `hi` latency bucket on a second pageview,
  // an A→B→A→B SPA path loop, a second click on the same download link. It rides
  // inside the opaque payload instead of as a visible `?_=<ts>` param so the URL
  // keeps its bland shape; the server ignores fields it does not know, and `z` is
  // never stored.
  const v = btoa(encodeURIComponent(JSON.stringify({
    ...payload,
    z: Math.random().toString(36).slice(2, 8),
  })));
  const q = new URLSearchParams(SITE ? { s: SITE, v } : { v }); // percent-encodes +/= for the query

  // GET as image → resource type `image`, dodges $ping/$xhr filter rules.
  // Server replies with a 1×1 gif.
  const img = new Image();
  img.onerror = () => {}; // silence JS-level noise (not the browser console log)
  img.src = `${ENDPOINT}?${q}`;
}

// Visitor/session flags, deduped via localStorage (identity never leaves the browser —
// only these boolean-ish flags are sent). Private mode / storage disabled → no flags,
// pageview still sends.
function computeFlags(): Record<string, string> {
  const flags: Record<string, string> = {};
  try {
    const now = Date.now();
    const last = +(localStorage.getItem("da_last") || 0);
    const todayUTC = new Date().toISOString().slice(0, 10);
    const newSession = !localStorage.getItem("da_sid") ||
      now - last > 30 * 60 * 1000;
    if (newSession) {
      // report whether the PRIOR session bounced (exactly 1 pageview)
      if (
        localStorage.getItem("da_sid") &&
        +(localStorage.getItem("da_prevPv") || 0) === 1
      ) {
        flags.b = "1";
      }
      localStorage.setItem("da_sid", Math.random().toString(36).slice(2));
      localStorage.setItem("da_prevPv", "0");
      flags.s = "1";
    }
    localStorage.setItem(
      "da_prevPv",
      String(+(localStorage.getItem("da_prevPv") || 0) + 1),
    );
    if (localStorage.getItem("da_seenDay") !== todayUTC) {
      flags.u = "1";
      localStorage.setItem("da_seenDay", todayUTC);
    }
    localStorage.setItem("da_last", String(now));
  } catch {
    // private mode / storage disabled → skip flags, still send the pageview
  }
  return flags;
}

// CDP/WebDriver-controlled browser (Playwright, Puppeteer, Selenium).
// Spec-mandated true under automation; trivially spoofable, but automation
// rarely bothers spoofing it on a docs site.
const automated = (): boolean =>
  typeof navigator !== "undefined" && navigator.webdriver === true;

function track(pathname: string): void {
  if (!navigator.onLine) return; // offline: skip → no failed request/row/log
  if (automated()) return; // webdriver-controlled browser: skip

  const flags = computeFlags();

  const w = globalThis.innerWidth;
  const vw = w < 640 ? "<640" : w <= 1024 ? "640-1024" : ">1024";

  const payload: Record<string, string> = {
    p: pathname,
    h: location.origin,
    r: document.referrer ? new URL(document.referrer).host : "",
    l: navigator.language,
    ls: (navigator.languages || []).join(","),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    vw,
    ...flags,
  };

  const search = new URLSearchParams(location.search);
  const us = search.get("utm_source");
  const um = search.get("utm_medium");
  const uc = search.get("utm_campaign");
  if (us) payload.us = us;
  if (um) payload.um = um;
  if (uc) payload.uc = uc;

  send(payload);
  installBehavioralProbe(performance.now());
}

// Custom event beacon (outbound link / download click, …). No pageview fields.
export function trackEvent(ev: string, t: string): void {
  if (!enabled) return;
  if (!navigator.onLine) return;
  if (automated()) return;
  send({ ev, t });
}

// Timing + trust probe. One-shot per pageview: the first of these event types
// to fire tells us whether it was real input (event.isTrusted) and, if so, how
// long after the beacon it arrived. That's it — no coordinates, no movement
// deltas, no event trace, nothing written to localStorage. Only the verdict
// (trusted bit + a coarse latency bucket) leaves the browser, and the server
// files it under its own `hi`/`bot` dim, so it can't be joined against
// `path`/`country`/anything else. See README.md's behavioral-probe note for
// why this stays inside the no-consent-banner claim.
//
// Deliberately NOT `scroll`: SPA routers scroll-restore on every route change,
// and a browser-generated scroll event is `isTrusted` — that would report a
// human on nearly every navigation. `wheel` + `touchstart` cover real scroll
// intent without the false positive.
const PROBE_EVENTS = [
  "pointerdown",
  "keydown",
  "touchstart",
  "wheel",
  "mousemove",
] as const;

// Detaches the previously-armed probe, if any — guards against a fast SPA
// route change re-arming the probe before the prior pageview's listeners fired.
let detachProbe: (() => void) | null = null;

function installBehavioralProbe(sentAt: number): void {
  detachProbe?.();

  const onFirstInteraction = (e: Event): void => {
    detachProbe?.();
    detachProbe = null;

    if (e.isTrusted === false) {
      // Synthetic, JS-dispatched event. Real user input is always trusted;
      // a script calling dispatchEvent() to fake interaction is not.
      trackEvent("bot", "synthetic");
      return;
    }
    // Bucketed, not reported raw: this is an observation to weigh against
    // volume, not a per-hit verdict. `mousemove` is in the trigger set purely
    // for its isTrusted bit — no coordinate sampling, no delta/teleport
    // heuristics, which would need retained per-visitor traces.
    const ms = performance.now() - sentAt;
    const bucket = ms < 150 ? "<150" : ms <= 2000 ? "150-2000" : ">2000";
    trackEvent("hi", bucket);
  };

  for (const type of PROBE_EVENTS) {
    document.addEventListener(type, onFirstInteraction, {
      passive: true,
      once: true,
    });
  }
  // `once: true` self-removes only the listener that actually fired; explicitly
  // detach the rest so a stray real interaction later on doesn't fire again.
  detachProbe = () => {
    for (const type of PROBE_EVENTS) {
      document.removeEventListener(type, onFirstInteraction);
    }
  };
}

const DOWNLOAD_EXT = /\.(pdf|zip|dmg|exe|pkg|tar|gz|7z|mp4|csv)$/i;

// One global click listener for outbound-link / download tracking.
function installClickTracking(): void {
  document.addEventListener("click", (e: MouseEvent) => {
    if (e.button !== 0) return; // left-click only
    const target = e.target as Element | null;
    const a = target?.closest?.("a");
    if (!a || !(a instanceof HTMLAnchorElement) || !a.href) return;

    try {
      const url = new URL(a.href, location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") return;

      if (url.host !== location.host) {
        trackEvent("outbound", url.host);
        return;
      }
      if (DOWNLOAD_EXT.test(url.pathname)) {
        trackEvent("download", url.pathname.split("/").pop() || url.pathname);
      }
    } catch {
      // ignore anchors with an unparsable href
    }
  });
}

// SPA navigation without a framework hook.
//
// This replaces Docusaurus's `onRouteDidUpdate`. `pushState`/`replaceState` fire
// no event of their own, so they are wrapped; `popstate` covers back/forward.
// Every path runs through `onNavigate`, which keeps the original rule: report
// only when the *pathname* changed, so a query/hash-only change (search box,
// anchor link, our own utm-stripping) is not a second pageview.
let lastPath = "";

function onNavigate(): void {
  if (location.pathname === lastPath) return;
  lastPath = location.pathname;
  track(lastPath);
}

function installRouting(): void {
  for (const name of ["pushState", "replaceState"] as const) {
    const original = history[name];
    history[name] = function (
      this: History,
      ...args: Parameters<History["pushState"]>
    ) {
      const r = original.apply(this, args);
      // Async: the URL is updated synchronously, but let the router finish its
      // own work (and any immediate follow-up replaceState) before reporting.
      setTimeout(onNavigate, 0);
      return r;
    };
  }
  addEventListener("popstate", () => setTimeout(onNavigate, 0));
}

// Installed once even if the tag is included twice (a consumer copying the
// snippet into both a layout and a template would otherwise double-count).
// `globalThis`, not `window`: this file is type-checked by Deno, whose lint
// rejects `window` outright.
declare global {
  var __da: { trackEvent: typeof trackEvent } | undefined;
}

if (enabled && !globalThis.__da) {
  globalThis.__da = { trackEvent };
  installClickTracking();
  installRouting();
  onNavigate(); // first load
}
