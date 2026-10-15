/**
 * Restaurant POS "day wise" report parser (e.g. Petpooja "All Restaurant
 * Report - Day Wise"), CSV or Excel. Pure — no database access.
 *
 * Report layout handled (positions are detected, never assumed):
 *   - metadata lines above the table: report name, "Report Period ... to ...",
 *     possibly the restaurant name
 *   - one header row (Restaurants | Date | Invoice Nos. | Total no. of bills |
 *     My Amount (₹) | Total Discount (₹) | Net Sales (₹) (M.A - T.D) | ... | Pax)
 *   - daily rows; the restaurant name is printed on the first row of each
 *     restaurant's section and left blank below it (forward-filled here, only
 *     until that section's summary rows)
 *   - summary rows: Total, Min., Max., Avg. per section and a Sub Total
 *     (never imported as sales; used only to reconcile)
 *
 * Money is handled in integer paise so sums are exact; values are returned in
 * rupees with 2 decimals. Source values are never altered: mismatches are
 * reported as reconciliation warnings.
 */
const { parseDateKey, isValidKey, spanDays, addDays } = require("../periods");

// canonical key -> header test on the normalised header text
const COLUMN_RULES = [
  ["restaurant", (h) => /^(restaurants?|restaurantname|outlets?|outletname|branch|store)$/.test(h)],
  ["date", (h) => /^(date|billdate|businessdate|day)$/.test(h)],
  ["invoiceNos", (h) => /^(invoicenos?|invoicenumbers?|invoices|billnos?)$/.test(h)],
  ["bills", (h) => /^(totalnoofbills|noofbills|totalbills|bills|billcount)$/.test(h)],
  ["grossAmount", (h) => /^(myamount|grossamount|subtotalamount)$/.test(h)],
  ["discount", (h) => /^(totaldiscount|discount|discounts)$/.test(h)],
  ["netSales", (h) => /^netsales/.test(h)],
  ["deliveryCharge", (h) => /^deliverycharges?$/.test(h)],
  ["containerCharge", (h) => /^(containercharges?|packagingcharges?)$/.test(h)],
  ["serviceCharge", (h) => /^servicecharges?$/.test(h)],
  ["tax", (h) => /^(totaltax|tax|taxes|gst)$/.test(h)],
  ["waivedOff", (h) => /^waivedoff$/.test(h)],
  ["roundOff", (h) => /^roundoff$/.test(h)],
  ["totalSales", (h) => /^(totalsales|grandtotal|totalamount)$/.test(h)],
  ["notPaid", (h) => /^notpaid$/.test(h)],
  ["cash", (h) => /^cash$/.test(h)],
  ["card", (h) => /^card$/.test(h)],
  ["duePayment", (h) => /^(duepayment|due)$/.test(h)],
  ["other", (h) => /^(other|others)$/.test(h)],
  ["wallet", (h) => /^wallet$/.test(h)],
  ["upi", (h) => /^upi$/.test(h)],
  ["online", (h) => /^online$/.test(h)],
  ["pax", (h) => /^(pax|covers|guests)$/.test(h)],
];
const MONEY_KEYS = ["grossAmount", "discount", "netSales", "deliveryCharge", "containerCharge", "serviceCharge", "tax", "waivedOff", "roundOff", "totalSales", "notPaid", "cash", "card", "duePayment", "other", "wallet", "upi", "online"];
const COUNT_KEYS = ["bills", "pax"];
const PAYMENT_KEYS = ["cash", "card", "duePayment", "other", "wallet", "upi", "online"];
const NEGATIVE_OK = new Set(["roundOff"]);
const LABELS = {
  restaurant: "Restaurants", date: "Date", invoiceNos: "Invoice Nos.", bills: "Total no. of bills", grossAmount: "My Amount",
  discount: "Total Discount", netSales: "Net Sales (M.A - T.D)", deliveryCharge: "Delivery Charge", containerCharge: "Container Charge",
  serviceCharge: "Service Charge", tax: "Total Tax", waivedOff: "Waived off", roundOff: "Round Off", totalSales: "Total Sales",
  notPaid: "Not Paid", cash: "Cash", card: "Card", duePayment: "Due Payment", other: "Other", wallet: "Wallet", upi: "UPI", online: "Online", pax: "Pax",
};
const SUMMARY_RX = /^(sub\s*-?\s*total|grand\s*total|total|min\.?|minimum|max\.?|maximum|avg\.?|average)\s*:?$/i;
const summaryType = (s) => {
  const t = String(s || "").trim().toLowerCase().replace(/[.:]/g, "").replace(/\s+/g, " ");
  if (/^sub ?-?total$/.test(t)) return "subTotal";
  if (t === "total" || t === "grand total") return "total";
  if (t === "min" || t === "minimum") return "min";
  if (t === "max" || t === "maximum") return "max";
  if (t === "avg" || t === "average") return "avg";
  return null;
};

const norm = (h) =>
  String(h == null ? "" : h)
    .replace(/^﻿/, "")
    .toLowerCase()
    .replace(/\((?:inr|rs\.?|₹)\)/g, "")
    .replace(/₹/g, "")
    .replace(/[^a-z0-9]/g, "");

/** "1,234.50" / 1234.5 / "(12.00)" / "₹ 99" -> integer paise; "" -> null. Returns { paise } or { error }. */
function toPaise(value, { allowNegative = false } = {}) {
  if (value === null || value === undefined) return { paise: null };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { error: "is not a number" };
    if (value < 0 && !allowNegative) return { error: "cannot be negative" };
    return { paise: Math.round(value * 100) };
  }
  const s = String(value).trim();
  if (s === "" || s === "-" || s === "—" || /^n\/?a$/i.test(s)) return { paise: null };
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s.replace(/[₹\s]/g, ""));
  const cleaned = s.replace(/[₹,\s()]|rs\.?|inr/gi, "").replace(/^-/, "");
  const m = /^(\d+)(?:\.(\d{1,4}))?$/.exec(cleaned);
  if (!m) return { error: `is not a number ("${s}")` };
  if (neg && !allowNegative) return { error: "cannot be negative" };
  // exact decimal -> paise without floating point
  const frac = (m[2] || "").padEnd(4, "0");
  let paise = Number(m[1]) * 100 + Number(frac.slice(0, 2));
  if (Number(frac[2]) >= 5) paise += 1; // round half up on the 3rd decimal
  return { paise: neg ? -paise : paise };
}
const rupees = (p) => (p === null || p === undefined ? null : p / 100);
const sumPaise = (vals) => {
  const present = vals.filter((v) => v !== null && v !== undefined);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
};
const toCount = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return { value: null };
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return { error: `"${value}" is not a whole number` };
  return { value: n };
};
/** Invoice Nos. stay text exactly as shown ("10781-10862"); a lone number is not reformatted. */
const invoiceText = (v) => (v === null || v === undefined ? "" : typeof v === "number" ? String(Math.trunc(v) === v ? v : v) : String(v).trim());

function mapHeaders(row) {
  const mapping = {};
  (row || []).forEach((cell, idx) => {
    const h = norm(cell);
    if (!h) return;
    for (const [key, test] of COLUMN_RULES) {
      if (mapping[key] === undefined && test(h)) {
        mapping[key] = idx;
        break;
      }
    }
  });
  return mapping;
}

/** Is this sheet a day-wise restaurant report? Returns the header row index or -1. */
function findHeaderRow(rows) {
  const limit = Math.min(rows.length, 30);
  for (let i = 0; i < limit; i++) {
    const m = mapHeaders(rows[i]);
    const money = ["grossAmount", "netSales", "totalSales"].filter((k) => m[k] !== undefined).length;
    if (m.date !== undefined && money >= 2 && (m.discount !== undefined || m.bills !== undefined)) return i;
  }
  return -1;
}

/** Report name + period from the lines above the header. */
function readMetadata(rows, headerRowIndex) {
  const lines = rows.slice(0, headerRowIndex).map((r) => (r || []).map((c) => (c === null || c === undefined ? "" : String(c).trim())).filter(Boolean));
  const meta = { reportName: null, periodStart: null, periodEnd: null, restaurantName: null, lines: lines.map((l) => l.join(" ")).filter(Boolean) };
  lines.forEach((cells) => {
    const text = cells.join(" ");
    // dates written as text or as Excel serials in separate cells
    const dateCells = (rows[lines.indexOf(cells)] || []).map((c) => parseDateKey(c)).filter(Boolean);
    const textDates = [...text.matchAll(/(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|\d{1,2}[\s-][A-Za-z]{3,9}[\s,-]+\d{4})/g)].map((x) => parseDateKey(x[1])).filter(Boolean);
    const dates = textDates.length >= 2 ? textDates : dateCells;
    if (!meta.periodStart && /period|from|duration|date/i.test(text) && dates.length >= 2) {
      [meta.periodStart, meta.periodEnd] = [dates[0], dates[1]].sort();
    }
    if (!meta.reportName && /report/i.test(text) && !/period/i.test(text)) meta.reportName = text.replace(/\s+/g, " ").slice(0, 200);
    const rn = /^(restaurant|outlet)\s*(name)?\s*[:-]\s*(.+)$/i.exec(text);
    if (rn) meta.restaurantName = rn[3].trim();
  });
  return meta;
}

function paiseRow(cells, mapping, errors) {
  const v = {};
  MONEY_KEYS.forEach((k) => {
    if (mapping[k] === undefined) return (v[k] = null);
    const r = toPaise(cells[mapping[k]], { allowNegative: NEGATIVE_OK.has(k) });
    if (r.error) errors.push(`${LABELS[k]} ${r.error}.`);
    v[k] = r.error ? null : r.paise;
  });
  COUNT_KEYS.forEach((k) => {
    if (mapping[k] === undefined) return (v[k] = null);
    const r = toCount(cells[mapping[k]]);
    if (r.error) errors.push(`${LABELS[k]}: ${r.error}.`);
    v[k] = r.error ? null : r.value;
  });
  return v;
}

const TOL = 2; // paise — allowance for the source's own per-bill rounding
function check(list, name, expected, actual, tolerance = TOL) {
  if (expected === null || actual === null) return null;
  const diff = actual - expected;
  const ok = Math.abs(diff) <= tolerance;
  const item = { check: name, expected: rupees(expected), actual: rupees(actual), difference: rupees(diff), ok };
  list.push(item);
  return item;
}

/** Row-level checks; returns warnings + the checks performed. */
function reconcileDay(v) {
  const checks = [];
  check(checks, "My Amount − Total Discount = Net Sales", v.grossAmount !== null && v.discount !== null ? v.grossAmount - v.discount : null, v.netSales);
  const paid = PAYMENT_KEYS.map((k) => v[k]);
  const paidSum = paid.every((x) => x === null) ? null : sumPaise(paid) + (v.notPaid || 0);
  check(checks, "Payments (Cash+Card+Due+Other+Wallet+UPI+Online+Not Paid) = Total Sales", v.totalSales, paidSum, 100);
  const parts = [v.netSales, v.deliveryCharge, v.containerCharge, v.serviceCharge, v.tax];
  if (v.netSales !== null && v.tax !== null && v.totalSales !== null) {
    const built = sumPaise(parts) + (v.roundOff || 0) - (v.waivedOff || 0);
    check(checks, "Net Sales + charges + tax + round off − waived off = Total Sales", v.totalSales, built, 100);
  }
  return checks;
}

/**
 * Parses one worksheet (array of rows from sheet_to_json(header:1)).
 * Returns null when the sheet is not a day-wise report.
 */
function parseSheet(rows, sheetName = "Sheet1") {
  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex === -1) return null;
  const mapping = mapHeaders(rows[headerRowIndex]);
  const headers = (rows[headerRowIndex] || []).map((h) => String(h == null ? "" : h).trim());
  const meta = readMetadata(rows, headerRowIndex);
  const restaurantCol = mapping.restaurant;
  const labelCols = [restaurantCol, mapping.date, 0].filter((x) => x !== undefined);

  const sections = [];
  let current = null; // { restaurant, days: [], summaries: {} , closed }
  const reportSummaries = [];
  const invalidRows = [];
  const ignoredRows = [];

  const openSection = (name, rowNumber) => {
    current = { restaurant: name, firstRow: rowNumber, days: [], summaries: {}, closed: false };
    sections.push(current);
  };

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const cells = rows[i] || [];
    const rowNumber = i + 1;
    if (cells.every((c) => c === "" || c === null || c === undefined)) continue;

    // Summary row?
    let sType = null;
    for (const col of labelCols) {
      const t = summaryType(cells[col]);
      if (t) {
        sType = t;
        break;
      }
    }
    if (!sType) {
      const firstText = cells.find((c) => c !== "" && c !== null && c !== undefined);
      if (typeof firstText === "string" && SUMMARY_RX.test(firstText.trim())) sType = summaryType(firstText);
    }
    if (sType) {
      const errs = [];
      const values = paiseRow(cells, mapping, errs);
      const summary = { type: sType, rowNumber, values, errors: errs };
      if (sType === "subTotal") {
        reportSummaries.push(summary);
        if (current) current.closed = true; // a Sub Total ends the forward-fill scope
      } else if (current) {
        current.summaries[sType] = summary;
        if (sType === "total") current.closed = true;
      } else {
        reportSummaries.push(summary);
      }
      continue;
    }

    const rawName = restaurantCol === undefined ? "" : String(cells[restaurantCol] == null ? "" : cells[restaurantCol]).trim();
    const errors = [];
    const warnings = [];
    if (rawName) {
      if (!current || current.restaurant !== rawName || current.closed) openSection(rawName, rowNumber);
    } else if (!current) {
      if (meta.restaurantName || restaurantCol === undefined) openSection(meta.restaurantName || "", rowNumber);
      else errors.push("Restaurant name is blank and no restaurant was named above this row.");
    } else if (current.closed) {
      errors.push(`Restaurant name is blank after the summary rows of "${current.restaurant}" — the row cannot be assigned to a restaurant.`);
    }

    const rawDate = mapping.date === undefined ? "" : cells[mapping.date];
    const date = parseDateKey(rawDate);
    if (rawDate === "" || rawDate === null || rawDate === undefined) errors.push("Date is missing.");
    else if (!date) errors.push(`Date "${rawDate}" is not recognised.`);
    const values = paiseRow(cells, mapping, errors);
    if (values.grossAmount === null && values.netSales === null && values.totalSales === null && !errors.length) {
      errors.push("Row has no sales amounts.");
    }
    const raw = {};
    headers.forEach((h, idx) => {
      if (h) raw[h] = cells[idx] === undefined ? "" : cells[idx];
    });
    const row = {
      rowNumber,
      sheet: sheetName,
      restaurant: errors.length && !current ? rawName : current ? current.restaurant : rawName,
      date,
      invoiceNos: mapping.invoiceNos === undefined ? "" : invoiceText(cells[mapping.invoiceNos]),
      values,
      raw,
      errors,
      warnings,
    };
    if (errors.length || !current || (current.closed && !rawName)) invalidRows.push(row);
    else current.days.push(row);
  }

  // ---- validation & reconciliation ------------------------------------------
  const reconciliation = [];
  sections.forEach((sec) => {
    const seen = new Map();
    sec.days.forEach((d) => {
      if (seen.has(d.date)) {
        d.errors.push(`Duplicate date ${d.date} for "${sec.restaurant}" (also row ${seen.get(d.date)}).`);
      } else seen.set(d.date, d.rowNumber);
      d.checks = reconcileDay(d.values);
      d.checks.filter((c) => !c.ok).forEach((c) => d.warnings.push(`${c.check}: report shows ₹${fmt(c.expected)}, components give ₹${fmt(c.actual)} (difference ₹${fmt(c.difference)}).`));
      if (meta.periodStart && d.date && (d.date < meta.periodStart || d.date > meta.periodEnd)) {
        d.errors.push(`Date ${d.date} is outside the report period ${meta.periodStart} to ${meta.periodEnd}.`);
      }
    });
    // move rows that became invalid
    const bad = sec.days.filter((d) => d.errors.length);
    bad.forEach((d) => invalidRows.push(d));
    sec.days = sec.days.filter((d) => !d.errors.length);

    // Daily rows vs the section's Total / Min / Max / Avg rows
    const total = sec.summaries.total;
    sec.reconciliation = [];
    if (total) {
      [...MONEY_KEYS, ...COUNT_KEYS].forEach((k) => {
        const daily = sumPaise(sec.days.map((d) => d.values[k]));
        const scale = COUNT_KEYS.includes(k) ? 1 : 1;
        const tv = total.values[k];
        if (tv === null || daily === null) return;
        const tol = COUNT_KEYS.includes(k) ? 0 : Math.max(TOL, sec.days.length); // ≤ 1 paisa per row of rounding
        const c = check(sec.reconciliation, `Daily ${LABELS[k]} add up to the Total row`, tv * scale, daily, tol);
        if (c) c.metric = k;
      });
      ["min", "max"].forEach((t) => {
        const s = sec.summaries[t];
        if (!s) return;
        ["grossAmount", "netSales", "totalSales"].forEach((k) => {
          const vals = sec.days.map((d) => d.values[k]).filter((x) => x !== null);
          if (!vals.length || s.values[k] === null) return;
          const c = check(sec.reconciliation, `${t === "min" ? "Min." : "Max."} ${LABELS[k]} matches the daily rows`, s.values[k], t === "min" ? Math.min(...vals) : Math.max(...vals), 0);
          if (c) c.metric = k;
        });
      });
      const avg = sec.summaries.avg;
      if (avg) {
        ["grossAmount", "netSales", "totalSales"].forEach((k) => {
          const vals = sec.days.map((d) => d.values[k]).filter((x) => x !== null);
          if (!vals.length || avg.values[k] === null) return;
          const c = check(sec.reconciliation, `Avg. ${LABELS[k]} matches the daily rows`, avg.values[k], Math.round(sumPaise(vals) / vals.length), 1);
          if (c) c.metric = k;
        });
      }
    }
    sec.reconciliation.forEach((c) => (c.ok ? null : null));
  });

  // Sub Total vs section Totals: the Sub Total is a report-level summary and is
  // never added to the section totals.
  const subTotal = reportSummaries.find((s) => s.type === "subTotal") || null;
  const sectionTotals = sections.map((s) => s.summaries.total).filter(Boolean);
  let subTotalRelation = null;
  if (subTotal) {
    const keys = ["grossAmount", "netSales", "totalSales"].filter((k) => subTotal.values[k] !== null);
    const sumTotals = Object.fromEntries(keys.map((k) => [k, sumPaise(sectionTotals.map((t) => t.values[k]))]));
    const sumDaily = Object.fromEntries(keys.map((k) => [k, sumPaise(sections.flatMap((s) => s.days.map((d) => d.values[k])))]));
    const matchesTotals = keys.length && sectionTotals.length && keys.every((k) => sumTotals[k] !== null && Math.abs(sumTotals[k] - subTotal.values[k]) <= TOL);
    const matchesDaily = keys.length && keys.every((k) => sumDaily[k] !== null && Math.abs(sumDaily[k] - subTotal.values[k]) <= Math.max(TOL, sections.reduce((n, s) => n + s.days.length, 0)));
    subTotalRelation = {
      equalsSumOfSectionTotals: Boolean(matchesTotals),
      equalsSumOfDailyRows: Boolean(matchesDaily),
      note: matchesTotals
        ? sectionTotals.length === 1
          ? "Sub Total equals the restaurant's Total row (single restaurant) — it is the same figure and is counted once."
          : "Sub Total equals the sum of the restaurants' Total rows — it is a grand total and is not added again."
        : "Sub Total does not equal the sum of the Total rows — review the report.",
    };
    keys.forEach((k) => {
      const c = check(reconciliation, `Sub Total ${LABELS[k]} = daily rows`, subTotal.values[k], sumDaily[k], Math.max(TOL, sections.reduce((n, s) => n + s.days.length, 0)));
      if (c) c.metric = k;
    });
  }

  // Coverage of the report period
  const allDays = sections.flatMap((s) => s.days.map((d) => d.date)).filter(Boolean).sort();
  const coverage = { firstDate: allDays[0] || null, lastDate: allDays[allDays.length - 1] || null, missingDates: [] };
  if (meta.periodStart && isValidKey(meta.periodStart) && spanDays(meta.periodStart, meta.periodEnd) <= 400) {
    sections.forEach((s) => {
      const have = new Set(s.days.map((d) => d.date));
      for (let k = meta.periodStart; k <= meta.periodEnd; k = addDays(k, 1)) if (!have.has(k)) coverage.missingDates.push({ restaurant: s.restaurant, date: k });
    });
  }

  const warnings = [];
  sections.forEach((s) => {
    if (!s.summaries.total) warnings.push(`"${s.restaurant}": no Total row found — daily rows could not be reconciled with the report total.`);
    s.reconciliation.filter((c) => !c.ok).forEach((c) => warnings.push(`"${s.restaurant}": ${c.check} — Total row ₹${fmt(c.expected)}, daily rows ₹${fmt(c.actual)} (difference ₹${fmt(c.difference)}).`));
  });
  reconciliation.filter((c) => !c.ok).forEach((c) => warnings.push(`${c.check} — Sub Total ₹${fmt(c.expected)}, daily rows ₹${fmt(c.actual)} (difference ₹${fmt(c.difference)}).`));
  if (subTotalRelation && !subTotalRelation.equalsSumOfSectionTotals && sectionTotals.length) warnings.push(subTotalRelation.note);
  if (coverage.missingDates.length) warnings.push(`${coverage.missingDates.length} day(s) of the report period have no row (e.g. ${coverage.missingDates.slice(0, 3).map((m) => m.date).join(", ")}).`);
  if (!meta.periodStart) warnings.push("The report period was not found above the table; the period is taken from the first and last daily dates.");

  return {
    format: "restaurant_daywise",
    sheetName,
    headerRowIndex,
    headerRow: headerRowIndex + 1,
    headers,
    columns: Object.fromEntries(Object.entries(mapping).map(([k, idx]) => [k, headers[idx]])),
    missingColumns: Object.keys(LABELS).filter((k) => mapping[k] === undefined && !["restaurant"].includes(k)).map((k) => LABELS[k]),
    meta,
    sections,
    reportSummaries,
    subTotalRelation,
    reconciliation,
    coverage,
    invalidRows,
    ignoredRows,
    warnings,
  };
}

const fmt = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/** Converts a parsed day row to the stored representation (rupees). */
function toEntryValues(day) {
  const v = day.values;
  const r = (k) => rupees(v[k]);
  return {
    // core analytics fields: "My Amount" is the gross (pre-discount) sales figure
    totalSales: r("grossAmount") ?? r("netSales") ?? r("totalSales"),
    salesBasis: v.grossAmount !== null ? "gross" : "net",
    discount: v.grossAmount !== null ? r("discount") : null,
    orders: v.bills,
    metrics: {
      grossAmount: r("grossAmount"),
      discount: r("discount"),
      netSales: r("netSales"),
      deliveryCharge: r("deliveryCharge"),
      containerCharge: r("containerCharge"),
      serviceCharge: r("serviceCharge"),
      tax: r("tax"),
      waivedOff: r("waivedOff"),
      roundOff: r("roundOff"),
      totalSales: r("totalSales"),
      notPaid: r("notPaid"),
      bills: v.bills,
      pax: v.pax,
      payments: Object.fromEntries(PAYMENT_KEYS.map((k) => [k, r(k)])),
    },
    invoiceRange: day.invoiceNos,
    reconciliation: (day.checks || []).filter((c) => !c.ok).map(({ check: name, expected, actual, difference }) => ({ check: name, expected, actual, difference })),
  };
}

module.exports = { parseSheet, findHeaderRow, mapHeaders, toPaise, toEntryValues, summaryType, MONEY_KEYS, COUNT_KEYS, PAYMENT_KEYS, LABELS };
