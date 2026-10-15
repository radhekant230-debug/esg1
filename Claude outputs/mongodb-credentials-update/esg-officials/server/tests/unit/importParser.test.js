const test = require("node:test");
const assert = require("node:assert/strict");
const xlsx = require("xlsx");
const parser = require("../../services/sales/importParser");

const BUSINESSES = [
  { _id: "b1", name: "Hotel Green Horizon", city: "Ranchi", state: "Jharkhand", category: "Hotel", monthlyTarget: 350000 },
  { _id: "b2", name: "Maya Multicuisine Restaurant", city: "Ranchi", state: "Jharkhand", category: "Restaurant", monthlyTarget: 0 },
  { _id: "b3", name: "Spice Route", city: "Ranchi", state: "Jharkhand", category: "Restaurant", monthlyTarget: 100000 },
  { _id: "b4", name: "Spice Route", city: "Patna", state: "Bihar", category: "Restaurant", monthlyTarget: 100000 },
  { _id: "b9", name: "Other City Hotel", city: "Delhi", state: "Delhi", category: "Hotel", monthlyTarget: 0 },
];
const AUTH = new Set(["b1", "b2", "b3", "b4"]);

const csv = (text) => Buffer.from(text, "utf8");
const run = (buffer, filename = "f.csv", extra = {}) =>
  parser.parseAndValidate(buffer, { filename, businesses: BUSINESSES, authorizedIds: AUTH, existingKeys: new Map(), ...extra });

test("CSV saved as Windows-1252 (old Excel) still parses the ₹ symbol safely", () => {
  const latin = Buffer.from("Month,Business Name,Location,Total Sales\r\nOctober 2026,Hotel Green Horizon,Ranchi,\"1,000\"\r\n", "latin1");
  const r = run(latin);
  assert.equal(r.rows[0].status, "valid");
  assert.equal(r.rows[0].data.totalSales, 1000);
});

test("Scenario 6: valid CSV in the template format", () => {
  const r = run(csv(
    "Month,Business Name,Location,Total Sales,Orders,Target,Remarks,Discount,Cost,Expenses\n" +
    "October 2026,Hotel Green Horizon,Ranchi,345000,155,350000,Near target,15000,170000,60000\n" +
    "Oct-2026,Maya Multicuisine Restaurant,Ranchi,\"₹1,80,000\",95,200000,,8000,90000,45000\n"
  ));
  assert.equal(r.rows.length, 2);
  assert.deepEqual(r.rows.map((x) => x.status), ["valid", "valid"]);
  assert.equal(r.rows[1].data.totalSales, 180000);
  assert.equal(r.rows[1].data.monthName, "October 2026");
  assert.equal(r.rows[0].data.salesBasis, "gross");
  assert.equal(r.rows[0].data.discount, 15000);
});

test("header row is found below a title row, and loose header names map", () => {
  const r = run(csv(
    "Monthly Sales Report - Ranchi,,,,\n" +
    ",,,,\n" +
    "Sales Month,Business_Name,City,Total Sales (INR),No. of Orders\n" +
    "2026-10,Hotel Green Horizon,Ranchi,345000,155\n"
  ));
  assert.equal(r.table.headerRowIndex, 2);
  assert.equal(r.mappingInfo.named.month, "Sales Month");
  assert.equal(r.mappingInfo.named.totalSales, "Total Sales (INR)");
  assert.equal(r.rows[0].status, "valid");
  assert.equal(r.rows[0].rowNumber, 4);
});

test("Excel date cells in Month are decoded (old importer stringified them)", () => {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([
    ["Month", "Business Name", "Location", "Total Sales"],
    [new Date(Date.UTC(2026, 9, 1)), "Hotel Green Horizon", "Ranchi", 300000],
  ], { cellDates: true });
  xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
  const r = run(buf, "f.xlsx");
  assert.equal(r.rows[0].status, "valid", JSON.stringify(r.rows[0].errors));
  assert.equal(r.rows[0].data.month, 10);
  assert.equal(r.rows[0].data.year, 2026);
});

test("instruction sheet first: the data sheet is still found", () => {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([["Read me"], ["Fill the Data sheet"]]), "Instructions");
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([
    ["Month", "Business Name", "Total Sales"],
    ["October 2026", "Hotel Green Horizon", 1000],
  ]), "Data");
  const r = run(xlsx.write(wb, { type: "buffer", bookType: "xlsx" }), "f.xlsx");
  assert.equal(r.table.sheetName, "Data");
  assert.equal(r.rows[0].status, "valid");
});

test("month formats", () => {
  const ok = ["October 2026", "Oct 2026", "Oct-2026", "Oct-26", "Oct'26", "2026-10", "10/2026", "2026-10-01", "01/10/2026", "1-Oct-2026", "2026 October"];
  ok.forEach((v) => assert.deepEqual(parser.parseMonth(v) && [parser.parseMonth(v).month, parser.parseMonth(v).year], [10, 2026], v));
  ["10", "Octember 2026", "13/2026", ""].forEach((v) => assert.equal(parser.parseMonth(v), null, v));
});

test("amount parsing", () => {
  assert.deepEqual(parser.parseAmount("₹2,50,000"), { value: 250000 });
  assert.deepEqual(parser.parseAmount("Rs. 1,000.50"), { value: 1000.5 });
  assert.deepEqual(parser.parseAmount(""), { value: null });
  assert.ok(parser.parseAmount("-500").error);
  assert.ok(parser.parseAmount("(500)").error);
  assert.ok(parser.parseAmount("abc").error);
  assert.ok(parser.parseAmount("12.5", { integer: true }).error);
});

test("Scenario 7: invalid CSV produces clear row-level errors", () => {
  const r = run(csv(
    "Month,Business Name,Location,Total Sales,Orders,Discount\n" +
    ",Hotel Green Horizon,Ranchi,1000,1,\n" +                 // row 2 missing month
    "October 2026,,Ranchi,1000,1,\n" +                        // row 3 missing business
    "October 2026,Hotel Green Horizen,Ranchi,abc,1,\n" +      // row 4 typo + bad sales
    "October 2026,Spice Route,,1000,1,\n" +                   // row 5 ambiguous
    "October 2026,Other City Hotel,Delhi,1000,1,\n" +         // row 6 unauthorized
    "October 2026,Hotel Green Horizon,Ranchi,1000,1.5,2000\n" + // row 7 orders not whole, discount > sales
    "Total,,,5000,,\n"                                        // row 8 totals row
  ));
  const byRow = Object.fromEntries(r.rows.map((x) => [x.rowNumber, x]));
  assert.ok(r.rows.every((x) => x.status === "invalid"));
  assert.match(byRow[2].errors.join(), /Month is missing/);
  assert.match(byRow[3].errors.join(), /Business Name is missing/);
  assert.match(byRow[4].errors.join(), /Did you mean "Hotel Green Horizon"/);
  assert.match(byRow[4].errors.join(), /Total Sales is not a number/);
  assert.match(byRow[5].errors.join(), /Ranchi, Jharkhand and Patna, Bihar/);
  assert.match(byRow[6].errors.join(), /not authorized/);
  assert.match(byRow[7].errors.join(), /whole number/);
  assert.match(byRow[7].errors.join(), /Discount is larger than gross/);
  assert.match(byRow[8].errors.join(), /totals row/);
});

test("duplicates inside the file are both flagged; existing DB records are reported", () => {
  const existingKeys = new Map([["b2:2026:10", { _id: "r1", totalSales: 5000, orders: 1, source: "manual" }]]);
  const r = run(csv(
    "Month,Business Name,Location,Total Sales\n" +
    "October 2026,Hotel Green Horizon,Ranchi,1000\n" +
    "Oct 2026,hotel green horizon,Ranchi,2000\n" +
    "October 2026,Maya Multicuisine Restaurant,Ranchi,3000\n"
  ), "f.csv", { existingKeys });
  assert.equal(r.rows[0].status, "invalid");
  assert.equal(r.rows[1].status, "invalid");
  assert.match(r.rows[0].errors[0], /Duplicate in file: rows 2, 3/);
  assert.equal(r.rows[2].status, "valid");
  assert.equal(r.rows[2].existing.totalSales, 5000);
});

test("'Net Sales' header implies net basis; Sales Basis column overrides", () => {
  const r = run(csv("Month,Business Name,Location,Net Sales,Discount\nOctober 2026,Hotel Green Horizon,Ranchi,90000,10000\n"));
  assert.equal(r.rows[0].data.salesBasis, "net");
  const r2 = run(csv("Month,Business Name,Location,Total Sales,Sales Basis\nOctober 2026,Hotel Green Horizon,Ranchi,90000,Net\n"));
  assert.equal(r2.rows[0].data.salesBasis, "net");
  const r3 = run(csv("Month,Business Name,Location,Total Sales,Sales Basis\nOctober 2026,Hotel Green Horizon,Ranchi,90000,Maybe\n"));
  assert.match(r3.rows[0].errors.join(), /Sales Basis must be/);
});

test("missing required columns are reported for mapping, and a manual mapping fixes it", () => {
  const file = csv("Period Label,Outlet Title,Amt\nOctober 2026,Hotel Green Horizon,1000\n");
  const none = run(file);
  assert.deepEqual(none.missingRequired.sort(), ["Business Name", "Month", "Total Sales"]);
  assert.equal(none.rows.length, 0, "nothing is imported until columns are mapped");
  const mappedAll = run(file, "f.csv", { mappingOverride: { month: "Period Label", businessName: "Outlet Title", totalSales: "Amt" } });
  assert.equal(mappedAll.rows[0].status, "valid");
  const file2 = csv("Month,Outlet Title,Amt\nOctober 2026,Hotel Green Horizon,1000\n");
  const r = run(file2);
  assert.deepEqual(r.missingRequired.sort(), ["Business Name", "Total Sales"]);
  const fixed = run(file2, "f.csv", { mappingOverride: { businessName: "Outlet Title", totalSales: "Amt" } });
  assert.equal(fixed.rows[0].status, "valid");
});

test("blank rows are counted, not silently treated as data", () => {
  const r = run(csv("Month,Business Name,Location,Total Sales\nOctober 2026,Hotel Green Horizon,Ranchi,1000\n,,,\n,,,\n"));
  assert.equal(r.rows.length, 1);
  assert.equal(r.blankRows, 2);
});

test("generated templates (xlsx & csv) import cleanly", () => {
  const sample = BUSINESSES.slice(0, 3);
  const xbuf = parser.buildTemplate({ format: "xlsx", sampleBusinesses: sample, month: "October 2026" });
  const rx = run(xbuf, "t.xlsx");
  assert.equal(rx.table.sheetName, "Monthly Sales");
  assert.deepEqual(rx.rows.map((x) => x.status), ["valid", "valid", "valid"], JSON.stringify(rx.rows.map((x) => x.errors)));
  assert.equal(rx.rows[2].data.discount, null); // blank = not recorded
  const cbuf = parser.buildTemplate({ format: "csv", sampleBusinesses: sample, month: "October 2026" });
  const rc = run(cbuf, "t.csv");
  assert.deepEqual(rc.rows.map((x) => x.status), ["valid", "valid", "valid"]);
  assert.deepEqual(rc.table.headers, parser.TEMPLATE_COLUMNS.map((c) => c.label));
});

test("invalid rows CSV contains the reasons", () => {
  const r = run(csv("Month,Business Name,Location,Total Sales\n,Hotel Green Horizon,Ranchi,1000\n"));
  const out = parser.invalidRowsCsv(r.rows, r.table.headers).toString("utf8");
  assert.match(out, /Sheet,Row Number,Month,Business Name,Location,Total Sales,Errors/);
  assert.match(out, /Sheet1,2,,Hotel Green Horizon,Ranchi,1000,"Month is missing/);
});

// ---------------------------------------------------------------------------
// Target business / reporting period from the upload form, all sheets
// ---------------------------------------------------------------------------
const RANCHI = BUSINESSES[0]; // Hotel Green Horizon, Ranchi
const DHANBAD = { _id: "b5", name: "Coal Capital Grand", city: "Dhanbad", state: "Jharkhand", category: "Hotel", monthlyTarget: 0 };
const ALL = [...BUSINESSES, DHANBAD];
const AUTH2 = new Set([...AUTH, "b5"]);
const run2 = (buffer, filename, extra) =>
  parser.parseAndValidate(buffer, { filename, businesses: ALL, authorizedIds: AUTH2, existingKeys: new Map(), ...extra });

test("file without Business/Month columns imports into the selected business and month", () => {
  const r = run2(csv("Total Sales,Orders,Discount\n250000,120,5000\n"), "f.csv", {
    targetBusiness: RANCHI,
    defaultPeriod: { month: 10, year: 2026, monthName: "October 2026" },
  });
  assert.deepEqual(r.missingRequired, []);
  assert.equal(r.rows[0].status, "valid", JSON.stringify(r.rows[0].errors));
  assert.equal(r.rows[0].data.businessId, "b1");
  assert.equal(r.rows[0].data.monthName, "October 2026");
});

test("a row for another business is rejected when a target business is selected (Ranchi file never lands in Dhanbad)", () => {
  const r = run2(
    csv("Month,Business Name,Location,Total Sales\nOctober 2026,Hotel Green Horizon,Ranchi,1000\nOctober 2026,Coal Capital Grand,Dhanbad,2000\n"),
    "f.csv",
    { targetBusiness: DHANBAD }
  );
  assert.equal(r.rows[0].status, "invalid");
  assert.match(r.rows[0].errors[0], /upload target is "Coal Capital Grand, Dhanbad"/);
  assert.equal(r.rows[1].status, "valid");
  assert.equal(r.rows[1].data.businessId, "b5");
});

test("separate Month and Year columns, month numbers and month names", () => {
  const r = run2(csv("Month,Year,Business Name,Location,Total Sales\nOctober,2026,Hotel Green Horizon,Ranchi,1000\n9,2026,Hotel Green Horizon,Ranchi,900\n"), "f.csv");
  assert.deepEqual(r.rows.map((x) => x.data && x.data.monthName), ["October 2026", "September 2026"]);
});

test("Client/Business Name, Sales Target and Profit/Loss headers map; losses may be negative", () => {
  const r = run2(csv("Month,Client/Business Name,Location,Total Sales (₹),Sales Target,Profit/Loss\nOct-2026,Hotel Green Horizon,Ranchi,\"1,00,000\",120000,(5000)\n"), "f.csv");
  assert.equal(r.rows[0].status, "valid", JSON.stringify(r.rows[0].errors));
  assert.equal(r.rows[0].data.target, 120000);
  assert.equal(r.rows[0].data.reportedProfit, -5000);
});

test("all worksheets with sales data are read; instruction sheets are listed as ignored", () => {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([["How to fill"], ["One row per month"]]), "Read me");
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([["Month", "Business Name", "Location", "Total Sales"], ["October 2026", "Hotel Green Horizon", "Ranchi", 1000]]), "Ranchi");
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([["Sales Report"], ["Month", "Business Name", "Location", "Total Sales"], ["October 2026", "Coal Capital Grand", "Dhanbad", 2000]]), "Dhanbad");
  const r = run2(xlsx.write(wb, { type: "buffer", bookType: "xlsx" }), "f.xlsx");
  assert.deepEqual(r.sheets.map((s) => s.table.sheetName), ["Ranchi", "Dhanbad"]);
  assert.deepEqual(r.ignoredSheets.map((s) => s.sheetName), ["Read me"]);
  assert.deepEqual(r.rows.map((x) => [x.sheet, x.rowNumber, x.status]), [["Ranchi", 2, "valid"], ["Dhanbad", 3, "valid"]]);
  assert.equal(r.rows[1].rowLabel, "Dhanbad row 3");
});

test("duplicates across sheets are caught", () => {
  const wb = xlsx.utils.book_new();
  const rows = [["Month", "Business Name", "Location", "Total Sales"], ["October 2026", "Hotel Green Horizon", "Ranchi", 1000]];
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rows), "A");
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rows), "B");
  const r = run2(xlsx.write(wb, { type: "buffer", bookType: "xlsx" }), "f.xlsx");
  assert.ok(r.rows.every((x) => x.status === "invalid"));
  assert.match(r.rows[0].errors.join(), /A row 2, B row 2/);
});

test("file type is checked by content, not just extension", () => {
  const xbuf = parser.buildTemplate({ format: "xlsx" });
  assert.equal(parser.detectFileKind(xbuf, "a.xlsx").ok, true);
  assert.equal(parser.detectFileKind(Buffer.from("Month,Total Sales\n"), "a.csv").ok, true);
  assert.match(parser.detectFileKind(xbuf, "a.csv").error, /Excel workbook saved with a .csv name/);
  assert.match(parser.detectFileKind(Buffer.from("MZ\u0000\u0000binary"), "a.csv").error, /binary/);
  assert.match(parser.detectFileKind(Buffer.from("<html><body>x</body></html>"), "a.csv").error, /HTML/);
  assert.match(parser.detectFileKind(Buffer.from("plain text"), "a.xlsx").error, /not a valid Excel/);
  assert.match(parser.detectFileKind(Buffer.from("x"), "a.exe").error, /Only .csv/);
});

test("the reported failure: title row + 'Client/Business Name' + 'Total Sales (INR)' + Excel date cells now import", () => {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([
    ["ESG Officials — Monthly Sales Upload"],
    [],
    ["Month", "Client/Business Name", "Location", "Total Sales (INR)", "Orders", "Sales Target"],
    [new Date(Date.UTC(2026, 9, 1)), "Hotel Green Horizon", "Ranchi", 280000, 135, 300000],
    [new Date(Date.UTC(2026, 9, 1)), "Maya Multicuisine Restaurant", "Ranchi", 180000, 95, 200000],
  ], { cellDates: true });
  xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
  const r = run2(xlsx.write(wb, { type: "buffer", bookType: "xlsx" }), "f.xlsx");
  assert.deepEqual(r.rows.map((x) => x.status), ["valid", "valid"], JSON.stringify(r.rows.map((x) => x.errors)));
  assert.equal(r.rows[0].data.monthName, "October 2026");
});
