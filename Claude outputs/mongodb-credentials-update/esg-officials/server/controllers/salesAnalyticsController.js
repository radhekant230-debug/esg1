/**
 * Monthly Sales, Discount, Profit & Loss analytics + export.
 * Missing discounts / costs / expenses are reported as unavailable — never as 0.
 */
const xlsx = require("xlsx");
const mongoose = require("mongoose");
const SalesBusiness = require("../models/sales/SalesBusiness");
const SalesRecord = require("../models/sales/SalesRecord");
const SalesImportJob = require("../models/sales/SalesImportJob");
const User = require("../models/User");
const ClientSalesRecord = require("../models/portal/ClientSalesRecord");
const { getManagerAuthorizedBusinessQuery } = require("../services/salesAccess");
const { aggregate, growth, recordFinancials } = require("../services/sales/financials");
const ist = require("../utils/istDate");

const MONTH_SHORT = ist.MONTH_NAMES.map((m) => m.slice(0, 3));

function shiftMonth(year, month, delta) {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

const BIZ_FIELDS = "name code category state city monthlyTarget";

/** Manager/admin scope: the existing city/state/assignment rules. */
async function scopedBusinesses(req) {
  const authFilter = await getManagerAuthorizedBusinessQuery(req.user);
  const filter = { ...authFilter };
  const q = req.query;

  // Managers cannot widen their scope with query params: the auth filter is
  // combined with (not replaced by) the requested filters.
  const extra = {};
  if (q.state && q.state !== "All") extra.state = String(q.state).trim();
  if (q.city && q.city !== "All") extra.city = String(q.city).trim();
  if (q.category && q.category !== "All") extra.category = String(q.category).trim();
  if (q.businessId && mongoose.Types.ObjectId.isValid(q.businessId)) extra._id = new mongoose.Types.ObjectId(q.businessId);

  const finalFilter = Object.keys(extra).length ? { $and: [filter, extra] } : filter;
  const [businesses, available] = await Promise.all([
    SalesBusiness.find(finalFilter).select(BIZ_FIELDS).lean(),
    SalesBusiness.find(filter).select("name city state").sort({ city: 1, name: 1 }).lean(),
  ]);
  return { businesses, available };
}

/**
 * Client Portal scope: ONLY businesses linked to this client account
 * (SalesBusiness.clientAccount). The optional businessId filter can narrow but
 * never widen it — an id belonging to another client simply matches nothing.
 */
async function clientScopedBusinesses(clientId, query = {}) {
  const base = { clientAccount: new mongoose.Types.ObjectId(String(clientId)) };
  const filter = { ...base };
  if (query.businessId && mongoose.Types.ObjectId.isValid(query.businessId)) filter._id = new mongoose.Types.ObjectId(query.businessId);
  if (query.city && query.city !== "All") filter.city = String(query.city).trim();
  const [businesses, available] = await Promise.all([
    SalesBusiness.find(filter).select(BIZ_FIELDS).lean(),
    SalesBusiness.find(base).select("name city state").sort({ city: 1, name: 1 }).lean(),
  ]);
  return { businesses, available };
}

/**
 * Import jobs visible to a client: only files whose rows were ALL for this
 * client's businesses (or that targeted one of them). Files that also carried
 * other clients' rows are excluded from the counts so nothing about another
 * client (row counts, file names) leaks; their records still count above.
 */
async function clientJobs(bizIds, extraFilter, fields) {
  if (!bizIds.length) return [];
  const own = new Set(bizIds.map(String));
  const list = await SalesImportJob.find({
    $and: [extraFilter, { $or: [{ targetBusiness: { $in: bizIds } }, { businesses: { $in: bizIds } }] }],
  })
    .select(fields)
    .lean();
  return list.filter((j) => isExclusiveTo(j, own));
}

function isExclusiveTo(job, ownSet) {
  if (job.targetBusiness && ownSet.has(String(job.targetBusiness))) return true;
  const biz = (job.businesses || []).map(String);
  return biz.length > 0 && biz.every((id) => ownSet.has(id));
}

/** Recent imports for the client's businesses, limited to the client's own data. */
async function clientImportHistory(bizIds, limit = 15) {
  if (!bizIds.length) return [];
  const own = new Set(bizIds.map(String));
  const jobs = await SalesImportJob.find({ $or: [{ targetBusiness: { $in: bizIds } }, { businesses: { $in: bizIds } }] })
    .select("filename uploaderName status periods businesses targetBusiness createdAt committedAt totalRows successCount updatedCount skippedCount rejectedCount invalidCount validCount")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const counts = await SalesRecord.aggregate([
    { $match: { importJob: { $in: jobs.map((j) => j._id) }, business: { $in: bizIds } } },
    { $group: { _id: "$importJob", n: { $sum: 1 } } },
  ]);
  const byJob = new Map(counts.map((c) => [String(c._id), c.n]));
  return jobs.map((j) => {
    const exclusive = isExclusiveTo(j, own);
    const row = {
      _id: j._id,
      uploadedAt: j.createdAt,
      uploadedAtLabel: ist.formatISTDateTime(j.createdAt),
      uploaderName: j.uploaderName || "",
      status: j.status,
      reportingPeriods: j.periods || [],
      recordsForYou: byJob.get(String(j._id)) || 0,
      sharedFile: !exclusive,
    };
    if (exclusive) {
      Object.assign(row, {
        filename: j.filename,
        totalRows: j.totalRows || 0,
        imported: j.successCount || 0,
        replaced: j.updatedCount || 0,
        kept: j.skippedCount || 0,
        rejected: j.rejectedCount || (j.status === "pending" ? j.invalidCount || 0 : 0),
      });
    }
    return row;
  });
}

function targetResolver(bizById) {
  return (r) => {
    if (typeof r.target === "number" && r.target > 0) return r.target;
    const b = bizById.get(String(r.business));
    return b && b.monthlyTarget > 0 ? b.monthlyTarget : null;
  };
}

/**
 * scope = { businesses, available, audience: "manager" | "client", clientId }
 * Both portals use this same function, so every number is calculated the same way.
 */
async function buildAnalytics(req, scope) {
  const nowIst = ist.toISTParts(new Date());
  const year = parseInt(req.query.year, 10) || nowIst.year;
  const month = parseInt(req.query.month, 10) || nowIst.month;
  if (month < 1 || month > 12) throw Object.assign(new Error("Month must be 1-12."), { status: 400 });
  const monthsBack = Math.min(Math.max(parseInt(req.query.months, 10) || 12, 2), 36);

  if (!scope) scope = { ...(await scopedBusinesses(req)), audience: "manager" };
  const { businesses } = scope;
  const bizIds = businesses.map((b) => b._id);
  const bizById = new Map(businesses.map((b) => [String(b._id), b]));
  const targetFor = targetResolver(bizById);

  const first = shiftMonth(year, month, -(monthsBack - 1));
  const firstIdx = first.year * 12 + first.month;
  const lastIdx = year * 12 + month;
  const records = (
    await SalesRecord.find({ business: { $in: bizIds }, year: { $gte: first.year, $lte: year } }).lean()
  ).filter((r) => {
    const idx = r.year * 12 + r.month;
    return idx >= firstIdx && idx <= lastIdx;
  });

  const byPeriod = new Map();
  records.forEach((r) => {
    const k = `${r.year}-${r.month}`;
    if (!byPeriod.has(k)) byPeriod.set(k, []);
    byPeriod.get(k).push(r);
  });

  const trend = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const p = shiftMonth(year, month, -i);
    const list = byPeriod.get(`${p.year}-${p.month}`) || [];
    const agg = aggregate(list, { targetFor });
    trend.push({
      year: p.year,
      month: p.month,
      label: `${MONTH_SHORT[p.month - 1]} ${p.year}`,
      monthName: `${ist.MONTH_NAMES[p.month - 1]} ${p.year}`,
      ...agg,
    });
  }
  trend.forEach((t, i) => {
    const prev = trend[i - 1];
    t.growth = {
      recordedSales: prev ? growth(t.recordedSales.value, prev.recordedSales.value) : null,
      net: prev ? growth(t.net.value, prev.net.value) : null,
    };
  });

  const selected = trend[trend.length - 1];
  const selectedRecords = byPeriod.get(`${year}-${month}`) || [];

  const businessBreakdown = businesses
    .map((b) => {
      const recs = selectedRecords.filter((r) => String(r.business) === String(b._id));
      const prevP = shiftMonth(year, month, -1);
      const prevRecs = (byPeriod.get(`${prevP.year}-${prevP.month}`) || []).filter((r) => String(r.business) === String(b._id));
      const agg = aggregate(recs, { targetFor });
      const prevAgg = aggregate(prevRecs, { targetFor });
      return {
        _id: b._id,
        name: b.name,
        code: b.code,
        category: b.category,
        city: b.city,
        state: b.state,
        hasRecord: recs.length > 0,
        source: recs[0] ? recs[0].source : null,
        salesBasis: recs[0] ? recs[0].salesBasis || "gross" : null,
        ...agg,
        growth: growth(agg.recordedSales.value, prevAgg.recordedSales.value),
      };
    })
    .sort((a, b) => (b.recordedSales.value || 0) - (a.recordedSales.value || 0));

  // Business × month rows for the profitability table (whole trend range)
  const profitabilityRows = records
    .map((r) => {
      const b = bizById.get(String(r.business)) || {};
      const agg = aggregate([r], { targetFor });
      return {
        _id: r._id,
        year: r.year,
        month: r.month,
        monthName: `${ist.MONTH_NAMES[r.month - 1]} ${r.year}`,
        businessId: r.business,
        business: b.name || r.businessName,
        city: b.city || r.city,
        source: r.source,
        salesBasis: r.salesBasis || "gross",
        ...agg,
      };
    })
    .sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month) || String(a.business).localeCompare(String(b.business)));

  // Import pipeline for the selected REPORTING period (the month the data is
  // for), falling back to the upload date for older jobs without periods.
  const { start, end } = ist.istMonthRange(year, month);
  const monthLabel = `${ist.MONTH_NAMES[month - 1]} ${year}`;
  const periodMatch = { $or: [{ periods: monthLabel }, { "periods.0": { $exists: false }, createdAt: { $gte: start, $lte: end } }] };
  const JOB_FIELDS = "status validCount invalidCount rejectedCount successCount updatedCount skippedCount totalRows businesses targetBusiness periods";
  let jobs;
  if (scope.audience === "client") {
    jobs = await clientJobs(bizIds, periodMatch, JOB_FIELDS);
  } else {
    const jobFilter = { ...periodMatch };
    if (req.user.role !== "admin") jobFilter.uploadedBy = req.user._id;
    jobs = await SalesImportJob.find(jobFilter).select(JOB_FIELDS).lean();
  }
  const imports = {
    importedRecords: selectedRecords.filter((r) => r.source === "excel_upload").length,
    manualRecords: selectedRecords.filter((r) => r.source !== "excel_upload").length,
    pendingPreviews: jobs.filter((j) => j.status === "pending").length,
    pendingRows: jobs.filter((j) => j.status === "pending").reduce((s, j) => s + (j.validCount || 0), 0),
    invalidRows: jobs.reduce((s, j) => s + (j.rejectedCount || (j.status === "pending" ? j.invalidCount : 0) || 0), 0),
    skippedRows: jobs.reduce((s, j) => s + (j.skippedCount || 0), 0),
    importsCompleted: jobs.filter((j) => ["completed", "partial"].includes(j.status)).length,
    importsFailed: jobs.filter((j) => ["failed", "rejected"].includes(j.status)).length,
    businessesWithoutRecord: businesses.length - new Set(selectedRecords.map((r) => String(r.business))).size,
  };
  if (scope.audience === "client") {
    // Manual entries the agency added directly in the client portal (shown as a
    // count only: their blank cost/discount fields default to 0 in that older
    // collection, so they cannot be used for P&L without inventing values).
    imports.portalManualEntries = await ClientSalesRecord.countDocuments({
      client: new mongoose.Types.ObjectId(String(scope.clientId)),
      date: { $gte: start, $lte: end },
    });
    imports.importHistory = await clientImportHistory(bizIds);
  }

  // Latest month that has any record in scope (lets the UI jump to real data)
  const latestRec = bizIds.length
    ? await SalesRecord.findOne({ business: { $in: bizIds } }).sort({ year: -1, month: -1 }).select("year month").lean()
    : null;
  const latestDataPeriod = latestRec
    ? { year: latestRec.year, month: latestRec.month, label: `${ist.MONTH_NAMES[latestRec.month - 1]} ${latestRec.year}` }
    : null;

  return {
    period: { year, month, monthName: `${ist.MONTH_NAMES[month - 1]} ${year}`, monthsBack },
    latestDataPeriod,
    scope: {
      audience: scope.audience,
      businesses: businesses.length,
      available: (scope.available || []).map((b) => ({ _id: b._id, name: b.name, city: b.city, state: b.state })),
    },
    selected,
    trend,
    businessBreakdown,
    profitabilityRows,
    imports,
    definitions: {
      grossSales: "Sum of recorded sales before discounts (records marked Net count only when their discount is known).",
      discount: "Sum of recorded discount amounts. Blank discounts are not treated as zero.",
      netSales: "Gross − discount for Gross records; the recorded value for Net records (no double subtraction).",
      grossProfit: "Net sales − cost of goods/services (records with recorded cost only).",
      netProfit: "Gross profit − operating expenses (records with recorded expenses only).",
      profitMargin: "Net profit ÷ net sales × 100, when net sales > 0.",
      coverage: "'Partial' means only some records have the data; the value covers those records only.",
    },
  };
}

exports.getMonthlyAnalytics = async (req, res) => {
  try {
    if (req.user.role === "manager" && (req.query.city || req.query.state)) {
      // Same explicit denial behaviour as the existing dashboard
      const userDoc = await User.findById(req.user._id);
      const cities = [userDoc.assignedCity, ...(userDoc.assignedCities || [])].filter(Boolean).map((c) => c.toLowerCase().trim());
      if (req.query.city && req.query.city !== "All" && cities.length && !cities.includes(String(req.query.city).toLowerCase().trim())) {
        return res.status(403).json({ message: `Access denied. You are not authorized to access sales data for "${req.query.city}".` });
      }
    }
    return res.json(await buildAnalytics(req));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("Monthly analytics error:", err);
    return res.status(500).json({ message: "Failed to load monthly analytics." });
  }
};

const show = (m, { pct = false } = {}) => {
  if (!m || m.status === "no_records") return "No records";
  if (m.value === null || m.value === undefined) return "Data unavailable";
  const v = pct ? `${m.value}%` : m.value;
  return m.status === "partial" ? `${v} (partial: ${m.covered}/${m.total} records)` : v;
};

async function sendExport(req, res, scope) {
  {
    const data = await buildAnalytics(req, scope);
    const format = req.query.format === "csv" ? "csv" : "xlsx";

    const summaryRows = data.trend.map((t) => ({
      Month: t.monthName,
      "Records": t.recordCount,
      "Orders": t.orders,
      "Total Sales (recorded)": show(t.recordedSales),
      "Gross Sales": show(t.gross),
      "Discounts": show(t.discount),
      "Net Sales": show(t.net),
      "Cost of Goods/Services": show(t.cost),
      "Gross Profit": show(t.grossProfit),
      "Operating Expenses": show(t.expenses),
      "Net Profit / Loss": show(t.netProfit),
      "Profit Margin %": show(t.profitMargin, { pct: true }),
      "Target": t.target.value === null ? "Not configured" : t.target.value,
      "Achievement %": t.target.achievement === null ? "Not configured" : t.target.achievement,
      "MoM Growth % (sales)": t.growth.recordedSales === null ? "n/a" : t.growth.recordedSales,
    }));

    const bizRows = data.businessBreakdown.map((b) => ({
      Business: b.name,
      City: b.city,
      State: b.state,
      Category: b.category,
      "Has Record": b.hasRecord ? "Yes" : "No",
      "Sales Basis": b.salesBasis || "",
      "Total Sales (recorded)": show(b.recordedSales),
      Discounts: show(b.discount),
      "Net Sales": show(b.net),
      Cost: show(b.cost),
      "Gross Profit": show(b.grossProfit),
      Expenses: show(b.expenses),
      "Net Profit / Loss": show(b.netProfit),
      "Margin %": show(b.profitMargin, { pct: true }),
      Target: b.target.value === null ? "Not configured" : b.target.value,
      "Achievement %": b.target.achievement === null ? "Not configured" : b.target.achievement,
      "MoM Growth %": b.growth === null ? "n/a" : b.growth,
    }));

    const fileBase = `ESG_Monthly_Report_${data.period.year}-${String(data.period.month).padStart(2, "0")}`;
    if (format === "csv") {
      const toCsv = (rows) => {
        if (!rows.length) return "";
        const cols = Object.keys(rows[0]);
        const esc = (v) => {
          const s = String(v == null ? "" : v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\r\n");
      };
      const profCsvRows = data.profitabilityRows.map((r) => ({
        "Reporting Month": r.monthName,
        Business: r.business,
        City: r.city,
        "Total Sales (recorded)": show(r.recordedSales),
        Discounts: show(r.discount),
        "Net Sales": show(r.net),
        Cost: show(r.cost),
        Expenses: show(r.expenses),
        "Net Profit / Loss": show(r.netProfit),
        "Margin %": show(r.profitMargin, { pct: true }),
        "Achievement %": r.target.achievement === null ? "Not configured" : r.target.achievement,
      }));
      const csv = `﻿Monthly summary (${data.trend[0].monthName} – ${data.period.monthName})\r\n${toCsv(summaryRows)}\r\n\r\nBusiness breakdown – ${data.period.monthName}\r\n${toCsv(bizRows)}\r\n${profCsvRows.length ? `\r\nBusiness x month\r\n${toCsv(profCsvRows)}\r\n` : ""}`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.csv"`);
      return res.send(Buffer.from(csv, "utf8"));
    }

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(summaryRows), "Monthly Summary");
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(bizRows.length ? bizRows : [{ Business: "No businesses in scope" }]), "Business Breakdown");
    const profRows = data.profitabilityRows.map((r) => ({
      "Reporting Month": r.monthName,
      Business: r.business,
      City: r.city,
      "Total Sales (recorded)": show(r.recordedSales),
      Discounts: show(r.discount),
      "Net Sales": show(r.net),
      Cost: show(r.cost),
      Expenses: show(r.expenses),
      "Net Profit / Loss": show(r.netProfit),
      "Margin %": show(r.profitMargin, { pct: true }),
      "Achievement %": r.target.achievement === null ? "Not configured" : r.target.achievement,
    }));
    if (profRows.length) xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(profRows), "Business x Month");
    const defs = Object.entries(data.definitions).map(([k, v]) => ({ Metric: k, Definition: v }));
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(defs), "Definitions");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.xlsx"`);
    return res.send(xlsx.write(wb, { type: "buffer", bookType: "xlsx" }));
  }
}

const exportError = (res, err) => {
  if (err.status) return res.status(err.status).json({ message: err.message });
  console.error("Monthly analytics export error:", err);
  return res.status(500).json({ message: "Failed to export monthly report." });
};

exports.exportMonthlyAnalytics = async (req, res) => {
  try {
    return await sendExport(req, res);
  } catch (err) {
    return exportError(res, err);
  }
};

// ---------------- Client Portal (scoped to req.targetClientId) ----------------

async function clientScope(req) {
  const clientId = req.targetClientId;
  if (!clientId) throw Object.assign(new Error("Client not found."), { status: 404 });
  return { ...(await clientScopedBusinesses(clientId, req.query)), audience: "client", clientId };
}

exports.getClientMonthlyAnalytics = async (req, res) => {
  try {
    const data = await buildAnalytics(req, await clientScope(req));
    res.setHeader("Cache-Control", "no-store");
    return res.json(data);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("Client monthly analytics error:", err);
    return res.status(500).json({ message: "Failed to load sales analytics." });
  }
};

exports.exportClientMonthlyAnalytics = async (req, res) => {
  try {
    return await sendExport(req, res, await clientScope(req));
  } catch (err) {
    return exportError(res, err);
  }
};

module.exports._internal = { buildAnalytics, shiftMonth, recordFinancials, isExclusiveTo, clientScopedBusinesses };
