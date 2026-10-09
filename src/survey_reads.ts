import type { SurveyPayload } from "./survey_ingest.ts";

type Counts = Record<string, Record<string, number>>;
export interface SurveySummary {
  site: string;
  sv: number;
  total: number;
  counts: Counts;
  nps: {
    score: number | null;
    answered: number;
    promoters: number;
    detractors: number;
  };
  cross: string;
  groups: Record<string, { total: number; counts: Counts }>;
  comments: (
    & { day: string }
    & Pick<SurveyPayload, "c" | "useForOther" | "wantOther">
  )[];
}

function add(counts: Counts, answers: SurveyPayload["a"]) {
  for (const [question, answer] of Object.entries(answers)) {
    const options = counts[question] ??= Object.create(null);
    for (const value of Array.isArray(answer) ? answer : [answer]) {
      options[value] = (options[value] ?? 0) + 1;
    }
  }
}

function validDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    !Number.isNaN(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day;
}

/** Auth is checked by main.ts before any survey data is read. */
export async function readSurveys(
  kv: Deno.Kv,
  site: string,
  url: URL,
): Promise<Response> {
  const sv = Number(url.searchParams.get("sv") ?? "1");
  const from = url.searchParams.get("from") ?? "0000-01-01";
  const to = url.searchParams.get("to") ?? "9999-12-31";
  const cross = url.searchParams.get("cross") ?? "os";
  if (
    !Number.isSafeInteger(sv) || sv < 1 || !validDay(from) || !validDay(to) ||
    from > to ||
    !["os", "dv", "v"].includes(cross)
  ) {
    return new Response("invalid survey filters", { status: 400 });
  }
  const selector = {
    start: ["survey", site, sv, from],
    end: ["survey", site, sv, to, "\uffff"],
  };
  const headers = { "cache-control": "no-store" };
  if (url.pathname === "/surveys/export") {
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const rows = kv.list<SurveyPayload>(selector, { limit: 100, cursor });
    const responses: (SurveyPayload & { day: string })[] = [];
    try {
      for await (const row of rows) {
        if (row.key.length === 5) {
          responses.push({ day: String(row.key[3]), ...row.value });
        }
      }
    } catch (error) {
      if (error instanceof TypeError) {
        return new Response("invalid cursor", { status: 400 });
      }
      throw error;
    }
    return Response.json({
      site,
      sv,
      responses,
      cursor: responses.length === 100 ? rows.cursor : null,
    }, { headers });
  }
  const summary: SurveySummary = {
    site,
    sv,
    total: 0,
    counts: Object.create(null),
    nps: { score: null, answered: 0, promoters: 0, detractors: 0 },
    cross,
    groups: Object.create(null),
    comments: [],
  };
  for await (const row of kv.list<SurveyPayload>(selector)) {
    if (row.key.length !== 5) continue;
    const payload = row.value;
    summary.total++;
    add(summary.counts, payload.a);
    const nps = payload.a.nps;
    if (typeof nps === "string" && /^(\d|10)$/.test(nps)) {
      summary.nps.answered++;
      if (Number(nps) >= 9) summary.nps.promoters++;
      if (Number(nps) <= 6) summary.nps.detractors++;
    }
    const groups = cross === "dv"
      ? (payload.dv ?? "unknown").split(",")
      : [payload[cross as "os" | "v"] ?? "unknown"];
    for (const name of groups) {
      const group = summary.groups[name] ??= {
        total: 0,
        counts: Object.create(null),
      };
      group.total++;
      add(group.counts, payload.a);
    }
    if (payload.c || payload.useForOther || payload.wantOther) {
      summary.comments.push({
        day: String(row.key[3]),
        ...(payload.c ? { c: payload.c } : {}),
        ...(payload.useForOther ? { useForOther: payload.useForOther } : {}),
        ...(payload.wantOther ? { wantOther: payload.wantOther } : {}),
      });
    }
  }
  if (summary.nps.answered) {
    summary.nps.score = Math.round(
      100 * (summary.nps.promoters - summary.nps.detractors) /
        summary.nps.answered,
    );
  }
  summary.comments.reverse();
  return Response.json(summary, { headers });
}
