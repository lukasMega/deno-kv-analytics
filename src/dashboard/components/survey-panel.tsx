import { useEffect, useRef, useState } from "preact/hooks";
import type { SurveyPayload } from "../../survey_ingest.ts";
import type { SurveySummary } from "../../survey_reads.ts";
import type { Range } from "../types.ts";

export function SurveyPanel({ token, site, range, refresh }: {
  token: string;
  site: string;
  range: Range;
  refresh: number;
}) {
  const [version, setVersion] = useState("1");
  const [cross, setCross] = useState("os");
  const [question, setQuestion] = useState("nps");
  const [data, setData] = useState<SurveySummary | null>(null);
  const [status, setStatus] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const exportController = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setExportError("");
    if (!site.trim()) {
      setStatus("Pick site first.");
      return;
    }
    setStatus("Loading surveys…");
    fetch(
      `/surveys?${new URLSearchParams({
        site: site.trim(),
        sv: version,
        cross,
        ...range,
      })}`,
      {
        headers: { authorization: `Bearer ${token}` },
        signal: controller.signal,
      },
    ).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "401 unauthorized — check token"
            : `Survey request failed (${response.status})`,
        );
      }
      const result: SurveySummary = await response.json();
      if (!controller.signal.aborted) {
        setData(result);
        setStatus(result.total ? "" : "No survey responses for this range.");
      }
    }).catch((error) => {
      if (!controller.signal.aborted) setStatus(String(error.message));
    });
    return () => controller.abort();
  }, [token, site, range.from, range.to, version, cross, refresh]);
  // Cancel downloads when their token/site/filter context changes or tab closes.
  useEffect(() => {
    setExporting(false);
    return () => exportController.current?.abort();
  }, [token, site, range.from, range.to, version]);
  const exportJson = async () => {
    exportController.current?.abort();
    const controller = new AbortController();
    exportController.current = controller;
    setExporting(true);
    setExportError("");
    const responses: (SurveyPayload & { day: string })[] = [];
    let cursor: string | null = null;
    try {
      do {
        const query = new URLSearchParams({
          site: site.trim(),
          sv: version,
          ...range,
          ...(cursor ? { cursor } : {}),
        });
        const response = await fetch(`/surveys/export?${query}`, {
          headers: { authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Export failed (${response.status})`);
        const page: {
          responses: (SurveyPayload & { day: string })[];
          cursor: string | null;
        } = await response.json();
        responses.push(...page.responses);
        cursor = page.cursor;
      } while (cursor);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(
        new Blob([
          JSON.stringify(
            { site: site.trim(), sv: Number(version), ...range, responses },
            null,
            2,
          ),
        ], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        `surveys-${site.trim()}-v${version}-${range.from}_${range.to}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (!controller.signal.aborted) {
        setExportError(String((error as Error).message));
      }
    } finally {
      if (!controller.signal.aborted) setExporting(false);
    }
  };
  const groups = Object.entries(data?.groups ?? {}).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  const questions = Object.keys(data?.counts ?? {});
  const activeQuestion = questions.includes(question) ? question : questions[0];
  return (
    <div id="surveys">
      <div class="toolbar surveyControls">
        <label>
          Survey version{" "}
          <input
            id="surveyVersion"
            type="number"
            min="1"
            step="1"
            value={version}
            onInput={(event) => setVersion(event.currentTarget.value)}
          />
        </label>
        <label>
          Group by{" "}
          <select
            id="surveyCross"
            value={cross}
            onChange={(event) => setCross(event.currentTarget.value)}
          >
            <option value="os">OS</option>
            <option value="dv">Model</option>
            <option value="v">App version</option>
          </select>
        </label>
        <button
          id="exportSurveys"
          type="button"
          disabled={exporting || !data}
          onClick={exportJson}
        >
          {exporting ? "Exporting…" : "Export JSON"}
        </button>
      </div>
      <p class="msg" role="status">{status}</p>
      {exportError && <p class="msg err" role="alert">{exportError}</p>}
      {data && data.total > 0 && (
        <>
          <div class="kpiRow">
            <div class="kpiTile">
              <div class="kpiVal">{data.total}</div>
              <div class="kpiLabel">responses · survey v{data.sv}</div>
            </div>
            <div class="kpiTile">
              <div class="kpiVal">{data.nps.score ?? "—"}</div>
              <div class="kpiLabel">NPS · {data.nps.answered} answers</div>
            </div>
            <div class="kpiTile">
              <div class="kpiVal">{data.nps.promoters}</div>
              <div class="kpiLabel">promoters (9–10)</div>
            </div>
            <div class="kpiTile">
              <div class="kpiVal">{data.nps.detractors}</div>
              <div class="kpiLabel">detractors (0–6)</div>
            </div>
          </div>
          <h2>Answers</h2>
          <p class="hint">
            Share of all responses. Skipped questions reduce percentages;
            multiple selections can exceed 100%.
          </p>
          <div class="surveyAnswers cards">
            {Object.entries(data.counts).map(([id, counts]) => (
              <div class="bdGroup" key={id}>
                <h3 class="dim">{id}</h3>
                {Object.entries(counts).sort(([, left], [, right]) =>
                  right - left
                ).map(([option, count]) => (
                  <div class="barRow" key={option}>
                    <div
                      class="barFill"
                      style={{ width: `${count / data.total * 100}%` }}
                    />
                    <span class="barLabel" title={option}>{option}</span>
                    <span class="barCount">
                      {count}
                      <span class="barPct">
                        {Math.round(count / data.total * 100)}%
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <h2>Cross-tab</h2>
          <label>
            Question{" "}
            <select
              id="surveyQuestion"
              value={activeQuestion}
              onChange={(event) => setQuestion(event.currentTarget.value)}
            >
              {questions.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          {cross === "dv" && (
            <p class="hint">
              Responses with several models appear in each model group.
            </p>
          )}
          <div class="surveyTable">
            <table>
              <thead>
                <tr>
                  <th>{activeQuestion ?? "Option"}</th>
                  {groups.map(([name, group]) => (
                    <th key={name}>
                      {name}
                      <br />
                      {group.total} responses
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(data.counts[activeQuestion] ?? {}).map((
                  option,
                ) => (
                  <tr key={option}>
                    <td>{option}</td>
                    {groups.map(([name, group]) => (
                      <td class="n" key={name}>
                        {group.counts[activeQuestion]?.[option] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>Comments ({data.comments.length})</h2>
          {data.comments.map((comment, index) => (
            <div class="surveyComment" key={index}>
              <small>{comment.day} UTC</small>
              <p>{comment.c}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
