// Surveys are explicit submissions, stored separately from aggregate pings.
const ID = /^[a-z0-9-]{1,32}$/;
const MODEL_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const OS_VERSION = /^[a-z][a-z0-9_]{0,15}(-[a-z0-9.]{1,12})?$/;
const MAX_BODY = 4096;
// Owner test submissions: stored out of sight of every normal read.
const TEST_COMMENT = "test-survey";
const HOUR = 60 * 60 * 1000;

export interface SurveyPayload {
  sv: number;
  v?: string;
  os?: string;
  ov?: string;
  dv?: string;
  a: Record<string, string | string[]>;
  c?: string;
  useForOther?: string;
  wantOther?: string;
  /** Short-form marker; absent means the full survey. */
  f?: "short";
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Shape-only backstop: future question banks need no collector deployment. */
export function validateSurvey(raw: unknown): SurveyPayload | null {
  if (!object(raw) || !Number.isSafeInteger(raw.sv) || Number(raw.sv) < 1) {
    return null;
  }
  const answers: Record<string, string | string[]> = Object.create(null);
  if (object(raw.a)) {
    for (const [key, value] of Object.entries(raw.a)) {
      if (!ID.test(key)) continue;
      if (typeof value === "string" && ID.test(value)) answers[key] = value;
      else if (Array.isArray(value)) {
        const values = [
          ...new Set(
            value.filter((v): v is string =>
              typeof v === "string" && ID.test(v)
            ),
          ),
        ].slice(0, 12);
        if (values.length) answers[key] = values;
      }
    }
  }
  const payload: SurveyPayload = { sv: Number(raw.sv), a: answers };
  if (typeof raw.v === "string" && SEMVER.test(raw.v)) payload.v = raw.v;
  if (
    typeof raw.os === "string" &&
    ["macos", "windows", "linux", "unknown"].includes(raw.os)
  ) {
    payload.os = raw.os;
  }
  if (typeof raw.ov === "string" && OS_VERSION.test(raw.ov)) {
    payload.ov = raw.ov;
  }
  if (typeof raw.dv === "string") {
    const ids = [
      ...new Set(raw.dv.split(",").filter((id) => MODEL_ID.test(id))),
    ].slice(0, 8);
    if (ids.length) payload.dv = ids.join(",");
  }
  // Exact match only: keeps the stored value a closed set.
  if (raw.f === "short") payload.f = "short";
  if (typeof raw.c === "string") {
    const comment = raw.c.trim().slice(0, 280);
    if (comment) payload.c = comment;
  }
  if (
    Array.isArray(answers["use-for"]) &&
    answers["use-for"].includes("other") &&
    typeof raw.useForOther === "string"
  ) {
    const detail = raw.useForOther.trim().slice(0, 300);
    if (detail) payload.useForOther = detail;
  }
  if (
    Array.isArray(answers.want) && answers.want.includes("other") &&
    typeof raw.wantOther === "string"
  ) {
    const request = raw.wantOther.trim().slice(0, 100);
    if (request) payload.wantOther = request;
  }
  return payload;
}

/** IPs exist only in this bounded, process-local bucket; never in KV. */
export function createSurveyLimiter(now = Date.now) {
  const buckets = new Map<string, { tokens: number; at: number }>();
  return (ip: string): number => {
    const at = now();
    const old = buckets.get(ip);
    if (!old) {
      for (const [key, bucket] of buckets) {
        if (at - bucket.at >= HOUR) buckets.delete(key);
      }
      if (buckets.size >= 10000) return 1200;
    }
    const tokens = old ? Math.min(3, old.tokens + (at - old.at) * 3 / HOUR) : 3;
    if (tokens < 1) return Math.ceil((1 - tokens) * HOUR / 3000);
    buckets.set(ip, { tokens: tokens - 1, at });
    return 0;
  };
}

export async function ingestSurvey(
  kv: Deno.Kv,
  site: string | null,
  req: Request,
  ip: string,
  limit: (ip: string) => number,
): Promise<Response> {
  const retry = limit(ip);
  if (retry) {
    return new Response("rate limited", {
      status: 429,
      headers: { "retry-after": String(retry) },
    });
  }
  if (Number(req.headers.get("content-length")) > MAX_BODY) {
    return new Response("body too large", { status: 413 });
  }
  // Count actual bytes too: Content-Length can be absent or misleading.
  const reader = req.body?.getReader();
  if (!reader) return new Response("invalid JSON", { status: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY) {
        await reader.cancel();
        return new Response("body too large", { status: 413 });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const payload = validateSurvey(JSON.parse(new TextDecoder().decode(bytes)));
    if (!payload) return new Response("invalid survey", { status: 400 });
    // Unknown site: same limit, checks and 204 as a real one, but no write, so
    // the response cannot tell a prober which sites exist.
    if (site) {
      const day = new Date().toISOString().slice(0, 10);
      // A 6-part key: readers that expect 5 parts skip it, admin walks keep it.
      const hidden = payload.c?.toLowerCase() === TEST_COMMENT;
      if (hidden) delete payload.c;
      await kv.set(
        [
          "survey",
          site,
          payload.sv,
          day,
          crypto.randomUUID(),
          ...(hidden ? ["hidden"] : []),
        ],
        payload,
      );
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return new Response("invalid JSON", { status: 400 });
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}
