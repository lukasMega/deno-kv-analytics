// README badge: render a shields-style SVG from a single number.
//
// Rendered here rather than delegating to shields.io's endpoint protocol so that
// no third party is handed the site id and the count of every project that uses
// one — a badge is embedded in a public README, so every reader would otherwise
// hit shields.io on our behalf.
//
// Pure: no KV, no Deno APIs, so main.ts owns the reading and this owns the
// pixels. See main.ts `/badge` for the tenancy rules.

/** 12 345 → "12.3k". Keeps the badge a fixed-ish width as a counter grows. */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return (k < 10 ? k.toFixed(1).replace(/\.0$/, "") : Math.round(k)) + "k";
  }
  const m = n / 1_000_000;
  return (m < 10 ? m.toFixed(1).replace(/\.0$/, "") : Math.round(m)) + "M";
}

// Verdana 11px averages ~6.5px/char; digits and lowercase sit close enough to
// that for a badge, and the label is length-capped by the caller. Being a pixel
// or two off only changes the padding, never legibility.
const textWidth = (s: string) => Math.ceil(s.length * 6.6) + 10;

const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    })[c]!);

/** Label text is user-supplied via `?label=` — keep it to a shape that cannot
 * carry markup and cannot stretch the badge off the page. */
export function safeLabel(raw: string | null, fallback: string): string {
  const s = (raw ?? "").replace(/[^\w .%+-]/g, "").trim().slice(0, 24);
  return s || fallback;
}

/** `?color=` is a hex color only; anything else falls back. */
export function safeColor(raw: string | null, fallback = "#0b6bcb"): string {
  const s = (raw ?? "").replace(/^#/, "");
  return /^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(s) ? `#${s}` : fallback;
}

/**
 * Flat badge, shields.io's classic geometry: label box, one or more colored
 * value boxes, a 1px gradient overlay and the text drawn twice (dark shadow +
 * white) so it stays readable against every segment.
 *
 * `value` takes an array to render several numbers in one image — the window
 * count next to the all-time count. Kept as one SVG rather than two badges so a
 * README needs one request and the boxes line up; a single string still renders
 * byte-identically to the original two-box badge.
 *
 * `color` may be one entry per value; a short list reuses its last entry, so a
 * single color still paints every box.
 */
export function badgeSvg(
  label: string,
  value: string | string[],
  color: string | string[] = "#0b6bcb",
  labelColor = "#555",
): string {
  const values = (Array.isArray(value) ? value : [value]).map(escapeXml);
  const colors = Array.isArray(color) ? color : [color];
  const lw = textWidth(label);
  const vws = values.map(textWidth);
  const w = lw + vws.reduce((a, b) => a + b, 0);
  const l = escapeXml(label);

  const rects: string[] = [];
  const texts: string[] = [];
  let x = lw;
  for (let i = 0; i < values.length; i++) {
    const fill = colors[i] ?? colors[colors.length - 1];
    rects.push(
      `<rect x="${x}" width="${vws[i]}" height="20" fill="${fill}"/>`,
    );
    const cx = x + vws[i] / 2;
    texts.push(
      `<text x="${cx}" y="15" fill="#010101" fill-opacity=".3">${
        values[i]
      }</text>`,
      `<text x="${cx}" y="14">${values[i]}</text>`,
    );
    x += vws[i];
  }

  // aria-label, not <title>: a badge is content, and screen readers should read
  // "views: 12.3k" rather than announcing an unlabeled image.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${l}: ${
    values.join(", ")
  }">
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)">
<rect width="${lw}" height="20" fill="${labelColor}"/>
${rects.join("\n")}
<rect width="${w}" height="20" fill="url(#s)"/>
</g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${lw / 2}" y="15" fill="#010101" fill-opacity=".3">${l}</text>
<text x="${lw / 2}" y="14">${l}</text>
${texts.join("\n")}
</g>
</svg>`;
}
