// Fails if a build artifact exceeds a byte budget. Used by `deno task check-size`
// to keep the browser beacon small — it is fetched by every visitor on every
// page, so growth there is paid for by everyone.
//   deno run --allow-read scripts/check-size.ts s.js 4096
const [file, limit] = Deno.args;
const size = (await Deno.stat(new URL(`../${file}`, import.meta.url))).size;
const max = Number(limit);
console.log(`${file}: ${size} bytes (limit ${max})`);
if (size > max) {
  console.error(`${file} is ${size - max} bytes over budget`);
  Deno.exit(1);
}
