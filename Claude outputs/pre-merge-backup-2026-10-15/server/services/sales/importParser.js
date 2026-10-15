/**
 * Sales Excel / CSV import parsing and validation (pure — no database access).
 *
 * Why uploads used to show "0 Valid / 7 Invalid" (Month, Business Name and
 * Total Sales "missing"): the old importer read ONLY row 1 of the FIRST sheet
 * as the header and matched header names exactly. A title row above the
 * header, an instructions sheet first, or headers such as "Total Sales (INR)",
 * "Business_Name", "Client/Business Name" or separate "Month" + "Year" columns
 * left every field unmapped, so every row failed. Excel date cells in Month
 * were also turned into serial numbers and rejected.
 *
 * This parser:
 *  - reads EVERY worksheet (CSV = one sheet) and finds each sheet's header row
 *  - matches headers loosely and lets the manager map columns explicitly
 *  - decodes Excel dates, "Oct-2026", separate Month/Year columns, ₹/commas
 *  - can take the target business and reporting month/year from the upload
 *    form when the file does not contain them
 */
const crypto = require("crypto");
const xlsx = require("xlsx");
const ist = require("../../utils/istDate");

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_LOOKUP = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const MAX_ROWS = 5000;

/** Template / canonical columns, in template order. */
const COLUMNS = [
  { key: "transactionDate", label: "Date", required: false, example: "2026-10-05",
    aliases: ["date", "transactiondate", "txndate", "orderdate", "salesdate", "invoicedate", "billdate", "entrydate", "day", "recorddate", "dated", "saledate", "txn_date", "sale_date"] },
  { key: "transactionId", label: "Transaction ID", required: false, example: "TXN-1001",
    aliases: ["transactionid", "txnid", "orderid", "invoiceid", "billnumber", "billno", "invoiceno", "reference", "refno", "receiptno", "id", "bill_no", "inv_no", "txn_id", "order_id"] },
  { key: "month", label: "Month", required: false, example: "October 2026",
    aliases: ["month", "period", "monthyear", "monthandyear", "salesmonth", "reportingmonth", "reportingperiod", "monthofsale"] },
  { key: "year", label: "Year", required: false, template: false, example: 2026,
    aliases: ["year", "yr", "salesyear", "reportingyear", "calendaryear"] },
  { key: "businessId", label: "Business ID", required: false, template: false, example: "BIZ-JH-RAN-003",
    aliases: ["businessid", "bizid", "business_id", "clientid", "businesscode", "bizcode", "code", "outletcode", "branchcode"] },
  { key: "businessName", label: "Business Name", required: true, example: "Hotel Green Horizon",
    aliases: ["businessname", "business", "clientbusinessname", "clientbusiness", "businessclientname", "nameofbusiness", "hotelrestaurant", "hotelrestaurantname", "hotel", "restaurant", "outlet", "outletname", "client", "clientname", "store", "storename", "property", "propertyname", "name", "businessnamelocation", "businesslocation", "businessandlocation"] },
  { key: "location", label: "Location", required: false, example: "Ranchi",
    aliases: ["location", "city", "town", "branch", "area", "citylocation", "outletlocation"] },
  { key: "state", label: "State", required: false, example: "Jharkhand", aliases: ["state", "region"] },
  { key: "totalSales", label: "Total Sales", required: true, example: 280000,
    aliases: ["totalsales", "sales", "totalsale", "revenue", "totalrevenue", "monthlysales", "salesamount", "salesvalue", "turnover", "amount", "grosssales", "grossrevenue", "netsales", "netrevenue"] },
  { key: "salesBasis", label: "Sales Basis", required: false, example: "Gross",
    aliases: ["salesbasis", "basis", "salestype", "amountbasis", "salesvaluetype"] },
  { key: "orders", label: "Orders", required: false, example: 135,
    aliases: ["orders", "order", "ordercount", "totalorders", "nooforders", "numberoforders", "transactions", "bills", "invoices"] },
  { key: "target", label: "Target", required: false, example: 300000,
    aliases: ["target", "monthlytarget", "salestarget", "targetsales", "targetamount"] },
  { key: "discount", label: "Discount", required: false, example: 12000,
    aliases: ["discount", "discounts", "totaldiscount", "totaldiscounts", "discountamount", "discountgiven", "discountsgiven"] },
  { key: "cost", label: "Cost", required: false, example: 150000,
    aliases: ["cost", "costs", "cogs", "costofgoods", "costofgoodssold", "costofsales", "costofservices", "costofgoodsservices", "totalcost", "directcost"] },
  { key: "expenses", label: "Expenses", required: false, example: 60000,
    aliases: ["expenses", "expense", "operatingexpenses", "operatingexpense", "opex", "totalexpenses", "overheads"] },
  { key: "profitLoss", label: "Profit/Loss", required: false, example: 58000,
    aliases: ["profitloss", "profitandloss", "pl", "pandl", "profit", "loss", "netprofit", "netprofitloss", "netloss", "profitlossamount"] },
  { key: "remarks", label: "Remarks", required: false, example: "Festive month",
    aliases: ["remarks", "remark", "notes", "note", "comment", "comments"] },
];

const COLUMN_BY_KEY = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));
const TEMPLATE_COLUMNS = COLUMNS.filter((c) => c.template !== false);

const fail = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });

/** "Total Sales (INR)" -> "totalsales", "Business_Name" -> "businessname" */
function normalizeHeader(h) {
  return String(h == null ? "" : h)
    .replace(/^﻿/, "")
    .toLowerCase()
    .replace(/\((?:inr|rs\.?|₹|rupees|in ₹|in inr|in rs\.?)\)/g, "")
    .replace(/[₹]/g, "")
    .replace(/\b(inr|rs)\b\.?/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Trims whitespace, collapses repeated spaces, and converts to lowercase.
 * Requirement 6: Normalize names only where name-based matching is necessary:
 * trim whitespace, normalize repeated spaces, and compare case-insensitively.
 */
function cleanName(s) {
  return String(s == null ? "" : s)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function stripPunctuation(s) {
  return cleanName(s)
    .replace(/&/g, "and")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const normalizeName = (s) => cleanName(s);

/**
 * Parses composite business cell text that may contain the city or state:
 * - "Maya Multicuisine Restaurant, Ranchi"
 * - "Maya Multicuisine Restaurant (Ranchi)"
 * - "Maya Multicuisine Restaurant - Ranchi"
 */
function parseBusinessCell(rawBusiness) {
  const str = String(rawBusiness || "").trim();
  if (!str) return { name: "", city: "", state: "" };

  const parenMatch = str.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (parenMatch) {
    const locParts = splitLocation(parenMatch[2]);
    return { name: parenMatch[1].trim(), city: locParts.city, state: locParts.state };
  }

  if (str.includes(" - ")) {
    const parts = str.split(" - ").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const locParts = splitLocation(parts.slice(1).join(", "));
      return { name: parts[0], city: locParts.city, state: locParts.state };
    }
  }

  if (str.includes(",")) {
    const parts = str.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const locParts = splitLocation(parts.slice(1).join(", "));
      return { name: parts[0], city: locParts.city, state: locParts.state };
    }
  }

  return { name: str, city: "", state: "" };
}

/** Header -> column key (and implied sales basis for "Net Sales" / "Gross Sales"). */
function matchHeader(header) {
  const n = normalizeHeader(header);
  if (!n) return null;
  for (const col of COLUMNS) {
    if (col.aliases.includes(n)) {
      let impliedBasis = null;
      if (col.key === "totalSales" && /^net/.test(n)) impliedBasis = "net";
      if (col.key === "totalSales" && /^gross/.test(n)) impliedBasis = "gross";
      return { key: col.key, impliedBasis };
    }
  }
  return null;
}

/** Automatic mapping for a header row. Returns { mapping: {key: index}, impliedBasis } */
function autoMap(headers) {
  const mapping = {};
  let impliedBasis = null;
  headers.forEach((h, idx) => {
    if (h === "" || h == null) return;
    const m = matchHeader(h);
    if (m && mapping[m.key] === undefined) {
      mapping[m.key] = idx;
      if (m.impliedBasis) impliedBasis = m.impliedBasis;
    }
  });
  return { mapping, impliedBasis };
}

function scoreRow(row) {
  const { mapping } = autoMap(row);
  const keys = Object.keys(mapping);
  const core = ["month", "transactionDate", "businessName", "totalSales"].filter((k) => keys.includes(k)).length;
  return { score: core * 10 + keys.length, hasSales: keys.includes("totalSales"), recognised: keys.length };
}

function decodeWorkbook(buffer, filename) {
  const isCsv = /\.csv$/i.test(filename || "");
  try {
    if (isCsv) {
      // Decode CSV text ourselves: UTF-8 (with or without BOM, e.g. "₹"), falling
      // back to Windows-1252 for files saved by older Excel versions.
      let text;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch (_) {
        text = new TextDecoder("windows-1252").decode(buffer);
      }
      text = text.replace(/^﻿/, "");
      // raw:true keeps "Oct-2026" as text instead of letting the parser guess a date
      return xlsx.read(text, { type: "string", raw: true, cellDates: false });
    }
    return xlsx.read(buffer, { type: "buffer", cellDates: false });
  } catch (err) {
    throw fail(400, "The file could not be read. Save it as .xlsx or UTF-8 .csv and try again.");
  }
}

/**
 * Reads every worksheet and finds its header row.
 * Returns { tables: [{ sheetName, headerRowIndex, headers, dataRows }], ignoredSheets: [{ sheetName, reason }] }
 * Sheets whose header row includes a sales column are data sheets. When no sheet
 * qualifies, the best candidate is returned so the manager can map its columns.
 */
function readTables(buffer, { filename = "", headerHints = [] } = {}) {
  const workbook = decodeWorkbook(buffer, filename);
  if (!workbook.SheetNames.length) throw fail(400, "The workbook has no sheets.");

  const hintSet = new Set(headerHints.filter(Boolean).map(String));
  const candidates = [];
  workbook.SheetNames.forEach((sheetName) => {
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: "", blankrows: true });
    let best = null;
    const scanLimit = Math.min(rows.length, 20);
    for (let i = 0; i < scanLimit; i++) {
      const row = rows[i] || [];
      const s = scoreRow(row);
      // Columns the manager mapped by hand also identify the header row
      const hinted = row.filter((c) => hintSet.has(String(c).trim())).length;
      const score = s.score + hinted * 5;
      if ((s.recognised || hinted) && (!best || score > best.score)) {
        best = { score, hasSales: s.hasSales || row.some((c) => hintSet.has(String(c).trim())), headerRowIndex: i };
      }
    }
    const firstNonEmpty = rows.findIndex((r) => (r || []).some((c) => c !== "" && c !== null && c !== undefined));
    candidates.push({ sheetName, rows, best, firstNonEmpty });
  });

  const build = (c, headerRowIndex) => ({
    sheetName: c.sheetName,
    headerRowIndex,
    headers: (c.rows[headerRowIndex] || []).map((h) => String(h == null ? "" : h).trim()),
    dataRows: c.rows.slice(headerRowIndex + 1),
  });

  const tables = [];
  const ignoredSheets = [];
  candidates.forEach((c) => {
    if (c.best && c.best.hasSales) tables.push(build(c, c.best.headerRowIndex));
    else if (c.firstNonEmpty === -1) ignoredSheets.push({ sheetName: c.sheetName, reason: "Empty sheet" });
    else ignoredSheets.push({ sheetName: c.sheetName, reason: "No sales column found in the first 20 rows (e.g. an instructions or lookup sheet)" });
  });

  if (!tables.length) {
    // Nothing recognisable: offer the most promising sheet for manual mapping.
    const scored = candidates.filter((c) => c.firstNonEmpty !== -1);
    if (!scored.length) throw fail(400, "The file contains no data.");
    scored.sort((a, b) => (b.best ? b.best.score : 0) - (a.best ? a.best.score : 0));
    const pick = scored[0];
    const t = build(pick, pick.best ? pick.best.headerRowIndex : pick.firstNonEmpty);
    return { tables: [t], ignoredSheets: ignoredSheets.filter((s) => s.sheetName !== pick.sheetName), needsMappingFallback: true };
  }
  return { tables, ignoredSheets, needsMappingFallback: false };
}

/** Back-compatible single-table reader (first data sheet). */
function readTable(buffer, opts = {}) {
  return readTables(buffer, opts).tables[0];
}

// ---------------------------------------------------------------------------
// Value parsers
// ---------------------------------------------------------------------------
function monthResult(month, year) {
  if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100)) return null;
  return { month, year, monthName: `${MONTH_NAMES[month - 1]} ${year}` };
}

/** Parses a Year cell ("2026", 2026, "FY 2026"). */
function parseYear(value) {
  if (value === null || value === undefined || value === "") return null;
  const m = String(value).match(/(20\d{2}|21\d{2})/);
  if (m) return Number(m[1]);
  if (/^\d{2}$/.test(String(value).trim())) return 2000 + Number(value);
  return null;
}

/**
 * Parses the Month cell. Returns { month, year, monthName } or null.
 * `fallbackYear` completes month-only values such as "October" or 10.
 */
function parseMonth(value, fallbackYear = null) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    // Excel date serial number
    if (value > 20000 && value < 80000) {
      const d = xlsx.SSF.parse_date_code(value);
      if (d) return monthResult(d.m, d.y);
    }
    // bare month number, only meaningful with a separate year
    if (Number.isInteger(value) && value >= 1 && value <= 12 && fallbackYear) return monthResult(value, fallbackYear);
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return monthResult(value.getMonth() + 1, value.getFullYear());
  }

  const str = String(value).trim().replace(/\s+/g, " ");
  let m;

  // "October 2026", "Oct 2026", "Oct-2026", "Oct, 2026", "Oct'26", "Oct-26"
  m = str.match(/^([A-Za-z]+)\.?[\s,'’/-]*(\d{2}|\d{4})$/);
  if (m && MONTH_LOOKUP[m[1].toLowerCase()]) {
    const yr = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
    return monthResult(MONTH_LOOKUP[m[1].toLowerCase()], yr);
  }
  // "2026 October"
  m = str.match(/^(\d{4})[\s,/-]+([A-Za-z]+)$/);
  if (m && MONTH_LOOKUP[m[2].toLowerCase()]) return monthResult(MONTH_LOOKUP[m[2].toLowerCase()], Number(m[1]));
  // "2026-10", "2026/10", "2026.10"
  m = str.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (m) return monthResult(Number(m[2]), Number(m[1]));
  // "10/2026", "10-2026"
  m = str.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m) return monthResult(Number(m[1]), Number(m[2]));
  // "2026-10-01" (ISO date)
  m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) return monthResult(Number(m[2]), Number(m[1]));
  // "01/10/2026" or "01-10-2026" -> Indian dd/mm/yyyy
  m = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return monthResult(Number(m[2]), Number(m[3]));
  // "01 Oct 2026", "1-Oct-2026"
  m = str.match(/^(\d{1,2})[\s-]+([A-Za-z]+)[\s,-]+(\d{4})$/);
  if (m && MONTH_LOOKUP[m[2].toLowerCase()]) return monthResult(MONTH_LOOKUP[m[2].toLowerCase()], Number(m[3]));
  // Month name or number only ("October", "Oct", "10") + separate year
  if (fallbackYear) {
    if (MONTH_LOOKUP[str.toLowerCase().replace(/\.$/, "")]) return monthResult(MONTH_LOOKUP[str.toLowerCase().replace(/\.$/, "")], fallbackYear);
    if (/^\d{1,2}$/.test(str)) return monthResult(Number(str), fallbackYear);
  }
  return null;
}

/**
 * Parses an amount. Returns { value } (null when blank) or { error }.
 * Accepts "₹2,50,000", "250000.50", "Rs. 1,000". Rejects text, and negatives
 * unless `allowNegative` (Profit/Loss accepts "-5000" and "(5,000)").
 */
function parseAmount(value, { integer = false, allowNegative = false } = {}) {
  if (value === null || value === undefined) return { value: null };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { error: "is not a valid number" };
    if (value < 0 && !allowNegative) return { error: "cannot be negative" };
    if (integer && !Number.isInteger(value)) return { error: "must be a whole number" };
    return { value };
  }
  const str = String(value).trim();
  if (str === "" || str === "-" || str === "—") return { value: null };
  const stripped = str.replace(/[₹\s]|rs\.?|inr/gi, "");
  const negative = /^\(.*\)$/.test(stripped) || /^-/.test(stripped);
  if (negative && !allowNegative) return { error: "cannot be negative" };
  const cleaned = stripped.replace(/[(),]/g, "").replace(/^-/, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return { error: `is not a number ("${str}")` };
  const n = Number(cleaned) * (negative ? -1 : 1);
  if (integer && !Number.isInteger(n)) return { error: "must be a whole number" };
  return { value: n };
}

function parseBasis(value) {
  const s = normalizeHeader(value);
  if (!s) return { value: null };
  if (["gross", "beforediscount", "beforediscounts", "grosssales", "g"].includes(s)) return { value: "gross" };
  if (["net", "afterdiscount", "afterdiscounts", "netofdiscount", "netsales", "n"].includes(s)) return { value: "net" };
  return { error: `Sales Basis must be "Gross" or "Net" (got "${value}")` };
}

function splitLocation(raw) {
  const s = String(raw || "").trim();
  if (!s) return { city: "", state: "" };
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  return { city: parts[0] || "", state: parts[1] || "" };
}

/** Simple similarity for "did you mean" suggestions. */
function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = (s) => {
    const out = new Set();
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
    return out;
  };
  const ga = grams(a);
  const gb = grams(b);
  let inter = 0;
  ga.forEach((g) => gb.has(g) && inter++);
  return (2 * inter) / (ga.size + gb.size || 1);
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function buildDateResult(year, month, day) {
  if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100) || !(day >= 1 && day <= 31)) return null;
  const inst = ist.fromISTParts(year, month, day);
  const p = ist.toISTParts(inst);
  if (!p || p.year !== year || p.month !== month || p.day !== day) return null;
  const dateStr = ist.istDayKey(inst);
  return {
    date: inst,
    dateStr,
    year,
    month,
    day,
    monthName: `${MONTH_NAMES[month - 1]} ${year}`,
  };
}

/**
 * Parses transaction date cells: Excel date codes, ISO YYYY-MM-DD, Indian DD/MM/YYYY,
 * "14 Oct 2026", "Oct 14 2026", etc. Returns { date, dateStr, year, month, day, monthName } or null.
 */
function parseTransactionDate(value, fallbackYear = null) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    if (value > 20000 && value < 80000) {
      const d = xlsx.SSF.parse_date_code(value);
      if (d) return buildDateResult(d.y, d.m, d.d);
    }
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const p = ist.toISTParts(value);
    if (p) return buildDateResult(p.year, p.month, p.day);
    return null;
  }

  const str = String(value).trim().replace(/\s+/g, " ");
  let m;

  // "2026-10-14" or "2026/10/14" or "2026.10.14" (ISO / YMD)
  m = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (m) return buildDateResult(Number(m[1]), Number(m[2]), Number(m[3]));

  // "14/10/2026" or "14-10-2026" or "14.10.2026" (Indian DMY)
  m = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[T\s].*)?$/);
  if (m) return buildDateResult(Number(m[3]), Number(m[2]), Number(m[1]));

  // "14 Oct 2026", "14-Oct-2026", "14 October 2026", "14th Oct 2026"
  m = str.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]+)[\s,-]+(\d{4})$/);
  if (m && MONTH_LOOKUP[m[2].toLowerCase()]) {
    return buildDateResult(Number(m[3]), MONTH_LOOKUP[m[2].toLowerCase()], Number(m[1]));
  }

  // "Oct 14, 2026", "October 14 2026"
  m = str.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?[\s,]+(\d{4})$/);
  if (m && MONTH_LOOKUP[m[1].toLowerCase()]) {
    return buildDateResult(Number(m[3]), MONTH_LOOKUP[m[1].toLowerCase()], Number(m[2]));
  }

  // "14/10/26" or "14-10-26" (2-digit year)
  m = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (m) return buildDateResult(2000 + Number(m[3]), Number(m[2]), Number(m[1]));

  // "14 Oct" with fallbackYear
  m = str.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]+)$/);
  if (m && fallbackYear && MONTH_LOOKUP[m[2].toLowerCase()]) {
    return buildDateResult(fallbackYear, MONTH_LOOKUP[m[2].toLowerCase()], Number(m[1]));
  }

  return null;
}

/**
 * Automatically detects the reporting period and date range covered by uploaded records.
 */
function detectReportingPeriod(rows) {
  const validData = rows.map((r) => r.data).filter(Boolean);
  if (!validData.length) {
    return {
      periodType: "unknown",
      periodLabel: "No valid data",
      startDate: null,
      endDate: null,
      minDate: null,
      maxDate: null,
      granularity: "unknown",
      totalDays: 0,
      recordType: "summary",
    };
  }

  const transactionDates = validData
    .filter((d) => d.recordType === "transaction" && d.dateStr)
    .map((d) => d.dateStr);

  if (transactionDates.length > 0) {
    const uniqueDates = [...new Set(transactionDates)].sort();
    const minDateStr = uniqueDates[0];
    const maxDateStr = uniqueDates[uniqueDates.length - 1];
    const minInst = ist.parseISTDateTime(minDateStr);
    const maxInst = ist.parseISTDateTime(maxDateStr);
    const startOfMin = ist.startOfISTDay(minInst);
    const endOfMax = ist.endOfISTDay(maxInst);
    const diffMs = maxInst.getTime() - minInst.getTime();
    const totalDays = Math.round(diffMs / 86400000) + 1;

    let periodType = "custom";
    let periodLabel = `${ist.formatISTDate(startOfMin)} – ${ist.formatISTDate(endOfMax)} (${totalDays} day${totalDays === 1 ? "" : "s"})`;

    if (totalDays === 1) {
      periodType = "one_day";
      periodLabel = `One Day (${ist.formatISTDate(startOfMin)})`;
    } else if (totalDays >= 6 && totalDays <= 8) {
      periodType = "one_week";
      periodLabel = `One Week (${ist.formatISTDate(startOfMin)} – ${ist.formatISTDate(endOfMax)})`;
    } else if (totalDays >= 13 && totalDays <= 16) {
      periodType = "two_weeks";
      periodLabel = `Two Weeks (${ist.formatISTDate(startOfMin)} – ${ist.formatISTDate(endOfMax)})`;
    } else if (totalDays >= 28 && totalDays <= 32) {
      periodType = "one_month";
      const pMin = ist.toISTParts(startOfMin);
      const pMax = ist.toISTParts(endOfMax);
      if (pMin.month === pMax.month && pMin.year === pMax.year) {
        periodLabel = `One Month (${MONTH_NAMES[pMin.month - 1]} ${pMin.year})`;
      } else {
        periodLabel = `One Month (${ist.formatISTDate(startOfMin)} – ${ist.formatISTDate(endOfMax)})`;
      }
    } else if (totalDays >= 88 && totalDays <= 93) {
      periodType = "quarter";
      periodLabel = `Quarter (${ist.formatISTDate(startOfMin)} – ${ist.formatISTDate(endOfMax)})`;
    } else if (totalDays >= 180 && totalDays <= 186) {
      periodType = "six_months";
      periodLabel = `Six Months (${ist.formatISTDate(startOfMin)} – ${ist.formatISTDate(endOfMax)})`;
    } else if (totalDays >= 364 && totalDays <= 366) {
      periodType = "one_year";
      periodLabel = `One Year (${ist.formatISTDate(startOfMin)} – ${ist.formatISTDate(endOfMax)})`;
    }

    return {
      periodType,
      periodLabel,
      startDate: startOfMin,
      endDate: endOfMax,
      minDate: minDateStr,
      maxDate: maxDateStr,
      granularity: totalDays <= 31 ? "daily" : totalDays <= 92 ? "weekly" : "monthly",
      totalDays,
      uniqueDaysCount: uniqueDates.length,
      recordType: "transaction",
    };
  }

  // Monthly summary records
  const monthKeys = [...new Set(validData.map((d) => `${d.year}-${String(d.month).padStart(2, "0")}`))].sort();
  if (monthKeys.length === 1) {
    const [y, m] = monthKeys[0].split("-").map(Number);
    const range = ist.istMonthRange(y, m);
    return {
      periodType: "one_month",
      periodLabel: `${MONTH_NAMES[m - 1]} ${y}`,
      startDate: range.start,
      endDate: range.end,
      minDate: ist.istDayKey(range.start),
      maxDate: ist.istDayKey(range.end),
      granularity: "monthly",
      totalDays: Math.round((range.end.getTime() - range.start.getTime()) / 86400000) + 1,
      uniqueDaysCount: 0,
      recordType: "summary",
    };
  }

  const [firstY, firstM] = monthKeys[0].split("-").map(Number);
  const [lastY, lastM] = monthKeys[monthKeys.length - 1].split("-").map(Number);
  const firstRange = ist.istMonthRange(firstY, firstM);
  const lastRange = ist.istMonthRange(lastY, lastM);
  const mCount = monthKeys.length;

  let periodType = "custom";
  let periodLabel = `${MONTH_NAMES[firstM - 1]} ${firstY} – ${MONTH_NAMES[lastM - 1]} ${lastY} (${mCount} months)`;
  if (mCount === 3) {
    periodType = "quarter";
    periodLabel = `Quarter (${MONTH_NAMES[firstM - 1]} ${firstY} – ${MONTH_NAMES[lastM - 1]} ${lastY})`;
  } else if (mCount === 6) {
    periodType = "six_months";
    periodLabel = `Six Months (${MONTH_NAMES[firstM - 1]} ${firstY} – ${MONTH_NAMES[lastM - 1]} ${lastY})`;
  } else if (mCount === 12) {
    periodType = "one_year";
    periodLabel = `One Year (${firstY})`;
  }

  return {
    periodType,
    periodLabel,
    startDate: firstRange.start,
    endDate: lastRange.end,
    minDate: ist.istDayKey(firstRange.start),
    maxDate: ist.istDayKey(lastRange.end),
    granularity: "monthly",
    totalDays: Math.round((lastRange.end.getTime() - firstRange.start.getTime()) / 86400000) + 1,
    uniqueDaysCount: 0,
    recordType: "summary",
  };
}

/** Which columns are essential for this upload (form selections can replace them). */
function requiredKeys(ctx = {}) {
  const keys = ["totalSales"];
  if (!ctx.defaultPeriod && !ctx.startDate && !ctx.manualDateOverride) {
    keys.push("month");
  }
  if (!ctx.targetBusiness) keys.push("businessName");
  return keys;
}

/**
 * Builds the column mapping, honouring a manager override
 * (override = { month: "Header text", totalSales: "Header text", ... }).
 */
function buildMapping(headers, override = null, ctx = {}) {
  const auto = autoMap(headers);
  const mapping = { ...auto.mapping };
  let impliedBasis = auto.impliedBasis;
  const errors = [];

  if (override && typeof override === "object") {
    Object.entries(override).forEach(([key, header]) => {
      if (!COLUMN_BY_KEY[key]) return;
      if (header === "" || header === null || header === undefined) {
        delete mapping[key];
        return;
      }
      const idx = headers.findIndex((h) => h === header);
      if (idx === -1) {
        // Multi-sheet files: a mapping chosen for another sheet may not exist here.
        if (ctx.strictOverride) errors.push(`Column "${header}" selected for ${COLUMN_BY_KEY[key].label} was not found in the file.`);
        return;
      }
      // A header can feed only one field
      Object.keys(mapping).forEach((k) => mapping[k] === idx && k !== key && delete mapping[k]);
      mapping[key] = idx;
      if (key === "totalSales") {
        const m = matchHeader(header);
        impliedBasis = m && m.impliedBasis ? m.impliedBasis : null;
      }
    });
  }

  const notices = [];
  if (mapping.transactionDate !== undefined) {
    notices.push("Date column mapped — records will be imported as daily transactions.");
  } else if (mapping.month !== undefined) {
    notices.push("Month column mapped — records will be imported as monthly summaries.");
  } else if (ctx.startDate && ctx.endDate) {
    notices.push(`Using selected reporting period (${ctx.startDate} to ${ctx.endDate}).`);
  } else if (ctx.defaultPeriod) {
    notices.push(`No Date or Month column — every row is assigned to the selected reporting period (${ctx.defaultPeriod.monthName}).`);
  }

  if (mapping.discount === undefined) notices.push("No Discount column — discounts and net sales will show as \"Data unavailable\" for these rows.");
  if (mapping.cost === undefined && mapping.profitLoss === undefined) notices.push("No Cost or Profit/Loss column — profit will show as \"Data unavailable\" for these rows.");
  if (mapping.salesBasis === undefined && !impliedBasis) notices.push("No Sales Basis column — Total Sales is treated as GROSS (before discounts).");
  if (impliedBasis === "net" && mapping.salesBasis === undefined) notices.push("Sales column is \"Net\" — values are treated as already net of discounts (discount will not be subtracted again).");
  if (mapping.businessName === undefined && ctx.targetBusiness) notices.push(`No Business column — every row is assigned to the selected business (${ctx.targetBusiness.name}, ${ctx.targetBusiness.city}).`);

  const missingRequired = requiredKeys(ctx)
    .filter((k) => {
      if (k === "month" && mapping.transactionDate !== undefined) return false;
      return mapping[k] === undefined;
    })
    .map((k) => COLUMN_BY_KEY[k].label);

  const mappedIdx = new Set(Object.values(mapping));
  const unmapped = headers.filter((h, i) => h && !mappedIdx.has(i));
  const named = Object.fromEntries(Object.entries(mapping).map(([k, i]) => [k, headers[i]]));
  return { mapping, named, impliedBasis, missingRequired, unmapped, errors, notices };
}

// ---------------------------------------------------------------------------
// Row validation
// ---------------------------------------------------------------------------

/**
 * Validates every data row of every sheet.
 *  ctx.businesses     : [{ _id, name, city, state, category, monthlyTarget }]
 *  ctx.authorizedIds  : Set of business id strings the user may import for (null = all)
 *  ctx.existingKeys   : Map of existing record identifiers -> existing record
 *  ctx.targetBusiness : business chosen in the upload form (optional)
 *  ctx.defaultPeriod  : { month, year, monthName } chosen in the form (optional)
 *  ctx.startDate      : "YYYY-MM-DD" chosen in form (optional)
 *  ctx.endDate        : "YYYY-MM-DD" chosen in form (optional)
 *  ctx.reportingPeriod: period string e.g. "one_day", "one_week", etc. (optional)
 */
/**
 * Validates a row's business data against a selected target business.
 * Ensures stable ID/code matching, clean name matching, and city validation.
 */
function matchesTarget(target, { rawBusinessId, rawBusiness, parsed, effectiveCity, effectiveState }) {
  // 1. Stable ID / Code matching
  if (rawBusinessId) {
    const idStr = String(rawBusinessId).trim();
    if (String(target._id).toLowerCase() === idStr.toLowerCase()) return { match: true };
    if (target.code && String(target.code).toUpperCase() === idStr.toUpperCase()) return { match: true };
    return { match: false, reason: "id_mismatch" };
  }

  // 2. If row has no business name or ID, it belongs to target
  if (!rawBusiness) {
    return { match: true };
  }

  // 3. If rawBusiness text is target's ID or code
  if (String(target._id).toLowerCase() === rawBusiness.toLowerCase()) return { match: true };
  if (target.code && String(target.code).toUpperCase() === rawBusiness.toUpperCase()) return { match: true };

  // 4. Name comparison (cleanName: trim whitespace, repeated spaces, case-insensitive)
  const targetClean = cleanName(target.name);
  const rowNameClean = cleanName(parsed.name || rawBusiness);
  const rawBusinessClean = cleanName(rawBusiness);

  const nameMatches =
    rowNameClean === targetClean ||
    rawBusinessClean === targetClean ||
    rawBusinessClean === cleanName(`${target.name} ${target.city}`) ||
    rawBusinessClean === cleanName(`${target.name}, ${target.city}`) ||
    rawBusinessClean === cleanName(`${target.name} - ${target.city}`) ||
    rawBusinessClean === cleanName(`${target.name} (${target.city})`) ||
    stripPunctuation(rowNameClean) === stripPunctuation(targetClean) ||
    stripPunctuation(rawBusinessClean) === stripPunctuation(targetClean);

  if (!nameMatches) {
    return { match: false, reason: "name_mismatch" };
  }

  // 5. City comparison if provided
  if (effectiveCity) {
    const cityMatches =
      cleanName(effectiveCity) === cleanName(target.city) ||
      stripPunctuation(effectiveCity) === stripPunctuation(target.city);
    if (!cityMatches) {
      return { match: false, reason: "city_mismatch", city: effectiveCity };
    }
  }

  // 6. State comparison if provided
  if (effectiveState) {
    const stateMatches =
      cleanName(effectiveState) === cleanName(target.state) ||
      stripPunctuation(effectiveState) === stripPunctuation(target.state);
    if (!stateMatches) {
      return { match: false, reason: "state_mismatch", state: effectiveState };
    }
  }

  return { match: true };
}

function validateRows(sheets, ctx) {
  const multiSheet = sheets.length > 1;
  const businesses = ctx.businesses || [];
  const byId = new Map();
  const byCode = new Map();
  const byName = new Map();
  const byNameAndCity = new Map();

  businesses.forEach((b) => {
    if (b._id) byId.set(String(b._id), b);
    if (b.code) byCode.set(String(b.code).toUpperCase(), b);
    const k = cleanName(b.name);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(b);

    const kc = `${k}|${cleanName(b.city)}`;
    if (!byNameAndCity.has(kc)) byNameAndCity.set(kc, b);
  });
  const target = ctx.targetBusiness || null;
  const rows = [];
  let blankRows = 0;

  sheets.forEach(({ table, mappingInfo }) => {
    const { headers, dataRows, headerRowIndex, sheetName } = table;
    const { mapping, impliedBasis } = mappingInfo;
    const get = (row, key) => (mapping[key] === undefined ? "" : row[mapping[key]]);

    dataRows.forEach((row, i) => {
      const rowNumber = headerRowIndex + 2 + i; // 1-based spreadsheet row
      const rowLabel = multiSheet ? `${sheetName} row ${rowNumber}` : `Row ${rowNumber}`;
      const cells = row || [];
      if (cells.every((c) => c === "" || c === null || c === undefined)) {
        blankRows++;
        return;
      }

      const raw = {};
      headers.forEach((h, idx) => {
        if (h) raw[h] = cells[idx] === undefined ? "" : cells[idx];
      });

      const errors = [];
      const warnings = [];
      const rawBusiness = String(get(cells, "businessName") || "").trim();
      const base = { rowNumber, sheet: sheetName, rowLabel, raw };

      // Totals / summary rows are a common reason for bad imports.
      const totalsRx = /^(grand\s*)?totals?:?$|^sub\s*-?\s*totals?:?$/i;
      const isTotalsRow =
        totalsRx.test(rawBusiness) ||
        (!rawBusiness && totalsRx.test(String(get(cells, "month") || "").trim())) ||
        (!rawBusiness && totalsRx.test(String(get(cells, "transactionDate") || "").trim()));
      if (isTotalsRow) {
        errors.push('This looks like a totals row. Remove summary rows ("Total") from the sheet.');
        rows.push({ ...base, data: null, errors, warnings });
        return;
      }

      // Date / Month parsing:
      // Priority 1: transactionDate column
      // Priority 2: month column (+ optional year column)
      // Priority 3: manualDateOverride / form startDate + endDate
      // Priority 4: form defaultPeriod
      const yearCell = get(cells, "year");
      const rowYear = mapping.year !== undefined ? parseYear(yearCell) : null;
      if (mapping.year !== undefined && yearCell !== "" && yearCell !== null && !rowYear) errors.push(`Year "${yearCell}" is not recognised.`);

      let dateObj = null;
      let recordType = "summary";
      let periodType = "monthly";
      let dateInst = null;
      let dateStr = null;
      let startDateInst = null;
      let endDateInst = null;
      let my = null;

      if (mapping.transactionDate !== undefined) {
        const rawDate = get(cells, "transactionDate");
        if (rawDate !== "" && rawDate !== null && rawDate !== undefined) {
          dateObj = parseTransactionDate(rawDate, rowYear || (ctx.defaultPeriod && ctx.defaultPeriod.year) || null);
          if (dateObj) {
            recordType = "transaction";
            periodType = "daily";
            dateInst = dateObj.date;
            dateStr = dateObj.dateStr;
            startDateInst = ist.startOfISTDay(dateObj.date);
            endDateInst = ist.endOfISTDay(dateObj.date);
            my = { month: dateObj.month, year: dateObj.year, monthName: dateObj.monthName };
          } else {
            errors.push(`Date "${rawDate}" is not recognised (use e.g. "YYYY-MM-DD", "DD/MM/YYYY", "DD-Mon-YYYY", or an Excel date).`);
          }
        }
      }

      if (!dateObj && mapping.month !== undefined) {
        const rawMonth = get(cells, "month");
        my = parseMonth(rawMonth, rowYear || (ctx.defaultPeriod && ctx.defaultPeriod.year) || null);
        if (rawMonth === "" || rawMonth === null) {
          if (ctx.defaultPeriod) my = ctx.defaultPeriod;
          else if (!dateObj) errors.push('Month is missing (use e.g. "October 2026" or "2026-10", or choose the reporting period in the upload form).');
        } else if (!my) {
          errors.push(`Month "${rawMonth}" is not recognised (use e.g. "October 2026", "Oct-2026", "2026-10", or a Month + Year column).`);
        } else if (rowYear && my.year !== rowYear && /\d{4}/.test(String(rawMonth))) {
          errors.push(`Month "${rawMonth}" and Year "${yearCell}" disagree.`);
        }
        if (my) {
          recordType = "summary";
          periodType = "monthly";
          const range = ist.istMonthRange(my.year, my.month);
          startDateInst = range.start;
          endDateInst = range.end;
          dateInst = range.start;
          dateStr = ist.istDayKey(range.start);
        }
      }

      if (!dateObj && !my) {
        if (ctx.startDate && ctx.endDate) {
          const sInst = ist.parseISTDateTime(ctx.startDate);
          const eInst = ist.parseISTDateTime(ctx.endDate);
          if (sInst && eInst) {
            const isSingleDay = ctx.startDate === ctx.endDate;
            recordType = isSingleDay ? "transaction" : "summary";
            periodType = isSingleDay ? "daily" : (ctx.reportingPeriod || "custom");
            dateInst = sInst;
            dateStr = ctx.startDate;
            startDateInst = ist.startOfISTDay(sInst);
            endDateInst = ist.endOfISTDay(eInst);
            const p = ist.toISTParts(sInst);
            my = { month: p.month, year: p.year, monthName: `${MONTH_NAMES[p.month - 1]} ${p.year}` };
          } else {
            errors.push("Selected upload form date range is invalid.");
          }
        } else if (ctx.defaultPeriod) {
          my = ctx.defaultPeriod;
          recordType = "summary";
          periodType = "monthly";
          const range = ist.istMonthRange(my.year, my.month);
          startDateInst = range.start;
          endDateInst = range.end;
          dateInst = range.start;
          dateStr = ist.istDayKey(range.start);
        } else if (!errors.some((e) => e.includes("Date") || e.includes("Month"))) {
          errors.push("Date or Month is missing (or select reporting period in the upload controls).");
        }
      }

      if (my && ctx.defaultPeriod && mapping.month !== undefined && (my.month !== ctx.defaultPeriod.month || my.year !== ctx.defaultPeriod.year)) {
        warnings.push(`Row is for ${my.monthName}, not the selected ${ctx.defaultPeriod.monthName} (the file's period is used).`);
      }

      // Business + location (stable IDs are resolved here)
      const rawLocation = get(cells, "location");
      const isLocDuplicated =
        (mapping.businessName !== undefined && mapping.location !== undefined && mapping.businessName === mapping.location) ||
        (rawLocation && rawBusiness && cleanName(rawLocation) === cleanName(rawBusiness));

      const loc = splitLocation(isLocDuplicated ? "" : rawLocation);
      const stateCell = String(get(cells, "state") || "").trim() || loc.state;
      const rawBusinessId = mapping.businessId !== undefined ? String(get(cells, "businessId") || "").trim() : "";
      const parsed = parseBusinessCell(rawBusiness);
      const effectiveCity = loc.city || parsed.city;
      const effectiveState = stateCell || parsed.state;

      let business = null;
      if (target) {
        const check = matchesTarget(target, { rawBusinessId, rawBusiness, parsed, effectiveCity, effectiveState });
        if (check.match) {
          business = target;
        } else if (check.reason === "id_mismatch") {
          const other = byId.get(rawBusinessId) || byCode.get(rawBusinessId.toUpperCase());
          if (other) {
            if (ctx.authorizedIds && !ctx.authorizedIds.has(String(other._id))) {
              errors.push(`Business ID "${rawBusinessId}" is outside your authorized scope.`);
            } else {
              errors.push(
                `Row Business ID "${rawBusinessId}" is for "${other.name}, ${other.city}", but the upload target is "${target.name}, ${target.city}".`
              );
            }
          } else {
            errors.push(`Business ID "${rawBusinessId}" was not found in registered businesses.`);
          }
        } else if (check.reason === "city_mismatch") {
          errors.push(
            `Row is for "${target.name}, ${check.city}" but the upload target is "${target.name}, ${target.city}".`
          );
        } else if (check.reason === "state_mismatch") {
          errors.push(
            `Row is for "${target.name}" in state "${check.state}", but the upload target is in "${target.state}".`
          );
        } else {
          // name_mismatch: Check if row matches another business in DB
          const otherCandidates = byName.get(cleanName(parsed.name || rawBusiness)) || [];
          const other = otherCandidates.find((b) => !effectiveCity || cleanName(b.city) === cleanName(effectiveCity)) || otherCandidates[0];
          if (other) {
            if (ctx.authorizedIds && !ctx.authorizedIds.has(String(other._id))) {
              errors.push(
                `Row is for "${other.name}, ${other.city}" which is outside your authorized scope, while the upload target is "${target.name}, ${target.city}".`
              );
            } else {
              errors.push(
                `Row is for "${other.name}, ${other.city}" but the upload target is "${target.name}, ${target.city}". Choose the matching target business or clear the target business to import several businesses.`
              );
            }
          } else {
            errors.push(
              `Row is for "${rawBusiness}${effectiveCity && !rawBusiness.includes(effectiveCity) ? `, ${effectiveCity}` : ""}" but the upload target is "${target.name}, ${target.city}". Remove this row or clear the target business to import several businesses from one file.`
            );
          }
        }
      } else {
        // Multi-business file (target is not set)
        if (rawBusinessId) {
          const found = byId.get(rawBusinessId) || byCode.get(rawBusinessId.toUpperCase());
          if (found) {
            business = found;
          } else {
            errors.push(`Business ID "${rawBusinessId}" was not found in registered businesses.`);
          }
        } else if (rawBusiness) {
          const searchName = cleanName(parsed.name || rawBusiness);
          const candidates = byName.get(searchName) || [];
          let matches = candidates;
          if (effectiveCity) matches = matches.filter((b) => cleanName(b.city) === cleanName(effectiveCity));
          if (effectiveState) matches = matches.filter((b) => cleanName(b.state) === cleanName(effectiveState));

          if (matches.length === 1) {
            business = matches[0];
          } else if (matches.length > 1) {
            errors.push(
              `"${rawBusiness}" exists in ${matches.map((b) => `${b.city}, ${b.state}`).join(" and ")} — add the Location column or choose the target business.`
            );
          } else if (candidates.length) {
            errors.push(
              `"${rawBusiness}" was not found in ${[effectiveCity, effectiveState].filter(Boolean).join(", ")}; it exists in ${candidates
                .map((b) => `${b.city}, ${b.state}`)
                .join(" / ")}. Check the Location.`
            );
          } else {
            const best = businesses.map((b) => ({ b, s: similarity(searchName, cleanName(b.name)) })).sort((a, b2) => b2.s - a.s)[0];
            const hint = best && best.s >= 0.5 ? ` Did you mean "${best.b.name}" (${best.b.city})?` : "";
            errors.push(`Business "${rawBusiness}" is not registered in the portal.${hint}`);
          }
        } else {
          errors.push("Business Name is missing (or choose the target business in the upload form).");
        }
      }

      if (business && ctx.authorizedIds && !ctx.authorizedIds.has(String(business._id))) {
        errors.push(`You are not authorized to import sales for "${business.name}" (${business.city}, ${business.state}).`);
        business = null;
      }

      // Amounts
      const amounts = {};
      const amountField = (key, label, opts = {}) => {
        const r = parseAmount(get(cells, key), opts);
        if (r.error) errors.push(`${label} ${r.error}.`);
        amounts[key] = r.error ? null : r.value;
      };
      amountField("totalSales", "Total Sales");
      if (mapping.totalSales !== undefined && amounts.totalSales === null && !errors.some((e) => e.startsWith("Total Sales"))) {
        errors.push("Total Sales is missing.");
      }
      amountField("orders", "Orders", { integer: true });
      amountField("target", "Target");
      amountField("discount", "Discount");
      amountField("cost", "Cost");
      amountField("expenses", "Expenses");
      amountField("profitLoss", "Profit/Loss", { allowNegative: true });

      // Sales basis
      let salesBasis = impliedBasis || "gross";
      if (mapping.salesBasis !== undefined) {
        const b = parseBasis(get(cells, "salesBasis"));
        if (b.error) errors.push(b.error);
        else if (b.value) salesBasis = b.value;
      }
      if (salesBasis === "gross" && amounts.discount !== null && amounts.totalSales !== null && amounts.discount > amounts.totalSales) {
        errors.push('Discount is larger than gross Total Sales. If Total Sales is already net of discounts, set Sales Basis to "Net".');
      }

      if (business && amounts.target === null) {
        if (business.monthlyTarget > 0) warnings.push(`Target not provided — the business monthly target (₹${business.monthlyTarget.toLocaleString("en-IN")}) will be used.`);
        else warnings.push("Target not provided and the business has no monthly target — target comparison will show as not configured.");
      }
      if (mapping.discount !== undefined && amounts.discount === null && !errors.some((e) => e.startsWith("Discount"))) {
        warnings.push("Discount is blank — treated as not recorded (enter 0 if no discount was given).");
      }

      const transactionId = mapping.transactionId !== undefined ? String(get(cells, "transactionId") || "").trim() || null : null;
      const rowHash = business && (dateStr || (my && my.monthName)) && amounts.totalSales !== null
        ? crypto
            .createHash("sha256")
            .update(
              [
                String(business._id),
                recordType,
                dateStr || my.monthName,
                amounts.totalSales,
                amounts.orders || 0,
                amounts.discount === null ? "" : amounts.discount,
                amounts.cost === null ? "" : amounts.cost,
                amounts.expenses === null ? "" : amounts.expenses,
                transactionId || "",
              ].join(":")
            )
            .digest("hex")
        : null;

      const data =
        business && my
          ? {
              businessId: String(business._id),
              businessName: business.name,
              category: business.category,
              state: business.state,
              city: business.city,
              recordType,
              date: dateInst,
              dateStr,
              startDate: startDateInst,
              endDate: endDateInst,
              periodType,
              transactionId,
              rowHash,
              month: my.month,
              year: my.year,
              monthName: my.monthName,
              totalSales: amounts.totalSales,
              salesBasis,
              orders: amounts.orders === null ? 0 : amounts.orders,
              target: amounts.target === null ? business.monthlyTarget || 0 : amounts.target,
              discount: amounts.discount,
              cost: amounts.cost,
              expenses: amounts.expenses,
              reportedProfit: amounts.profitLoss,
              remarks: String(get(cells, "remarks") || "").trim().slice(0, 500),
            }
          : null;

      rows.push({ ...base, data, errors, warnings });
    });
  });

  if (rows.length > MAX_ROWS) {
    throw fail(400, `The file has ${rows.length} data rows; the maximum per import is ${MAX_ROWS}. Split the file.`);
  }

  // Duplicates inside the file across all sheets
  const seen = new Map();
  rows.forEach((r) => {
    if (!r.data) return;
    let key;
    if (r.data.recordType === "transaction") {
      if (r.data.transactionId) key = `txn:${r.data.businessId}:${r.data.transactionId.toLowerCase()}`;
      else key = `hash:${r.data.businessId}:${r.data.rowHash}`;
    } else {
      key = `${r.data.businessId}:${r.data.year}:${r.data.month}`;
    }
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(r);
  });

  seen.forEach((list) => {
    if (list.length > 1) {
      const labels = list.map((r) => (multiSheet ? r.rowLabel : r.rowNumber)).join(", ");
      const first = list[0].data;
      const periodDesc = first.recordType === "transaction" ? (first.transactionId ? `with Transaction ID "${first.transactionId}"` : `on ${first.dateStr}`) : `for ${first.monthName}`;
      list.forEach((r) =>
        r.errors.push(`Duplicate in file: rows ${labels} are all "${r.data.businessName}" ${periodDesc}. Keep only one.`)
      );
    }
  });

  // Records that already exist in the database
  const existing = ctx.existingKeys || new Map();
  rows.forEach((r) => {
    if (!r.data || r.errors.length) return;
    let ex = null;
    if (r.data.recordType === "transaction") {
      if (r.data.transactionId) ex = existing.get(`txn:${r.data.businessId}:${r.data.transactionId.toLowerCase()}`);
      if (!ex && r.data.rowHash) ex = existing.get(`hash:${r.data.businessId}:${r.data.rowHash}`);
      if (!ex) ex = existing.get(`${r.data.businessId}:${r.data.dateStr}`);
    } else {
      ex = existing.get(`${r.data.businessId}:${r.data.year}:${r.data.month}`) || existing.get(`sum:${r.data.businessId}:${r.data.year}:${r.data.month}`);
    }

    if (ex) {
      r.existing = { _id: ex._id, totalSales: ex.totalSales, orders: ex.orders, source: ex.source, importJob: ex.importJob || null };
      const periodLabel = r.data.recordType === "transaction" ? (r.data.dateStr || r.data.monthName) : r.data.monthName;
      r.warnings.push(
        `${r.data.businessName} / ${periodLabel} already has data (₹${Number(ex.totalSales || 0).toLocaleString("en-IN")}). Choose "Replace" to overwrite it with this file, or "Add new only" to keep it.`
      );
    }
  });

  rows.forEach((r) => {
    r.status = r.errors.length ? "invalid" : "valid";
  });
  return { rows, blankRows };
}

// ---------------------------------------------------------------------------
// One-call entry point
// ---------------------------------------------------------------------------

/**
 * Parses every sheet, maps columns and validates rows.
 * Returns { sheets: [{ table, mappingInfo }], ignoredSheets, missingRequired, rows, blankRows,
 *           table, mappingInfo, detectedPeriod }
 */
function parseAndValidate(buffer, { filename, mappingOverride, ...ctx }) {
  const hints = mappingOverride ? Object.values(mappingOverride) : [];
  const { tables, ignoredSheets, needsMappingFallback } = readTables(buffer, { filename, headerHints: hints });
  const sheets = tables.map((table) => ({ table, mappingInfo: buildMapping(table.headers, mappingOverride, ctx) }));

  const allHeaders = new Set(tables.flatMap((t) => t.headers.filter(Boolean)));
  const overrideErrors = Object.entries(mappingOverride || {})
    .filter(([k, h]) => COLUMN_BY_KEY[k] && h && !allHeaders.has(h))
    .map(([k, h]) => `Column "${h}" selected for ${COLUMN_BY_KEY[k].label} was not found in the file.`);
  if (overrideErrors.length) throw fail(400, overrideErrors.join(" "));

  const incomplete = sheets.filter((s) => s.mappingInfo.missingRequired.length);
  const missingRequired = [...new Set(incomplete.flatMap((s) => s.mappingInfo.missingRequired))];
  const result = missingRequired.length || needsMappingFallback ? { rows: [], blankRows: 0 } : validateRows(sheets, ctx);

  const detectedPeriod = detectReportingPeriod(result.rows);

  return {
    sheets,
    ignoredSheets,
    missingRequired: missingRequired.length ? missingRequired : needsMappingFallback ? requiredKeys(ctx).map((k) => COLUMN_BY_KEY[k] ? COLUMN_BY_KEY[k].label : k) : [],
    incompleteSheets: incomplete.map((s) => s.table.sheetName),
    table: sheets[0].table,
    mappingInfo: sheets[0].mappingInfo,
    detectedPeriod,
    ...result,
  };
}

// ---------------------------------------------------------------------------
// Templates & reports
// ---------------------------------------------------------------------------

/** Builds the downloadable template (xlsx or csv buffer). */
function buildTemplate({ format = "xlsx", sampleBusinesses = [], month = null } = {}) {
  const header = TEMPLATE_COLUMNS.map((c) => c.label);
  const monthLabel = month || "October 2026";
  const samples = (sampleBusinesses.length ? sampleBusinesses.slice(0, 3) : [null]).map((b, i) => ({
    Month: monthLabel,
    "Business Name": b ? b.name : "Your Business Name (must match the portal exactly)",
    Location: b ? b.city : "Ranchi",
    State: b ? b.state : "Jharkhand",
    "Total Sales": [280000, 180000, 95000][i],
    "Sales Basis": "Gross",
    Orders: [135, 95, 40][i],
    Target: b && b.monthlyTarget ? b.monthlyTarget : [300000, 200000, 100000][i],
    Discount: [12000, 8000, ""][i],
    Cost: [150000, 90000, ""][i],
    Expenses: [60000, 45000, ""][i],
    "Profit/Loss": [58000, 37000, ""][i],
    Remarks: ["", "Improving", "Discount/cost not tracked yet"][i],
  }));

  if (format === "csv") {
    const esc = (v) => {
      const s = String(v == null ? "" : v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(","), ...samples.map((r) => header.map((h) => esc(r[h])).join(","))];
    return Buffer.from(`﻿${lines.join("\r\n")}\r\n`, "utf8");
  }

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(samples, { header });
  ws["!cols"] = header.map((h) => ({ wch: Math.max(14, h.length + 4) }));
  ws["!cols"][1] = { wch: 40 };
  xlsx.utils.book_append_sheet(wb, ws, "Monthly Sales");

  const instructions = [
    ["Column", "Required", "Format / rules"],
    ["Month", "Yes*", 'Month and year, e.g. "October 2026", "Oct-2026", "2026-10" or an Excel date. A separate "Year" column also works. *Optional if you choose the reporting month in the upload form.'],
    ["Business Name", "Yes*", "Exactly as registered in the portal (see the Businesses sheet). *Optional if you choose the target business in the upload form."],
    ["Location", "If the name exists in several cities", 'City, e.g. "Ranchi" or "Dhanbad" (or "Ranchi, Jharkhand").'],
    ["State", "No", "Optional; helps when the same business name exists in two states."],
    ["Total Sales", "Yes", "Number, no negatives. ₹ and commas are allowed (2,50,000)."],
    ["Sales Basis", "No (default Gross)", '"Gross" = before discounts, "Net" = already after discounts. Prevents double-subtracting discounts.'],
    ["Orders", "No", "Whole number."],
    ["Target", "No", "Monthly sales target. Blank = business monthly target."],
    ["Discount", "No", "Total discount given. Leave BLANK if unknown (0 means no discount)."],
    ["Cost", "No", "Cost of goods/services sold. Leave BLANK if unknown."],
    ["Expenses", "No", "Operating expenses. Leave BLANK if unknown."],
    ["Profit/Loss", "No", "Reported net profit (negative = loss, e.g. -5000 or (5,000)). Used when cost/expenses are not given."],
    ["Remarks", "No", "Free text."],
    [],
    ["Notes", "", "One row per business per month. Duplicate business+month rows are rejected. Do not add total rows. All sheets with a sales column are imported."],
  ];
  const wsI = xlsx.utils.aoa_to_sheet(instructions);
  wsI["!cols"] = [{ wch: 16 }, { wch: 22 }, { wch: 110 }];
  xlsx.utils.book_append_sheet(wb, wsI, "Instructions");

  if (sampleBusinesses.length) {
    const list = sampleBusinesses.map((b) => ({ "Business Name": b.name, Location: b.city, State: b.state, Category: b.category || "" }));
    const wsB = xlsx.utils.json_to_sheet(list);
    wsB["!cols"] = [{ wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 14 }];
    xlsx.utils.book_append_sheet(wb, wsB, "Businesses");
  }
  return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
}

/** CSV error report: original columns + sheet, row and reasons. */
function invalidRowsCsv(invalidRows, headers) {
  const cols = ["Sheet", "Row Number", ...headers.filter(Boolean), "Errors"];
  const esc = (v) => {
    const s = String(v == null ? "" : v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.map(esc).join(",")];
  invalidRows.forEach((r) => {
    lines.push(
      [r.sheet || "", r.rowNumber, ...headers.filter(Boolean).map((h) => (r.raw ? r.raw[h] : "")), (r.errors || []).join(" | ")]
        .map(esc)
        .join(",")
    );
  });
  return Buffer.from(`﻿${lines.join("\r\n")}\r\n`, "utf8");
}

/**
 * Checks the file's real content against its extension (magic bytes), so a
 * renamed executable or HTML page is rejected before parsing.
 */
function detectFileKind(buffer, filename = "") {
  const ext = (String(filename).toLowerCase().match(/\.(csv|xlsx|xls)$/) || [])[1];
  if (!ext) return { ok: false, error: "Only .csv, .xlsx and .xls files are accepted." };
  if (!buffer || !buffer.length) return { ok: false, error: "The file is empty." };
  const b = buffer;
  const isZip = b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
  const isOle = b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
  if (ext === "xlsx") {
    if (!isZip) return { ok: false, error: "This .xlsx file is not a valid Excel workbook." };
    if (/vbaProject\.bin/i.test(b.toString("latin1"))) return { ok: false, error: "Macro-enabled workbooks are not accepted. Save as a normal .xlsx file." };
    return { ok: true, kind: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }
  if (ext === "xls") {
    // Old Excel files are OLE; Excel also saves HTML/XML "xls" which we refuse.
    if (!isOle) return { ok: false, error: "This .xls file is not a valid Excel 97-2003 workbook. Save it as .xlsx or .csv." };
    return { ok: true, kind: "xls", mime: "application/vnd.ms-excel" };
  }
  // CSV: must be text (no NUL bytes) and not a disguised binary
  if (isZip || isOle) return { ok: false, error: "This file is an Excel workbook saved with a .csv name. Rename it to .xlsx/.xls or export as CSV." };
  const sample = b.slice(0, Math.min(b.length, 65536));
  if (sample.includes(0)) return { ok: false, error: "This .csv file contains binary data and cannot be imported." };
  if (/^\s*<(!doctype|html|\?xml)/i.test(sample.toString("utf8"))) return { ok: false, error: "This .csv file contains HTML/XML, not comma-separated data." };
  return { ok: true, kind: "csv", mime: "text/csv" };
}

module.exports = {
  COLUMNS,
  TEMPLATE_COLUMNS,
  MAX_ROWS,
  normalizeHeader,
  matchHeader,
  parseMonth,
  parseYear,
  parseTransactionDate,
  detectReportingPeriod,
  parseAmount,
  parseBasis,
  readTable,
  readTables,
  buildMapping,
  validateRows,
  parseAndValidate,
  buildTemplate,
  invalidRowsCsv,
  detectFileKind,
  requiredKeys,
};
