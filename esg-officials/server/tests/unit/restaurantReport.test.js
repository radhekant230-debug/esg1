/**
 * Restaurant POS day-wise report (Petpooja "All Restaurant Report - Day Wise"
 * layout). Runs against:
 *   - the synthetic fixture built by tests/fixtures/makeRestaurantDayWise.js
 *     (same layout, invented names and numbers), and
 *   - the REAL exported report, if saved as tests/fixtures/restaurant-daywise-real.xlsx
 *     (or .csv). The real file is the regression fixture for production layout.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const R = require("../../services/sales/reportParsers/restaurantDayWise");
const parser = require("../../services/sales/importParser");
const { buildRows, HEADERS } = require("../fixtures/makeRestaurantDayWise");

const FIX = path.join(__dirname, "..", "fixtures");
const parseRows = (rows) => R.parseSheet(rows, "Report");
const sheetRowsOf = (aoa, asCsv = false) => {
  if (!asCsv) {
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(aoa), "Report");
    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    return parser.readRawSheets(buf, "r.xlsx")[0].rows;
  }
  const csv = aoa.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(",")).join("\r\n");
  return parser.readRawSheets(Buffer.from("﻿" + csv), "r.csv")[0].rows;
};

for (const asCsv of [false, true]) {
  test(`synthetic ${asCsv ? "CSV" : "Excel"} report: header row, 30 daily rows, summaries excluded, invoice ranges kept`, () => {
    const r = parseRows(sheetRowsOf(buildRows(), asCsv));
    assert.ok(r, "detected as a day-wise report");
    assert.equal(r.headerRow, 4, "header found below the metadata lines");
    assert.equal(r.meta.reportName, "All Restaurant Report - Day Wise");
    assert.equal(r.meta.periodStart, "2026-09-01");
    assert.equal(r.meta.periodEnd, "2026-09-30");
    assert.equal(r.sections.length, 1);
    const sec = r.sections[0];
    assert.equal(sec.restaurant, "SAMPLE BISTRO");
    assert.equal(sec.days.length, 30, "30 daily records");
    assert.ok(sec.days.every((d) => d.date >= "2026-09-01" && d.date <= "2026-09-30"));
    assert.equal(new Set(sec.days.map((d) => d.date)).size, 30);
    assert.equal(sec.days[0].invoiceNos, "10781-10855", "invoice range preserved as text");
    assert.ok(sec.days.every((d) => typeof d.invoiceNos === "string" && /^\d+-\d+$/.test(d.invoiceNos)));
    assert.deepEqual(Object.keys(sec.summaries).sort(), ["avg", "max", "min", "total"], "Total/Min./Max./Avg. recognised as summaries");
    assert.equal(r.reportSummaries.filter((x) => x.type === "subTotal").length, 1, "Sub Total recognised");
    assert.equal(r.invalidRows.length, 0);
    assert.equal(r.subTotalRelation.equalsSumOfSectionTotals, true);
    assert.match(r.subTotalRelation.note, /counted once/);
    assert.ok(sec.reconciliation.length > 10 && sec.reconciliation.every((c) => c.ok), "daily rows reconcile with Total/Min/Max/Avg");
    assert.deepEqual(r.warnings, []);
  });
}

test("blank restaurant cells are forward-filled only inside their section; a second restaurant starts a new section", () => {
  const a = buildRows({ restaurant: "OUTLET ONE", days: 3 });
  const b = buildRows({ restaurant: "OUTLET TWO", days: 3, seed: 9 });
  const rows = [...a.slice(0, a.length - 2), ...b.slice(4, b.length - 2)]; // two sections, then one Sub Total
  const sub = ["Sub Total", "", "", ...HEADERS.slice(3).map((_, j) => {
    const i = j + 3;
    const vals = [...a.slice(4, 7), ...b.slice(4, 7)].map((r) => r[i]);
    return Math.round(vals.reduce((x, y) => x + y, 0) * 100) / 100;
  })];
  rows.push([], sub);
  const r = parseRows(sheetRowsOf(rows));
  assert.deepEqual(r.sections.map((s) => [s.restaurant, s.days.length]), [["OUTLET ONE", 3], ["OUTLET TWO", 3]]);
  assert.equal(r.subTotalRelation.equalsSumOfSectionTotals, true);
  assert.match(r.subTotalRelation.note, /not added again/);
  // a daily row with a blank name AFTER a section's Total cannot be assigned
  const orphan = [...a.slice(0, a.length - 2)];
  orphan.push(["", "2026-09-04", "1-2", 2, 100, 0, 100, 0, 0, 0, 5, 0, 0, 105, 0, 105, 0, 0, 0, 0, 0, 0, 2]);
  const r2 = parseRows(sheetRowsOf(orphan));
  assert.equal(r2.invalidRows.length, 1);
  assert.match(r2.invalidRows[0].errors[0], /blank after the summary rows/);
});

test("discrepancies are flagged, never corrected", () => {
  const rows = buildRows({
    mutate: (daily) => {
      daily[4][6] = daily[4][6] + 10; // Net Sales off by ₹10 on day 5
      daily[9][15] = daily[9][15] + 500; // payments don't add up on day 10
    },
  });
  // Total row is built from the mutated daily rows, so make it disagree too:
  rows[rows.length - 6][13] += 1; // Total Sales in the Total row +₹1
  const r = parseRows(sheetRowsOf(rows));
  const sec = r.sections[0];
  const d5 = sec.days.find((d) => d.date === "2026-09-05");
  assert.ok(d5.warnings.some((w) => /My Amount − Total Discount = Net Sales/.test(w)));
  const v = R.toEntryValues(d5);
  assert.equal(v.metrics.netSales, Math.round((d5.values.netSales) ) / 100, "reported Net Sales stored unchanged");
  assert.ok(v.reconciliation.length >= 1);
  const d10 = sec.days.find((d) => d.date === "2026-09-10");
  assert.ok(d10.warnings.some((w) => /Payments/.test(w)));
  assert.ok(r.warnings.some((w) => /Total Sales add up to the Total row/.test(w)), "daily vs Total mismatch reported");
  assert.equal(sec.days.length, 30, "rows with warnings are still imported (with the warning), not dropped");
});

test("dates outside the report period, duplicate dates and bad numbers are row errors", () => {
  const rows = buildRows({
    mutate: (daily) => {
      daily[1][1] = "2026-10-02"; // outside period
      daily[2][1] = "2026-09-01"; // duplicate of day 1
      daily[3][4] = "abc"; // not a number
    },
  });
  const r = parseRows(sheetRowsOf(rows));
  const errs = r.invalidRows.map((x) => x.errors.join(" "));
  assert.ok(errs.some((e) => /outside the report period/.test(e)));
  assert.ok(errs.some((e) => /Duplicate date 2026-09-01/.test(e)));
  assert.ok(errs.some((e) => /My Amount is not a number/.test(e)));
  assert.equal(r.sections[0].days.length, 27);
});

test("money is parsed exactly (paise), including ₹, commas, blanks, zero and negative round-off", () => {
  assert.deepEqual(R.toPaise("₹1,23,456.78"), { paise: 12345678 });
  assert.deepEqual(R.toPaise(0.1 + 0.2), { paise: 30 });
  assert.deepEqual(R.toPaise(""), { paise: null });
  assert.deepEqual(R.toPaise(0), { paise: 0 });
  assert.deepEqual(R.toPaise("-0.45", { allowNegative: true }), { paise: -45 });
  assert.ok(R.toPaise("-5").error);
  assert.equal(R.summaryType("Min."), "min");
  assert.equal(R.summaryType("Sub Total"), "subTotal");
  assert.equal(R.summaryType("CAFE"), null);
});

test("Excel date cells (serial numbers) and a restaurant named only in the metadata are handled", () => {
  const rows = buildRows({ days: 5 });
  rows.splice(2, 0, ["Restaurant Name : META CAFE"]);
  for (let i = 5; i < 10; i++) {
    const [y, m, d] = rows[i][1].split("-").map(Number);
    rows[i][1] = (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; // Excel serial
    rows[i][0] = "";
  }
  rows.at(-6)[0] = "Total";
  const r = parseRows(sheetRowsOf(rows));
  assert.equal(r.sections[0].restaurant, "META CAFE");
  assert.deepEqual(r.sections[0].days.map((d) => d.date), ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"]);
});

test("a normal sales template is NOT mistaken for a day-wise report", () => {
  const rows = [["Month", "Business Name", "Total Sales"], ["October 2026", "X", 100]];
  assert.equal(parseRows(rows), null);
});

// ---- the real exported report (regression fixture) --------------------------
const realFile = ["restaurant-daywise-real.xlsx", "restaurant-daywise-real.xls", "restaurant-daywise-real.csv"].map((f) => path.join(FIX, f)).find((f) => fs.existsSync(f));
test("REAL report fixture (tests/fixtures/restaurant-daywise-real.*)", { skip: realFile ? false : "real report not saved in tests/fixtures yet" }, () => {
  const buf = fs.readFileSync(realFile);
  const sheets = parser.readRawSheets(buf, realFile);
  const r = sheets.map((sh) => R.parseSheet(sh.rows, sh.sheetName)).find(Boolean);
  assert.ok(r, "detected as a day-wise report");
  assert.ok(r.meta.periodStart && r.meta.periodEnd, "report period read from the metadata lines");
  assert.ok(r.headerRow > 1, "header row is below the metadata");
  const days = r.sections.reduce((n, s) => n + s.days.length, 0);
  const expectedDays = r.meta.periodStart && r.meta.periodEnd ? Math.round((Date.parse(r.meta.periodEnd) - Date.parse(r.meta.periodStart)) / 86400000) + 1 : days;
  assert.equal(days, expectedDays, "one daily record per day of the report period");
  r.sections.forEach((s) => s.days.forEach((d) => assert.equal(typeof d.invoiceNos, "string")));
  r.sections.forEach((s) => assert.ok(!s.days.some((d) => /total|min|max|avg/i.test(String(d.raw[r.headers[0]] || ""))), "no summary row imported as a day"));
  // Report reconciliation results are printed so a reviewer can see them.
  console.log("    real report:", JSON.stringify({ period: [r.meta.periodStart, r.meta.periodEnd], sections: r.sections.map((s) => [s.restaurant, s.days.length]), warnings: r.warnings, subTotal: r.subTotalRelation }));
});
