const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../../services/sales/periods");
const { computeRangeAnalytics } = require("../../services/sales/rangeAnalytics");

const NOW = new Date("2026-10-14T06:00:00Z"); // 14 Oct 2026, 11:30 IST

test("date presets resolve in IST with comparable previous periods", () => {
  const r = (preset) => P.resolveRange({ preset }, NOW);
  assert.deepEqual([r("today").start, r("today").end], ["2026-10-14", "2026-10-14"]);
  assert.deepEqual([r("last_7_days").start, r("last_7_days").end], ["2026-10-08", "2026-10-14"]);
  assert.deepEqual([r("last_30_days").start, r("last_30_days").days], ["2026-09-15", 30]);
  assert.deepEqual([r("this_week").start, r("this_week").end], ["2026-10-12", "2026-10-18"], "weeks start on Monday");
  assert.deepEqual([r("previous_week").start, r("previous_week").end], ["2026-10-05", "2026-10-11"]);
  assert.deepEqual([r("this_month").start, r("this_month").end], ["2026-10-01", "2026-10-31"]);
  assert.deepEqual([r("previous_month").start, r("previous_month").end], ["2026-09-01", "2026-09-30"]);
  assert.deepEqual([r("this_quarter").start, r("previous_quarter").start], ["2026-10-01", "2026-07-01"]);
  assert.deepEqual([r("this_year").start, r("this_year").end], ["2026-01-01", "2026-12-31"]);
  assert.equal(P.previousRange(r("this_month")).label, "September 2026");
  assert.equal(P.previousRange(r("last_7_days")).start, "2026-10-01");
  assert.throws(() => P.resolveRange({ start: "2026-10-05", end: "2026-10-01" }), /before the start/);
  assert.equal(P.resolveRange({ start: "2026-07-01", end: "2026-09-30" }).days, 92);
});

test("date cells: Excel serials, ISO, Indian dd/mm/yyyy, month names; month-only values are not dates", () => {
  assert.equal(P.parseDateKey(46296), "2026-10-01");
  assert.equal(P.parseDateKey("05/10/2026"), "2026-10-05");
  assert.equal(P.parseDateKey("5-Oct-26"), "2026-10-05");
  assert.equal(P.parseDateKey("2026-10-05 10:00:00"), "2026-10-05");
  assert.equal(P.parseDateKey("31/02/2026"), null);
  assert.equal(P.parseDateKey("Oct 2026"), null);
});

// ---- engine ------------------------------------------------------------------
const biz = [
  { _id: "A", name: "Cafe A", city: "Ranchi", monthlyTarget: 600000 },
  { _id: "B", name: "Cafe B", city: "Dhanbad", monthlyTarget: 0 },
];
const day = (b, key, sales, extra = {}) => ({ _id: `${b}${key}`, business: b, businessName: `Cafe ${b}`, kind: "day", startKey: key, endKey: key, totalSales: sales, salesBasis: "gross", discount: null, orders: null, source: "excel_upload", ...extra });
const sept = Array.from({ length: 30 }, (_, i) => day("A", `2026-09-${String(i + 1).padStart(2, "0")}`, 20000, { discount: 1000, orders: 50, metrics: { grossAmount: 20000, discount: 1000, netSales: 19000, tax: 950, totalSales: 20300, bills: 50, pax: 110, payments: { cash: 5000, upi: 15300 } } }));
const oct7 = Array.from({ length: 7 }, (_, i) => day("A", `2026-10-0${i + 1}`, 10000));
const monthly = [
  { _id: "m9", business: "A", businessName: "Cafe A", year: 2026, month: 9, monthName: "September 2026", totalSales: 999999, salesBasis: "gross", target: 0, source: "excel_upload" },
  { _id: "m8", business: "B", businessName: "Cafe B", year: 2026, month: 8, monthName: "August 2026", totalSales: 300000, source: "excel_upload" },
  { _id: "m10", business: "A", businessName: "Cafe A", year: 2026, month: 10, monthName: "October 2026", totalSales: 250000, source: "excel_upload" },
  { _id: "roll", business: "A", businessName: "Cafe A", year: 2026, month: 9, monthName: "September 2026", totalSales: 600000, source: "daily_rollup" },
];
const run = (start, end, granularity = "auto") => computeRangeAnalytics({ businesses: biz, monthlyRecords: monthly, entries: [...sept, ...oct7], range: { start, end, label: P.rangeLabel(start, end) }, granularity });

test("complete daily data replaces the monthly summary; derived roll-ups are never counted", () => {
  const a = run("2026-09-01", "2026-09-30");
  assert.equal(a.totals.recordedSales.value, 600000, "30 × 20,000 — not 999,999 and not double");
  assert.equal(a.totals.net.value, 570000);
  assert.equal(a.totals.target.achievement, 100, "whole month -> monthly target");
  assert.equal(a.granularity.used, "day");
  assert.equal(a.trend.length, 30);
  assert.equal(a.totals.source.totalSales.value, 609000, "report Total Sales kept separately");
  assert.equal(a.totals.source.bills.value, 1500);
  assert.equal(a.totals.source.payments.upi.value, 459000);
  assert.ok(a.history.some((h) => h.status === "superseded" && /covers every day/.test(h.reason)));
});

test("incomplete daily data never replaces a full monthly summary; partial overlaps are excluded, not pro-rated", () => {
  const oct = run("2026-10-01", "2026-10-31");
  assert.equal(oct.totals.recordedSales.value, 250000, "monthly total used, the 7 days are not added");
  const week = run("2026-10-01", "2026-10-07");
  assert.equal(week.totals.recordedSales.value, 70000, "the 7 daily rows are used for a 7-day range");
  assert.ok(week.notes.some((n) => n.type === "excluded" && /October 2026/.test(n.text)));
  assert.equal(week.totals.discount.status, "unavailable", "missing discounts stay unavailable (not ₹0)");
  assert.equal(week.totals.target.value, null, "no monthly target for a partial month");
});

test("granularity adapts to the data; forcing daily lists what cannot be plotted", () => {
  const q = run("2026-08-01", "2026-10-31");
  assert.equal(q.granularity.used, "month", "monthly summaries cannot be drawn per day/week");
  assert.deepEqual(q.trend.map((t) => t.recordedSales), [300000, 600000, 250000]);
  assert.equal(q.totals.recordedSales.value, 1150000);
  const forced = run("2026-08-01", "2026-10-31", "day");
  assert.ok(forced.notes.some((n) => n.type === "granularity"));
  assert.equal(forced.totals.recordedSales.value, 1150000, "totals unchanged by the chart granularity");
});

test("growth only against a comparable previous period with data", () => {
  const sep = run("2026-09-01", "2026-09-30");
  assert.equal(sep.period.previous.label, "August 2026");
  assert.equal(sep.totals.growth.recordedSales, 100);
  const jul = run("2026-07-01", "2026-07-31");
  assert.equal(jul.totals.growth.recordedSales, null);
  assert.match(jul.totals.growth.reason, /No data/);
});
