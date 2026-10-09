import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { CountMap } from "../types.ts";

interface Maps {
  countryMap(rows: [string, number][]): string;
  timezoneMap(rows: [string, number][]): string;
  timezoneGlobe(zones: string[]): string;
}

let maps: Promise<Maps> | null = null;
const loadMaps = () => {
  const url = new URL("/timezone-globe.js", globalThis.location.origin).href;
  return maps ??= import(url) as Promise<Maps>;
};
const sortedRows = (counts?: CountMap): [string, number][] =>
  Object.entries(counts ?? {}).sort((left, right) => right[1] - left[1]);
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
const zooms = [
  ["world", "World", "0 0 360 180"],
  ["north-america", "North America", "0 0 150 75"],
  ["south-america", "South America", "75 70 110 55"],
  ["europe", "Europe", "140 5 100 50"],
  ["asia", "Asia", "220 0 145 72.5"],
  ["africa", "Africa", "125 35 140 70"],
  ["oceania", "Oceania", "230 60 120 60"],
] as const;

type MapKind = "country" | "timezone";
const config = (kind: MapKind) =>
  kind === "country"
    ? {
      dot: "data-country-dot",
      pointer: ".countryPointer",
      highlight: "countryHighlight",
      arrow: "countryArrow",
    }
    : {
      dot: "data-timezone-dot",
      pointer: ".timezoneMapPointer",
      highlight: "timezoneMapHighlight",
      arrow: "timezoneMapArrow",
    };

function clearPointer(root: HTMLElement, kind: MapKind) {
  const item = config(kind);
  root.querySelector<SVGGElement>(item.pointer)?.replaceChildren();
  root.querySelectorAll<SVGCircleElement>(`[${item.dot}]`).forEach((circle) => {
    circle.classList.remove(item.highlight);
    circle.style.removeProperty("stroke-width");
  });
}

function showPointer(root: HTMLElement, kind: MapKind, value: string) {
  const item = config(kind);
  const circle = [...root.querySelectorAll<SVGCircleElement>(`[${item.dot}]`)]
    .find((candidate) => candidate.getAttribute(item.dot) === value);
  const pointer = root.querySelector<SVGGElement>(item.pointer);
  const map = root.querySelector<SVGSVGElement>("svg");
  if (!circle || !pointer || !map) return;
  clearPointer(root, kind);
  circle.classList.add(item.highlight);
  const scale = 360 / Number(map.viewBox.baseVal.width);
  circle.style.strokeWidth = String(2.5 / scale);
  const x = Number(circle.getAttribute("cx"));
  const y = Number(circle.getAttribute("cy"));
  const startX = x < 48 ? x + 44 / scale : x - 44 / scale;
  const startY = y < 36 ? y + 38 / scale : y - 34 / scale;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${startX} ${startY} L ${x} ${y}`);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#eceff4");
  path.setAttribute("stroke-width", String(2 / scale));
  path.setAttribute("marker-end", `url(#${item.arrow})`);
  pointer.replaceChildren(path);
}

function setZoom(root: HTMLElement, id: string) {
  const zoom = zooms.find(([zoomId]) => zoomId === id);
  const map = root.querySelector<SVGSVGElement>("svg");
  if (!zoom || !map) return;
  map.setAttribute("viewBox", zoom[2]);
  clearPointer(root, root.matches("#countryModal") ? "country" : "timezone");
  const scale = 360 / Number(zoom[2].split(" ")[2]);
  const world = zoom[0] === "world";
  map.querySelectorAll<SVGCircleElement>(
    "[data-country-dot], [data-timezone-dot]",
  ).forEach((dot) => {
    const base = Number(dot.dataset.baseRadius ?? dot.getAttribute("r"));
    dot.dataset.baseRadius = String(base);
    dot.setAttribute("r", String(world ? base : base * 0.8 / scale));
  });
  map.querySelectorAll<SVGTextElement>("text").forEach((label) => {
    const base = Number(
      label.dataset.baseFontSize ?? label.getAttribute("font-size"),
    );
    label.dataset.baseFontSize = String(base);
    label.setAttribute("font-size", String(world ? base : base * 0.8 / scale));
  });
  root.querySelectorAll("[data-map-zoom]").forEach((button) =>
    button.setAttribute(
      "aria-pressed",
      String((button as HTMLElement).dataset.mapZoom === id),
    )
  );
}

function Dialog(
  { id, title, children, close }: {
    id: string;
    title: string;
    children: ComponentChildren;
    close(): void;
  },
) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      id={id}
      ref={ref}
      aria-labelledby={`${id}Title`}
      onClose={close}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        const zoom = target.closest<HTMLElement>("[data-map-zoom]");
        if (zoom && zoom.dataset.mapZoom) {
          setZoom(ref.current!, zoom.dataset.mapZoom);
          return;
        }
        if (event.target === ref.current) ref.current?.close();
      }}
    >
      <div class="timezoneModalHead">
        <h2 id={`${id}Title`}>{title}</h2>
        <form method="dialog">
          <button type="submit" aria-label={`Close ${title}`}>✕</button>
        </form>
      </div>
      {children}
    </dialog>
  );
}

function ZoomControls() {
  return (
    <div class="mapZoom" role="group" aria-label="Map region">
      {zooms.map(([id, label], index) => (
        <button
          key={id}
          type="button"
          data-map-zoom={id}
          aria-pressed={index === 0}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function MapMarkup({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export function MapDialogs(
  { country, timezone, offset, close }: {
    country?: CountMap;
    timezone?: CountMap;
    offset: string | null;
    close(): void;
  },
) {
  const [map, setMap] = useState<Maps | null>(null);
  useEffect(() => {
    if (country || timezone || offset) loadMaps().then(setMap).catch(close);
  }, [country, timezone, offset, close]);
  if (!map) return null;
  if (offset) {
    const now = new Date();
    const zones = Intl.supportedValuesOf("timeZone").filter((zone) =>
      new Intl.DateTimeFormat("en", {
        timeZone: zone,
        timeZoneName: "longOffset",
      }).formatToParts(now).find((part) => part.type === "timeZoneName")?.value
        .replace("GMT", "UTC").replace(/^UTC$/, "UTC+00:00") === offset
    );
    return (
      <Dialog
        id="timezoneModal"
        title={`${offset} · timezone details`}
        close={close}
      >
        <p class="hint">
          Current offsets today. Offset alone cannot identify timezone. DST
          changes matches.
        </p>
        <div class="timezoneModalBody">
          <div>
            <MapMarkup html={map.timezoneGlobe(zones)} />
            <p class="hint">Gold dots: matching timezone locations.</p>
          </div>
          <div class="timezoneList">
            <h3>{zones.length} matching timezones</h3>
            <ul>{zones.map((zone) => <li key={zone}>{zone}</li>)}</ul>
          </div>
        </div>
      </Dialog>
    );
  }
  if (country) {
    const data = sortedRows(country);
    const total = data.reduce((sum, [, count]) => sum + count, 0);
    return (
      <Dialog id="countryModal" title="Country traffic" close={close}>
        <div class="countryModalBody">
          <div>
            <ZoomControls />
            <MapMarkup html={map.countryMap(data)} />
            <p class="hint">Dot size and color show traffic count.</p>
          </div>
          <div class="timezoneList">
            <h3>{total} visits across {data.length} countries</h3>
            <ul>
              {data.map(([code, count]) => (
                <li
                  key={code}
                  class="countryListItem"
                  data-country={code}
                  title={countryNames.of(code) ?? code}
                  aria-label={`${countryNames.of(code) ?? code}: ${count}`}
                  onPointerOver={(event) =>
                    showPointer(
                      event.currentTarget.closest("dialog")!,
                      "country",
                      code,
                    )}
                  onPointerOut={(event) => {
                    if (
                      !event.currentTarget.contains(event.relatedTarget as Node)
                    ) {
                      clearPointer(
                        event.currentTarget.closest("dialog")!,
                        "country",
                      );
                    }
                  }}
                >
                  {code}: {count}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Dialog>
    );
  }
  if (timezone) {
    const data = sortedRows(timezone);
    const total = data.reduce((sum, [, count]) => sum + count, 0);
    return (
      <Dialog id="timezoneMapModal" title="Timezone traffic" close={close}>
        <div class="timezoneMapModalBody">
          <div>
            <ZoomControls />
            <MapMarkup html={map.timezoneMap(data)} />
            <p class="hint">Dot size and color show traffic count.</p>
          </div>
          <div class="timezoneList">
            <h3>{total} visits across {data.length} timezones</h3>
            <ul>
              {data.map(([zone, count]) => (
                <li
                  key={zone}
                  class="timezoneMapListItem"
                  data-timezone={zone}
                  title={zone}
                  onPointerOver={(event) =>
                    showPointer(
                      event.currentTarget.closest("dialog")!,
                      "timezone",
                      zone,
                    )}
                  onPointerOut={(event) => {
                    if (
                      !event.currentTarget.contains(event.relatedTarget as Node)
                    ) {
                      clearPointer(
                        event.currentTarget.closest("dialog")!,
                        "timezone",
                      );
                    }
                  }}
                >
                  {zone}: {count}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Dialog>
    );
  }
  return null;
}
