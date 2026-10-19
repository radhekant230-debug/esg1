/**
 * Writing date-level sales (SalesEntry) from an import, and keeping the derived
 * monthly roll-ups (SalesRecord source "daily_rollup") in sync so the existing
 * monthly views (state dashboard, client overview) also show daily imports.
 */
const SalesEntry = require("../../models/sales/SalesEntry");
const SalesRecord = require("../../models/sales/SalesRecord");
const P = require("./periods");
const { applyPrecedence, toItems, select } = require("./rangeAnalytics");
const { aggregate } = require("./financials");
const ist = require("../../utils/istDate");

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const addMoney = (a, b) => Math.round(a * 100 + b * 100) / 100;

/** Sum a field across rows: a number only if EVERY row recorded it (never assume 0). */
function sumAll(rows, f) {
  if (!rows.every((r) => isNum(r[f]))) return null;
  return rows.reduce((s, r) => addMoney(s, r[f]), 0);
}

/**
 * Turns validated import rows (data.kind = "day" | "txn") into SalesEntry docs.
 * Rows without a transaction ID are summed per business per day.
 * Returns { docs, notes }.
 */
function buildEntryDocs(rows, { importJobId, user, sourceFormat = "generic" }) {
  const docs = [];
  const notes = [];
  const dayGroups = new Map();
  rows.forEach((r) => {
    const d = r.data;
    if (d.kind === "txn") {
      docs.push(entryDoc(d, { kind: "txn", transactionId: d.transactionId, rows: [r], importJobId, user, sourceFormat }));
    } else if (d.kind === "day") {
      const k = `${d.businessId}:${d.date}`;
      if (!dayGroups.has(k)) dayGroups.set(k, []);
      dayGroups.get(k).push(r);
    }
  });
  dayGroups.forEach((list) => {
    if (list.length === 1) return docs.push(entryDoc(list[0].data, { kind: "day", rows: list, importJobId, user, sourceFormat }));
    const ds = list.map((r) => r.data);
    const basis = new Set(ds.map((d) => d.salesBasis));
    const merged = {
      ...ds[0],
      totalSales: ds.reduce((s, d) => addMoney(s, d.totalSales), 0),
      salesBasis: basis.size === 1 ? ds[0].salesBasis : "gross",
      orders: ds.some((d) => isNum(d.orders)) ? ds.reduce((s, d) => s + (d.orders || 0), 0) : null,
      target: sumAll(ds, "target"),
      discount: basis.size === 1 ? sumAll(ds, "discount") : null,
      cost: sumAll(ds, "cost"),
      expenses: sumAll(ds, "expenses"),
      reportedProfit: sumAll(ds, "reportedProfit"),
      remarks: ds.map((d) => d.remarks).filter(Boolean).join(" | ").slice(0, 500),
    };
    if (basis.size > 1) notes.push(`${ds[0].businessName} ${ds[0].date}: rows mix Gross and Net sales — discount for the day is left as not recorded.`);
    docs.push(entryDoc(merged, { kind: "day", rows: list, importJobId, user, sourceFormat }));
  });
  return { docs, notes };
}

function entryDoc(d, { kind, transactionId = null, rows, importJobId, user, sourceFormat }) {
  return {
    business: d.businessId,
    client: d.clientId || null,
    businessName: d.businessName,
    city: d.city || "",
    state: d.state || "",
    kind,
    startKey: d.date,
    endKey: d.date,
    startDate: P.keyToDate(d.date),
    endDate: P.keyToDate(d.date),
    transactionId,
    lineCount: rows.length,
    totalSales: d.totalSales,
    salesBasis: d.salesBasis || "gross",
    orders: isNum(d.orders) ? d.orders : null,
    target: isNum(d.target) && d.target > 0 ? d.target : null,
    discount: isNum(d.discount) ? d.discount : null,
    cost: isNum(d.cost) ? d.cost : null,
    expenses: isNum(d.expenses) ? d.expenses : null,
    reportedProfit: isNum(d.reportedProfit) ? d.reportedProfit : null,
    remarks: d.remarks || "",
    metrics: d.metrics || undefined,
    invoiceRange: d.invoiceRange || "",
    reconciliation: d.reconciliation || [],
    sourceFormat: d.sourceFormat || sourceFormat,
    source: "excel_upload",
    importJob: importJobId,
    uploadedBy: user._id,
    uploaderName: user.name,
  };
}

/** Existing entries for preview duplicate detection: Map "d:biz:date" / "t:biz:txnId" -> entry. */
async function existingEntryMap(rows) {
  const dayRows = rows.filter((r) => r.data && (r.data.kind === "day" || r.data.kind === "txn"));
  if (!dayRows.length) return new Map();
  const byBiz = new Map();
  dayRows.forEach((r) => {
    const b = r.data.businessId;
    const cur = byBiz.get(b) || { min: r.data.date, max: r.data.date };
    cur.min = r.data.date < cur.min ? r.data.date : cur.min;
    cur.max = r.data.date > cur.max ? r.data.date : cur.max;
    byBiz.set(b, cur);
  });
  const or = [...byBiz.entries()].map(([b, x]) => ({ business: b, startKey: { $gte: x.min, $lte: x.max }, kind: { $in: ["day", "txn"] } }));
  const found = await SalesEntry.find({ $or: or }).select("business kind startKey transactionId totalSales source importJob").lean();
  const map = new Map();
  found.forEach((e) => map.set(e.kind === "txn" ? `t:${e.business}:${e.transactionId}` : `d:${e.business}:${e.startKey}`, e));
  return map;
}

/** Per business, the span the import covers: the report period, or first..last date in the file. */
function coveredSpans(rows, reportPeriod = null) {
  const spans = new Map();
  rows.forEach((r) => {
    const d = r.data;
    if (!d || (d.kind !== "day" && d.kind !== "txn")) return;
    const cur = spans.get(d.businessId) || { start: d.date, end: d.date };
    cur.start = d.date < cur.start ? d.date : cur.start;
    cur.end = d.date > cur.end ? d.date : cur.end;
    spans.set(d.businessId, cur);
  });
  if (reportPeriod && reportPeriod.start && reportPeriod.end) {
    spans.forEach((s) => {
      s.start = reportPeriod.start < s.start ? reportPeriod.start : s.start;
      s.end = reportPeriod.end > s.end ? reportPeriod.end : s.end;
    });
  }
  return spans;
}

/** Business-months touched by a set of spans (for roll-up refresh). */
function monthsOfSpans(spans) {
  const out = new Set();
  spans.forEach((s, biz) => P.monthsBetween(s.start, s.end).forEach((m) => out.add(`${biz}:${m.y}:${m.m}`)));
  return out;
}

/**
 * Recomputes the derived monthly roll-up for each "biz:year:month".
 * A real monthly summary (manual or imported) is never overwritten.
 */
async function refreshRollups(keys, { user, session = null } = {}) {
  const results = [];
  for (const key of keys) {
    const [biz, y, m] = key.split(":");
    const year = Number(y);
    const month = Number(m);
    const start = P.monthStart(year, month);
    const end = P.monthEnd(year, month);
    // eslint-disable-next-line no-await-in-loop
    const entries = await SalesEntry.find({ business: biz, startKey: { $lte: end }, endKey: { $gte: start } }).session(session).lean();
    // eslint-disable-next-line no-await-in-loop
    // the month's summary record (never a dated daily/transaction SalesRecord)
    const existing = await SalesRecord.findOne({ business: biz, year, month, recordType: { $ne: "transaction" }, $or: [{ date: null }, { date: { $exists: false } }] }).session(session);
    const items = applyPrecedence(toItems({ entries }));
    const { included } = select(items, { start, end });
    if (existing && existing.source !== "daily_rollup") {
      results.push({ key, action: "kept_monthly_summary" });
      continue;
    }
    if (!included.length) {
      if (existing) {
        // eslint-disable-next-line no-await-in-loop
        await SalesRecord.deleteOne({ _id: existing._id }).session(session);
        results.push({ key, action: "removed" });
      }
      continue;
    }
    const agg = aggregate(included, { targetFor: () => null });
    const basis = new Set(included.map((i) => i.salesBasis));
    const days = new Set(included.filter((i) => i.kind !== "period").map((i) => i.start)).size;
    const any = included[0];
    const fields = {
      business: biz,
      client: (entries.find((e) => e.client) || {}).client || null,
      businessName: any.businessName,
      state: (entries[0] && entries[0].state) || "",
      city: any.city || (entries[0] && entries[0].city) || "",
      month,
      year,
      monthName: `${ist.MONTH_NAMES[month - 1]} ${year}`,
      totalSales: agg.recordedSales.value || 0,
      salesBasis: basis.size === 1 ? [...basis][0] : "gross",
      orders: included.reduce((s, i) => s + (isNum(i.orders) ? i.orders : 0), 0),
      discount: basis.size === 1 && agg.discount.status === "complete" ? agg.discount.value : null,
      cost: agg.cost.status === "complete" ? agg.cost.value : null,
      expenses: agg.expenses.status === "complete" ? agg.expenses.value : null,
      reportedProfit: null,
      source: "daily_rollup",
      rollupDays: days,
      remarks: `Derived from daily data: ${days} of ${P.daysInMonth(year, month)} days recorded`,
      uploadedBy: user._id,
      uploaderName: user.name,
    };
    if (existing) {
      Object.assign(existing, fields);
      // eslint-disable-next-line no-await-in-loop
      await existing.save({ session });
      results.push({ key, action: "updated", days });
    } else {
      // eslint-disable-next-line no-await-in-loop
      await SalesRecord.create([{ ...fields, target: 0 }], session ? { session } : {});
      results.push({ key, action: "created", days });
    }
  }
  return results;
}

module.exports = { buildEntryDocs, existingEntryMap, coveredSpans, monthsOfSpans, refreshRollups };
