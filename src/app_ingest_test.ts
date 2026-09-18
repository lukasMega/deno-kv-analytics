// Desktop-app ingest (`/a`): the demo desktop binary's daily ping. Same round-trip
// shape as main_test.ts — encode a payload exactly as the client does, run it
// through createHandler over an in-memory KV, assert /stats.
import { assertEquals } from "@std/assert";
import { appDims, decodeAppPayload } from "./app_ingest.ts";
import { createHandler } from "./main.ts";
import { loadSites } from "./sites.ts";

Deno.env.set("STATS_TOKEN", "testtoken");

// mirror telemetry.ts encodePayload(): base64(encodeURIComponent(JSON))
const encode = (p: Record<string, string>) =>
  btoa(encodeURIComponent(JSON.stringify(p)));

const SITES = loadSites({ get: () => "test:x" });

function fixture() {
  const kv = Deno.openKv(":memory:");
  return kv.then((k) => ({ kv: k, h: createHandler(k, SITES) }));
}

// A CLI User-Agent — the exact shape `/e`'s isbot() filter would drop.
const ping = (v: string, ua = "DemoApp/0.14.3") =>
  new Request(`http://x/a?v=${encodeURIComponent(v)}`, {
    headers: { "user-agent": ua },
  });

const statsReq = (qs = "", token = "testtoken") =>
  new Request(`http://x/stats?${qs}`, {
    headers: { authorization: `Bearer ${token}` },
  });

Deno.test("a ping writes app + os + version + device", async () => {
  const { kv, h } = await fixture();
  const res = await h(
    ping(encode({ os: "macos", v: "0.14.3", dv: "mirabox-293s" })),
  );
  assertEquals(res.headers.get("content-type"), "image/gif");

  const day = new Date().toISOString().slice(0, 10);
  const stats = await (await h(statsReq(`series=1&from=${day}&to=${day}`)))
    .json();
  assertEquals(stats.series, [[day, 0, 0, 0, 0, 1]]);
  assertEquals(stats.app._, 1);
  assertEquals(stats.app_os.macos, 1);
  assertEquals(stats.app_version["0.14.3"], 1);
  assertEquals(stats.app_device["mirabox-293s"], 1);
  // never a pageview: an app ping must not move the web counters
  assertEquals(stats.pv, undefined);
  kv.close();
});

Deno.test("a CLI User-Agent is not treated as a bot", async () => {
  const { kv, h } = await fixture();
  await h(ping(encode({ os: "linux", v: "0.14.3", dv: "none" })));

  const stats = await (await h(statsReq())).json();
  assertEquals(stats.app._, 1);
  assertEquals(stats.bot, undefined);
  kv.close();
});

Deno.test("multi-deck: one app_device write per model", async () => {
  const { kv, h } = await fixture();
  await h(
    ping(
      encode({ os: "windows", v: "0.14.3", dv: "elgato-mk2,mirabox-k1pro" }),
    ),
  );

  const stats = await (await h(statsReq())).json();
  assertEquals(stats.app._, 1, "still one install");
  assertEquals(stats.app_device["elgato-mk2"], 1);
  assertEquals(stats.app_device["mirabox-k1pro"], 1);
  kv.close();
});

// Two sites, so resolveSite's single-tenant fallback ("the only configured site")
// does not adopt an unrecognised host — that fallback is why this needs its own
// fixture rather than the one-site SITES above.
Deno.test("an unknown site writes nothing but still returns the gif", async () => {
  const kv = await Deno.openKv(":memory:");
  const h = createHandler(kv, loadSites({ get: () => "test:x,other:y" }));
  const res = await h(
    new Request(
      `http://nope/a?v=${
        encodeURIComponent(encode({ os: "macos", v: "1.0.0" }))
      }`,
    ),
  );
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "image/gif");

  const stats = await (await h(statsReq("site=test"))).json();
  assertEquals(stats.app, undefined);
  kv.close();
});

Deno.test("a malformed payload still counts the install, nothing else", async () => {
  const { kv, h } = await fixture();
  await h(ping("not-base64!!"));

  const stats = await (await h(statsReq())).json();
  assertEquals(stats.app._, 1);
  assertEquals(stats.app_os, undefined);
  assertEquals(stats.app_version, undefined);
  kv.close();
});

// pure helpers

Deno.test("decodeAppPayload: garbage decodes to an empty object", () => {
  assertEquals(decodeAppPayload(null), {});
  assertEquals(decodeAppPayload("not-base64!!"), {});
  assertEquals(decodeAppPayload(btoa("plain text, not json")), {});
});

Deno.test("appDims: a non-release version never reaches the dim", () => {
  const dims = appDims({ os: "macos", v: "0.14.3-dev", dv: "none" });
  assertEquals(dims.some(([dim]) => dim === "app_version"), false);
  assertEquals(dims.some(([dim]) => dim === "app_os"), true);
});

Deno.test("appDims: device ids are capped so a payload can't mint keys", () => {
  const dv = Array.from({ length: 30 }, (_, i) => `m${i}`).join(",");
  const devices = appDims({ dv }).filter(([dim]) => dim === "app_device");
  assertEquals(devices.length, 8);
});

Deno.test("appDims: an empty payload is still one install", () => {
  assertEquals(appDims({}), [["app", "_"]]);
});

Deno.test("appDims: os version accepts the client's buckets", () => {
  for (
    const ov of ["windows-11", "macos-26", "ubuntu-24.04", "arch", "unknown"]
  ) {
    const dims = appDims({ ov });
    assertEquals(
      dims.some(([dim, v]) => dim === "app_os_version" && v === ov),
      true,
      ov,
    );
  }
});

Deno.test("appDims: an unbucketed os version is dropped, not clamped", () => {
  // A raw patch version is exactly what the bucketing exists to prevent: one KV
  // key per patch release per install.
  for (const ov of ["26.6.2", "Windows 11 Pro", "a".repeat(40), ""]) {
    const dims = appDims({ ov });
    assertEquals(dims.some(([dim]) => dim === "app_os_version"), false, ov);
  }
});

Deno.test("appDims: tz offset is a fixed shape, anything else is dropped", () => {
  assertEquals(
    appDims({ tz: "UTC+05:45" }).some(([d]) => d === "app_tz_offset"),
    true,
  );
  assertEquals(
    appDims({ tz: "UTC-05:00" }).some(([d]) => d === "app_tz_offset"),
    true,
  );
  assertEquals(
    appDims({ tz: "unknown" }).some(([d]) => d === "app_tz_offset"),
    true,
  );
  for (const tz of ["Europe/Prague", "UTC+5", "+02:00", ""]) {
    assertEquals(
      appDims({ tz }).some(([d]) => d === "app_tz_offset"),
      false,
      tz,
    );
  }
});
