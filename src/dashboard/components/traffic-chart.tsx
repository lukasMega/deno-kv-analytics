import { useEffect, useRef, useState } from "preact/hooks";
import type { SeriesRow } from "../types.ts";

interface UPlot {
  destroy(): void;
  setSize(size: { width: number; height: number }): void;
}
type UPlotConstructor = new (
  options: object,
  data: number[][],
  target: HTMLElement,
) => UPlot;
let loader: Promise<UPlotConstructor> | null = null;
function loadUplot(): Promise<UPlotConstructor> {
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/vendor/uPlot.min.css";
    document.head.append(css);
    const script = document.createElement("script");
    script.src = "/vendor/uPlot.iife.min.js";
    script.onload = () => {
      const candidate = (globalThis as { uPlot?: UPlotConstructor }).uPlot;
      candidate ? resolve(candidate) : reject(new Error("uPlot unavailable"));
    };
    script.onerror = () => reject(new Error("failed to load uPlot"));
    document.head.append(script);
  });
  return loader;
}

export function TrafficChart(
  { series, showBots }: { series: SeriesRow[]; showBots: boolean },
) {
  const target = useRef<HTMLDivElement>(null);
  const chart = useRef<UPlot | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    const element = target.current;
    if (!element || !series.length) return;
    loadUplot().then((Uplot) => {
      if (!live) return;
      const points = { show: series.length < 60 };
      const app = series.map((row) => row[5]);
      const bots = series.map((row) => row[4]);
      const showApp = app.some((count) => count > 0);
      chart.current?.destroy();
      chart.current = new Uplot({
        width: element.parentElement?.clientWidth || 300,
        height: 180,
        padding: [10, 10, 0, 0],
        legend: { show: true },
        cursor: { show: true },
        scales: { x: { time: true } },
        axes: [{
          stroke: "#6b7684",
          grid: { stroke: "#20262f" },
          ticks: { stroke: "#20262f" },
        }, {
          stroke: "#6b7684",
          grid: { stroke: "#20262f" },
          ticks: { stroke: "#20262f" },
        }],
        series: [
          {},
          {
            label: "pageviews",
            stroke: "#88c0d0",
            width: 2,
            fill: "rgba(136,192,208,0.15)",
            points,
          },
          { label: "unique visitors", stroke: "#a3be8c", width: 2, points },
          { label: "sessions", stroke: "#ebcb8b", width: 2, points },
          ...(showBots
            ? [{
              label: "bots",
              stroke: "#d08770",
              width: 1,
              dash: [4, 4],
              points,
            }]
            : []),
          ...(showApp
            ? [{ label: "app pings", stroke: "#b48ead", width: 2, points }]
            : []),
        ],
      }, [
        series.map((row) => Date.parse(`${row[0]}T00:00:00Z`) / 1000),
        series.map((row) => row[1]),
        series.map((row) => row[2]),
        series.map((row) => row[3]),
        ...(showBots ? [bots] : []),
        ...(showApp ? [app] : []),
      ], element);
    }).catch(() => setFailed(true));
    return () => {
      live = false;
      chart.current?.destroy();
      chart.current = null;
    };
  }, [series, showBots]);
  useEffect(() => {
    const resize = () =>
      chart.current?.setSize({
        width: target.current?.parentElement?.clientWidth || 300,
        height: 180,
      });
    globalThis.addEventListener("resize", resize);
    return () => globalThis.removeEventListener("resize", resize);
  }, []);
  return failed
    ? (
      <p class="hint">
        chart unavailable (uPlot failed to load — check /vendor/)
      </p>
    )
    : <div id="chart" ref={target} />;
}
