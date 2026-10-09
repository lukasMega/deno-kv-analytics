import { assertEquals, assertThrows } from "@std/assert";
import { parseStats } from "./dashboard/api.ts";
import { csv, csvCell } from "./dashboard/csv.ts";
import { addDays, periodRange, priorRange } from "./dashboard/dates.ts";
import { delta, heatmapColor, metrics } from "./dashboard/metrics.ts";

Deno.test("dashboard dates keep UTC boundaries", () => {
  assertEquals(addDays("2028-02-28", 1), "2028-02-29");
  assertEquals(periodRange("lastMonth", "2027-03-04"), {
    from: "2027-02-01",
    to: "2027-02-28",
  });
  assertEquals(periodRange("all", "2026-06-20"), {
    from: "2026-06-23",
    to: "2026-06-23",
  });
  assertEquals(priorRange({ from: "2026-07-01", to: "2026-07-07" }), {
    from: "2026-06-24",
    to: "2026-06-30",
  });
});

Deno.test("dashboard metrics handle empty counters", () => {
  const values = metrics({
    pv: { _: 10 },
    uv: { _: 4 },
    sessions: { _: 4 },
    bounce: { _: 1 },
    hi: { fast: 3 },
  });
  assertEquals(values.viewsPerVisit.value, "2.5");
  assertEquals(values.bounce.value, "25%");
  assertEquals(values.engagement.value, "75%");
  assertEquals(delta(5, 0), { text: "—", className: "flat" });
  assertEquals(heatmapColor(0, 2), "#0e1116");
});

Deno.test("dashboard CSV quotes values and preserves dimensions", () => {
  assertEquals(csvCell('x,"y"'), '"x,""y"""');
  assertEquals(
    csv({ path: { "a,b": 2 }, bot: { ua: 1 } }),
    'dim,value,count\npath,"a,b",2\nbot,ua,1',
  );
});

Deno.test("dashboard rejects malformed series", () => {
  assertThrows(() => parseStats({ series: [["2026-01-01", 1]] }));
  assertEquals(
    parseStats({
      pv: { _: 2 },
      unknown: "ignored",
      series: [["2026-01-01", 1, 1, 1, 0, 0]],
    }).pv?._,
    2,
  );
});
