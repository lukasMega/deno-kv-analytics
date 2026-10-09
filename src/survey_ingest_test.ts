import { assert, assertEquals, assertMatch } from "@std/assert";
import { deleteSite, listSites, sizeOf, usage } from "./admin.ts";
import { createHandler, prune } from "./main.ts";
import { loadSites } from "./sites.ts";
import { createSurveyLimiter, validateSurvey } from "./survey_ingest.ts";

Deno.env.set("STATS_TOKEN", "testtoken");
Deno.env.set("STATS_TOKEN_ALPHA", "alpha-token");
Deno.env.set("STATS_TOKEN_BETA", "beta-token");

const payload = {
  sv: 1,
  v: "0.21.0",
  os: "macos",
  ov: "macos-26",
  dv: "mirabox-293s",
  a: {
    rating: "4",
    found: "ai-claude",
    nps: "9",
    want: ["multi-host", "widgets"],
  },
  c: "Useful app",
};
const post = (
  body: unknown = payload,
  host = "shared",
  query = "s=alpha",
  headers = {},
) =>
  new Request(`http://${host}/s?${query}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const read = (path = "/surveys", query = "site=alpha", token = "alpha-token") =>
  new Request(`http://shared${path}?${query}`, {
    headers: { authorization: `Bearer ${token}` },
  });
const info = (ip = "192.0.2.1") => ({ remoteAddr: { hostname: ip } });

async function fixture() {
  const kv = await Deno.openKv(":memory:");
  const h = createHandler(
    kv,
    loadSites({ get: () => "alpha:alpha.example,beta:beta.example" }),
  );
  return { kv, h };
}

Deno.test("survey stores one day-only row and never ping counters or identifying fields", async () => {
  const { kv, h } = await fixture();
  try {
    const body = {
      ...payload,
      ip: "192.0.2.1",
      timestamp: Date.now(),
      installId: "secret",
      tz: "Europe/Bratislava",
      country: "SK",
    };
    const response = await h(post(body), info());
    assertEquals(response.status, 204);
    assertEquals(await response.text(), "");
    const rows = await Array.fromAsync(kv.list({ prefix: [] }));
    assertEquals(rows.length, 1);
    assertEquals(rows[0].key.slice(0, 4), [
      "survey",
      "alpha",
      1,
      new Date().toISOString().slice(0, 10),
    ]);
    assertMatch(String(rows[0].key[4]), /^[0-9a-f-]{36}$/);
    assertEquals(rows[0].value, payload);
    const exported = await (await h(read("/surveys/export"))).json();
    assertEquals(exported.responses[0], { day: rows[0].key[3], ...payload });
    assertEquals(exported.cursor, null);
  } finally {
    kv.close();
  }
});

Deno.test("survey drops bad shapes and caps arrays, context and trimmed comments", () => {
  const result = validateSurvey({
    ...payload,
    v: "dev",
    os: "Darwin 26.0.1",
    ov: "26.6.2",
    dv: "bad/id,valid_model,good,good",
    a: {
      rating: "4",
      "invalid/key": "yes",
      bad: 4,
      object: {},
      empty: [],
      future: Array.from({ length: 20 }, (_, i) => `value-${i}`),
      mixed: ["good", {}, "bad/id", "good"],
    },
    c: `  ${"x".repeat(300)}  `,
  })!;
  assertEquals(result.v, undefined);
  assertEquals(result.os, undefined);
  assertEquals(result.ov, undefined);
  assertEquals(result.dv, "valid_model,good");
  assertEquals(Object.keys(result.a).sort(), ["future", "mixed", "rating"]);
  assertEquals(result.a.mixed, ["good"]);
  assertEquals(result.a.future.length, 12);
  assertEquals(result.c, "x".repeat(280));
  assertEquals(validateSurvey({ sv: 2, a: {}, c: "  " }), { sv: 2, a: {} });
});

Deno.test("survey rejects malformed JSON and invalid survey versions", async () => {
  const { kv, h } = await fixture();
  try {
    for (
      const [i, body] of [null, [], { sv: 0 }, { sv: 1.5 }, { sv: "1" }, {}]
        .entries()
    ) {
      assertEquals((await h(post(body), info(`192.0.2.${i}`))).status, 400);
    }
    assertEquals(
      (await h(
        new Request("http://shared/s?s=alpha", { method: "POST", body: "{" }),
        info("192.0.2.99"),
      )).status,
      400,
    );
    assertEquals((await Array.fromAsync(kv.list({ prefix: [] }))).length, 0);
  } finally {
    kv.close();
  }
});

Deno.test("survey enforces 2KB on declared, actual and streamed UTF-8 bytes", async () => {
  const { kv, h } = await fixture();
  try {
    assertEquals(
      (await h(
        post(payload, "shared", "s=alpha", { "content-length": "2049" }),
        info(),
      )).status,
      413,
    );
    assertEquals(
      (await h(post({ ...payload, c: "x".repeat(2048) }), info())).status,
      413,
    );
    const bytes = new TextEncoder().encode(
      JSON.stringify({ ...payload, c: "🙂".repeat(600) }),
    );
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 1024));
        controller.enqueue(bytes.slice(1024));
        controller.close();
      },
    });
    assertEquals(
      (await h(
        new Request("http://shared/s?s=alpha", {
          method: "POST",
          body: stream,
        }),
        info(),
      )).status,
      413,
    );
    assertEquals((await Array.fromAsync(kv.list({ prefix: [] }))).length, 0);
  } finally {
    kv.close();
  }
});

Deno.test("survey rate limit uses connection IP and ignores spoofed forwarding headers", async () => {
  const { kv, h } = await fixture();
  try {
    for (let i = 0; i < 3; i++) {
      assertEquals(
        (await h(
          post(payload, "shared", "s=alpha", {
            "x-forwarded-for": `198.51.100.${i}`,
          }),
          info(),
        )).status,
        204,
      );
    }
    const limited = await h(post(), info());
    assertEquals(limited.status, 429);
    assert(Number(limited.headers.get("retry-after")) > 0);
    assertEquals((await h(post(), info("192.0.2.2"))).status, 204);
    assertEquals(
      (await Array.fromAsync(kv.list({ prefix: ["survey"] }))).length,
      4,
    );
  } finally {
    kv.close();
  }
});

Deno.test("survey bucket refills three tokens per hour without persisting IP", () => {
  let now = 0;
  const limit = createSurveyLimiter(() => now);
  assertEquals([limit("ip"), limit("ip"), limit("ip"), limit("ip")], [
    0,
    0,
    0,
    1200,
  ]);
  now = 1200000;
  assertEquals(limit("ip"), 0);
  assertEquals(limit("ip"), 1200);
  now += 3600000;
  assertEquals([limit("ip"), limit("ip"), limit("ip"), limit("ip")], [
    0,
    0,
    0,
    1200,
  ]);
});

Deno.test("survey unknown sites write nothing; mapped host overrides query selector", async () => {
  const { kv, h } = await fixture();
  try {
    // Same status and rate limit as a real site, so no site-existence oracle.
    assertEquals(
      (await h(post(payload, "shared", "s=missing"), info())).status,
      204,
    );
    assertEquals(
      (await h(post(payload, "beta.example", "s=alpha"), info())).status,
      204,
    );
    assertEquals(
      (await h(post(payload, "shared", "s=missing"), info())).status,
      204,
    );
    assertEquals(
      (await h(post(payload, "shared", "s=missing"), info())).status,
      429,
    );
    assertEquals(
      (await Array.fromAsync(kv.list({ prefix: ["survey", "alpha"] }))).length,
      0,
    );
    assertEquals(
      (await Array.fromAsync(kv.list({ prefix: ["survey"] }))).length,
      1,
    );
    assertEquals(
      (await Array.fromAsync(kv.list({ prefix: ["survey", "beta"] }))).length,
      1,
    );
  } finally {
    kv.close();
  }
});

Deno.test("survey reads require resolved-site token or admin; never public", async () => {
  const { kv, h } = await fixture();
  try {
    await h(post(), info());
    for (const path of ["/surveys", "/surveys/export"]) {
      assertEquals(
        (await h(read(path, "site=alpha", "beta-token"))).status,
        401,
      );
      assertEquals((await h(read(path, "site=alpha", ""))).status, 401);
      assertEquals(
        (await h(read(path, "site=missing", "testtoken"))).status,
        401,
      );
      const response = await h(read(path, "site=alpha", "testtoken"));
      assertEquals(response.status, 200);
      assertEquals(response.headers.get("cache-control"), "no-store");
    }
    const beta = await (await h(read("/surveys", "site=beta", "beta-token")))
      .json();
    assertEquals(beta.total, 0);
  } finally {
    kv.close();
  }
});

Deno.test("survey summary filters UTC dates and versions, counts options and calculates NPS", async () => {
  const { kv, h } = await fixture();
  try {
    const rows = [
      { ...payload, a: { nps: "10", want: ["widgets", "multi-host"] } },
      {
        ...payload,
        os: "windows",
        dv: "elgato-mk2,mirabox-293s",
        a: { nps: "6", want: ["widgets"] },
      },
      { ...payload, a: { nps: "8" } },
      { ...payload, a: {} },
    ];
    for (const [i, value] of rows.entries()) {
      await kv.set(["survey", "alpha", 1, "2026-10-09", String(i)], value);
    }
    await kv.set(
      ["survey", "alpha", 2, "2026-10-09", "other-version"],
      payload,
    );
    await kv.set(["survey", "alpha", 1, "2026-10-08", "old"], payload);
    const query = "site=alpha&sv=1&from=2026-10-09&to=2026-10-09";
    const summary = await (await h(read("/surveys", query))).json();
    assertEquals(summary.total, 4);
    assertEquals(summary.counts.want, { widgets: 2, "multi-host": 1 });
    assertEquals(summary.nps, {
      answered: 3,
      promoters: 1,
      detractors: 1,
      score: 0,
    });
    assertEquals(summary.groups.macos.total, 3);
    assertEquals(summary.groups.windows.counts.want, { widgets: 1 });
    assertEquals(summary.comments.length, 4);
    const models = await (await h(read("/surveys", query + "&cross=dv")))
      .json();
    assertEquals(models.groups["mirabox-293s"].total, 4);
    assertEquals(models.groups["elgato-mk2"].total, 1);
    const versions = await (await h(read("/surveys", query + "&cross=v")))
      .json();
    assertEquals(versions.groups["0.21.0"].total, 4);
    const empty = await (await h(read("/surveys", "site=beta", "beta-token")))
      .json();
    assertEquals(empty.nps.score, null);
  } finally {
    kv.close();
  }
});

Deno.test("survey read rejects malformed filters", async () => {
  const { kv, h } = await fixture();
  try {
    for (
      const filter of [
        "sv=0",
        "sv=no",
        "sv=1.5",
        "from=bad",
        "from=2026-02-30",
        "from=2026-10-10&to=2026-10-09",
        "cross=country",
      ]
    ) {
      assertEquals(
        (await h(read("/surveys", `site=alpha&${filter}`))).status,
        400,
        filter,
      );
    }
  } finally {
    kv.close();
  }
});

Deno.test("survey export paginates without leaking other sites or versions", async () => {
  const { kv, h } = await fixture();
  try {
    for (let i = 0; i < 101; i++) {
      await kv.set([
        "survey",
        "alpha",
        1,
        "2026-10-09",
        String(i).padStart(3, "0"),
      ], payload);
    }
    await kv.set(["survey", "beta", 1, "2026-10-09", "other-site"], {
      ...payload,
      c: "beta only",
    });
    const first = await (await h(read("/surveys/export"))).json();
    assertEquals(first.responses.length, 100);
    assert(typeof first.cursor === "string");
    const last = await (await h(
      read(
        "/surveys/export",
        `site=alpha&cursor=${encodeURIComponent(first.cursor)}`,
      ),
    )).json();
    assertEquals(last.responses.length, 1);
    assertEquals(last.cursor, null);
    const invalid = await h(
      read("/surveys/export", "site=alpha&cursor=invalid"),
    );
    assertEquals(invalid.status, 400);
    const wrongSite = await h(
      read(
        "/surveys/export",
        `site=beta&cursor=${encodeURIComponent(first.cursor)}`,
        "beta-token",
      ),
    );
    if (wrongSite.status === 200) {
      const result = await wrongSite.json();
      assertEquals(result.responses.length <= 1, true);
      assertEquals(
        result.responses.every((row: { c: string }) => row.c === "beta only"),
        true,
      );
    } else assertEquals(wrongSite.status, 400);
  } finally {
    kv.close();
  }
});

Deno.test("survey rows remain after counter prune and participate in site erasure and sizing", async () => {
  const { kv, h } = await fixture();
  try {
    await h(post(), info());
    await kv.set(["survey", "beta", 1, "2020-01-01", "old"], payload);
    await prune(kv, ["alpha", "beta"]);
    assertEquals(await listSites(kv), ["alpha", "beta"]);
    const summary = await usage(kv, "alpha");
    assertEquals(summary.surveys, 1);
    assertEquals(summary.days, 1);
    assertEquals((await sizeOf(kv)).sites.alpha.keys, 1);
    assertEquals(await deleteSite(kv, "alpha"), 1);
    assertEquals(await listSites(kv), ["beta"]);
    assertEquals((await sizeOf(kv)).keys, 1);
  } finally {
    kv.close();
  }
});
