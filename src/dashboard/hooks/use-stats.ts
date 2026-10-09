import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { parseStats } from "../api.ts";
import { clampFrom, LAUNCH, priorRange } from "../dates.ts";
import type { Range, Stats } from "../types.ts";

export type RequestState =
  | "idle"
  | "loading"
  | "ready"
  | "unauthorized"
  | "error"
  | "empty";
export interface StatsState {
  state: RequestState;
  data: Stats | null;
  prior: Stats | null;
  error: string | null;
}

export function useStats(
  token: string,
  site: string,
  range: Range,
): StatsState & { load: () => void } {
  const [result, setResult] = useState<StatsState>({
    state: "idle",
    data: null,
    prior: null,
    error: null,
  });
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    if (!site.trim()) {
      setResult({ state: "empty", data: null, prior: null, error: null });
      return;
    }
    const active = new AbortController();
    controller.current = active;
    setResult((old) => ({ ...old, state: "loading", error: null }));
    const request = (value: Range, series = false) =>
      fetch(
        `/stats?${new URLSearchParams({
          site: site.trim(),
          from: value.from,
          to: value.to,
          ...(series ? { series: "1" } : {}),
        })}`,
        {
          headers: { authorization: `Bearer ${token}` },
          signal: active.signal,
        },
      );
    try {
      const response = await request(range, true);
      if (response.status === 401) {
        setResult({
          state: "unauthorized",
          data: null,
          prior: null,
          error: null,
        });
        return;
      }
      if (!response.ok) throw new Error(`/stats returned ${response.status}`);
      const data = parseStats(await response.json());
      let prior: Stats | null = null;
      const priorPeriod = priorRange(range);
      if (priorPeriod.to >= LAUNCH) {
        try {
          const priorResponse = await request({
            from: clampFrom(priorPeriod.from),
            to: priorPeriod.to,
          });
          if (priorResponse.ok) prior = parseStats(await priorResponse.json());
        } catch (error) {
          if ((error as Error).name === "AbortError") throw error;
        }
      }
      if (!active.signal.aborted) {
        setResult({ state: "ready", data, prior, error: null });
      }
    } catch (error) {
      if (!active.signal.aborted) {
        setResult({
          state: "error",
          data: null,
          prior: null,
          error: String(error),
        });
      }
    }
  }, [token, site, range.from, range.to]);
  useEffect(() => {
    load();
    return () => controller.current?.abort();
  }, [load]);
  return { ...result, load };
}
