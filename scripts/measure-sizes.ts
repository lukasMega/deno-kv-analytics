// Measures the only bytes a tracked page pays for: the built, minified client
// bundle served at /s.js. Server source is not measured — it is uploaded once
// at deploy time and never reaches a visitor, so its size is not a metric
// anyone is optimizing.
//
// Writes scripts/.sizes.csv and prints a summary.
//   deno task sizes   (builds the beacon first — a stale s.js reports a number
//                      that never shipped)
const root = new URL("../", import.meta.url);
const here = new URL("./", import.meta.url);

const BUNDLE = "src/s.js";

// Transfer size is what a visitor pays, not the on-disk size: Deploy serves
// /s.js compressed. gzip is the conservative floor (br is usually ~15% smaller).
async function gzipped(bytes: Uint8Array): Promise<number> {
  const stream = new Blob([bytes as BufferSource]).stream().pipeThrough(
    new CompressionStream("gzip"),
  );
  return (await new Response(stream).arrayBuffer()).byteLength;
}

const kb = (n: number) => (n / 1024).toFixed(2);

const raw = await Deno.readFile(new URL(BUNDLE, root));
const gzip = await gzipped(raw);

const csv = [
  "artifact,path,bytes,kb,gzip_bytes,gzip_kb",
  `client-bundle,${BUNDLE},${raw.byteLength},${kb(raw.byteLength)},${gzip},${
    kb(gzip)
  }`,
].join("\n") + "\n";

const out = new URL(".sizes.csv", here);
await Deno.writeTextFile(out, csv);

console.log(
  `client bundle ${BUNDLE}: ${kb(raw.byteLength)} kB raw, ${
    kb(gzip)
  } kB gzip (${raw.byteLength} / ${gzip} bytes)`,
);
console.log(
  `Per visitor: ${kb(gzip)} kB gzip, once, cached + one 43-byte gif.`,
);
console.log(`Wrote ${out.pathname}`);
