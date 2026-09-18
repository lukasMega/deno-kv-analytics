// Desktop-app ingest (`GET /a`), for the demo desktop binary rather than a browser.
//
// Why not just another branch in `/e`: that path runs isbot() over the
// User-Agent, and a CLI client is precisely the shape that filter exists to drop
// — every ping would be filed as a crawler, and a future isbot bump could start
// doing it silently. Its dims are pageview-shaped too (path/referrer/browser/
// viewport), none of which a desktop app has.
//
// Payload encoding matches the web beacon: base64(encodeURIComponent(JSON)).
import { clamp, country } from "./classify.ts";

// The client restricts each value to a closed vocabulary already; these are the
// backstop that stops a spoofed payload from minting unbounded KV keys.
const SEMVER = /^\d+\.\d+\.\d+$/;
const MAX_DEVICE_IDS = 8;
// `windows-11`, `ubuntu-24.04`, or a bare distro id. Bucketed by the client — a
// patch version here would be one KV key per patch release per install.
const OS_VERSION = /^[a-z][a-z0-9_]{0,15}(-[a-z0-9.]{1,12})?$/;
// Offset, not an IANA zone: under 40 values, and far less identifying.
const TZ_OFFSET = /^(UTC[+-]\d{2}:\d{2}|unknown)$/;

/** Malformed input is ignored rather than rejected — a broken client should
 *  degrade to an empty ping, not to an error it has no way to act on. */
export function decodeAppPayload(v: string | null): Record<string, string> {
  try {
    return JSON.parse(decodeURIComponent(atob(v ?? "")));
  } catch {
    return {};
  }
}

export function appDims(d: Record<string, string>): [string, string][] {
  // No visitor id and no `uv` dim: the client pings at most once per UTC day, so
  // `app` is already that day's distinct-install count.
  const dims: [string, string][] = [["app", "_"]];
  if (d.os) dims.push(["app_os", clamp(d.os)]);
  // Dropped, not clamped: a clamped off-vocabulary value still mints a key.
  if (OS_VERSION.test(d.ov ?? "")) dims.push(["app_os_version", d.ov]);
  if (TZ_OFFSET.test(d.tz ?? "")) dims.push(["app_tz_offset", d.tz]);
  // A dev build's version would be indistinguishable from a release once it is
  // in the dim, so drop anything that isn't a plain numeric triple.
  if (SEMVER.test(d.v ?? "")) dims.push(["app_version", d.v]);
  const ids = (d.dv ?? "").split(",").filter(Boolean).slice(0, MAX_DEVICE_IDS);
  for (const id of ids) dims.push(["app_device", clamp(id)]);
  return dims;
}

/** One atomic commit, same `["c", site, day, dim, value]` shape as a pageview. */
export async function writeAppPing(
  kv: Deno.Kv,
  site: string,
  day: string,
  req: Request,
  url: URL,
): Promise<void> {
  const dims = appDims(decodeAppPayload(url.searchParams.get("v")));
  const cc = country(req);
  if (cc) dims.push(["country", cc]);

  let tx = kv.atomic();
  for (const [dim, value] of dims) {
    tx = tx.sum(["c", site, day, dim, value], 1n);
  }
  await tx.commit();
}
