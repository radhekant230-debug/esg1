/**
 * Sales Analytics Controller (Manager Portal & Client Portal).
 *
 * Single source of truth for both dashboards:
 * - 11 Time Period Filters:
 *   today, last7days, last30days, thisWeek, prevWeek,
 *   thisMonth, prevMonth, thisQuarter, prevQuarter, thisYear, custom
 * - Supports daily, weekly, monthly, quarterly, yearly and custom-range analytics
 * - Aggregates transaction records by exact dates, and monthly summaries when transaction-level data is unavailable
 * - Computes all required metrics:
 *   Total Sales, Gross Sales, Orders, Discounts, Net Sales, Cost, Gross Profit,
 *   Expenses, Net Profit/Loss, Margin %, Target vs Actual %, Period-over-Period Growth %
 * - Missing values are reported as "Data unavailable" — never silently zeroed
 * - Manager Portal aggregates across authorized businesses; Client Portal is strictly isolated to the authenticated client's businesses
 */
const xlsx = require("xlsx");
const mongoose = require("mongoose");
const SalesBusiness = require("../models/sales/SalesBusiness");
const SalesRecord = require("../models/sales/SalesRecord");
const SalesImportJob = require("../models/sales/SalesImportJob");
const { computeRangeAnalytics } = require("../services/sales/rangeAnalytics");
const P = require("../services/sales/periods");
const SalesEntry = require("../models/sales/SalesEntry");
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
 * Client Portal scope: ONLY businesses linked to this client account (SalesBusiness.clientAccount).
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

async function clientImportHistory(bizIds, limit = 15) {
  if (!bizIds.length) return [];
  const own = new Set(bizIds.map(String));
  const jobs = await SalesImportJob.find({ $or: [{ targetBusiness: { $in: bizIds } }, { businesses: { $in: bizIds } }] })
    .select("filename uploaderName status periods reportPeriod reportFormat businesses targetBusiness createdAt committedAt totalRows successCount updatedCount skippedCount rejectedCount invalidCount validCount")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const counts = await SalesRecord.aggregate([
    { $match: { importJob: { $in: jobs.map((j) => j._id) }, business: { $in: bizIds } } },
    { $group: { _id: "$importJob", n: { $sum: 1 } } },
  ]);
  const entryCounts = await SalesEntry.aggregate([
    { $match: { importJob: { $in: jobs.map((j) => j._id) }, business: { $in: bizIds } } },
    { $group: { _id: "$importJob", n: { $sum: 1 } } },
  ]);
  const byJob = new Map(counts.map((c) => [String(c._id), c.n]));
  entryCounts.forEach((c) => byJob.set(String(c._id), (byJob.get(String(c._id)) || 0) + c.n));
  return jobs.map((j) => {
    const exclusive = isExclusiveTo(j, own);
    const row = {
      _id: j._id,
      uploadedAt: j.createdAt,
      uploadedAtLabel: ist.formatISTDateTime(j.createdAt),
      uploaderName: j.uploaderName || "",
      status: j.status,
      reportingPeriods: j.reportPeriod && j.reportPeriod.start ? [P.rangeLabel(j.reportPeriod.start, j.reportPeriod.end)] : j.periods || [],
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
 * Resolves dates, comparable previous period, and default granularity for all 11 date filters.
 */
function resolvePeriodDates(query = {}) {
  const now = new Date();
  const nowIst = ist.toISTParts(now);
  const rawFilter = query.filter || query.periodPreset || query.periodType || (query.startDate && query.endDate ? "custom" : null);

  const aliasMap = {
    today: "today",
    last_7_days: "last7days",
    last7days: "last7days",
    "last-7-days": "last7days",
    last_30_days: "last30days",
    last30days: "last30days",
    "last-30-days": "last30days",
    this_week: "thisWeek",
    thisweek: "thisWeek",
    thisWeek: "thisWeek",
    "this-week": "thisWeek",
    previous_week: "prevWeek",
    prev_week: "prevWeek",
    prevweek: "prevWeek",
    prevWeek: "prevWeek",
    "prev-week": "prevWeek",
    this_month: "thisMonth",
    thismonth: "thisMonth",
    thisMonth: "thisMonth",
    "this-month": "thisMonth",
    previous_month: "prevMonth",
    prev_month: "prevMonth",
    prevmonth: "prevMonth",
    prevMonth: "prevMonth",
    "prev-month": "prevMonth",
    this_quarter: "thisQuarter",
    thisquarter: "thisQuarter",
    thisQuarter: "thisQuarter",
    "this-quarter": "thisQuarter",
    previous_quarter: "prevQuarter",
    prev_quarter: "prevQuarter",
    prevquarter: "prevQuarter",
    prevQuarter: "prevQuarter",
    "prev-quarter": "prevQuarter",
    this_year: "thisYear",
    thisyear: "thisYear",
    thisYear: "thisYear",
    "this-year": "thisYear",
    custom: "custom",
  };

  let periodType = (rawFilter && aliasMap[rawFilter]) || rawFilter || "thisMonth";
  let startInstant;
  let endInstant;
  let prevStartInstant;
  let prevEndInstant;
  let periodLabel;
  let granularity = query.granularity || "auto";

  switch (periodType) {
    case "today": {
      startInstant = ist.startOfISTDay(now);
      endInstant = ist.endOfISTDay(now);
      const yesterday = new Date(startInstant.getTime() - 86400000);
      prevStartInstant = ist.startOfISTDay(yesterday);
      prevEndInstant = ist.endOfISTDay(yesterday);
      periodLabel = `Today (${ist.formatISTDate(startInstant)})`;
      if (granularity === "auto") granularity = "daily";
      break;
    }
    case "last7days": {
      endInstant = ist.endOfISTDay(now);
      startInstant = ist.startOfISTDay(new Date(now.getTime() - 6 * 86400000));
      prevEndInstant = new Date(startInstant.getTime() - 1);
      prevStartInstant = ist.startOfISTDay(new Date(prevEndInstant.getTime() - 6 * 86400000));
      periodLabel = `Last 7 Days (${ist.formatISTDate(startInstant)} – ${ist.formatISTDate(endInstant)})`;
      if (granularity === "auto") granularity = "daily";
      break;
    }
    case "last30days": {
      endInstant = ist.endOfISTDay(now);
      startInstant = ist.startOfISTDay(new Date(now.getTime() - 29 * 86400000));
      prevEndInstant = new Date(startInstant.getTime() - 1);
      prevStartInstant = ist.startOfISTDay(new Date(prevEndInstant.getTime() - 29 * 86400000));
      periodLabel = `Last 30 Days (${ist.formatISTDate(startInstant)} – ${ist.formatISTDate(endInstant)})`;
      if (granularity === "auto") granularity = "daily";
      break;
    }
    case "thisWeek": {
      const diff = nowIst.weekday === 0 ? -6 : 1 - nowIst.weekday;
      startInstant = ist.startOfISTDay(new Date(now.getTime() + diff * 86400000));
      endInstant = ist.endOfISTDay(new Date(startInstant.getTime() + 6 * 86400000));
      prevStartInstant = ist.startOfISTDay(new Date(startInstant.getTime() - 7 * 86400000));
      prevEndInstant = ist.endOfISTDay(new Date(startInstant.getTime() - 1));
      periodLabel = `This Week (${ist.formatISTDate(startInstant)} – ${ist.formatISTDate(endInstant)})`;
      if (granularity === "auto") granularity = "daily";
      break;
    }
    case "prevWeek": {
      const diff = nowIst.weekday === 0 ? -13 : -6 - nowIst.weekday;
      startInstant = ist.startOfISTDay(new Date(now.getTime() + diff * 86400000));
      endInstant = ist.endOfISTDay(new Date(startInstant.getTime() + 6 * 86400000));
      prevStartInstant = ist.startOfISTDay(new Date(startInstant.getTime() - 7 * 86400000));
      prevEndInstant = ist.endOfISTDay(new Date(startInstant.getTime() - 1));
      periodLabel = `Previous Week (${ist.formatISTDate(startInstant)} – ${ist.formatISTDate(endInstant)})`;
      if (granularity === "auto") granularity = "daily";
      break;
    }
    case "thisMonth": {
      const y = parseInt(query.year, 10) || nowIst.year;
      const m = parseInt(query.month, 10) || nowIst.month;
      const r = ist.istMonthRange(y, m);
      startInstant = r.start;
      endInstant = r.end;
      const prevM = shiftMonth(y, m, -1);
      const pr = ist.istMonthRange(prevM.year, prevM.month);
      prevStartInstant = pr.start;
      prevEndInstant = pr.end;
      periodLabel = `${ist.MONTH_NAMES[m - 1]} ${y}`;
      if (granularity === "auto") granularity = "monthly";
      break;
    }
    case "prevMonth": {
      const prevM = shiftMonth(nowIst.year, nowIst.month, -1);
      const r = ist.istMonthRange(prevM.year, prevM.month);
      startInstant = r.start;
      endInstant = r.end;
      const prevPrevM = shiftMonth(prevM.year, prevM.month, -1);
      const pr = ist.istMonthRange(prevPrevM.year, prevPrevM.month);
      prevStartInstant = pr.start;
      prevEndInstant = pr.end;
      periodLabel = `Previous Month (${ist.MONTH_NAMES[prevM.month - 1]} ${prevM.year})`;
      if (granularity === "auto") granularity = "monthly";
      break;
    }
    case "thisQuarter": {
      const qInfo = ist.quarterOf(now);
      const qRange = ist.quarterRange(qInfo.year, qInfo.quarter);
      startInstant = qRange.start;
      endInstant = qRange.end;
      const prevQ = qInfo.quarter === 1 ? 4 : qInfo.quarter - 1;
      const prevQYear = qInfo.quarter === 1 ? qInfo.year - 1 : qInfo.year;
      const prevQRange = ist.quarterRange(prevQYear, prevQ);
      prevStartInstant = prevQRange.start;
      prevEndInstant = prevQRange.end;
      periodLabel = `This Quarter (Q${qInfo.quarter} ${qInfo.year})`;
      if (granularity === "auto") granularity = "monthly";
      break;
    }
    case "prevQuarter": {
      const qInfo = ist.quarterOf(now);
      const targetQ = qInfo.quarter === 1 ? 4 : qInfo.quarter - 1;
      const targetYear = qInfo.quarter === 1 ? qInfo.year - 1 : qInfo.year;
      const qRange = ist.quarterRange(targetYear, targetQ);
      startInstant = qRange.start;
      endInstant = qRange.end;
      const prevQ = targetQ === 1 ? 4 : targetQ - 1;
      const prevQYear = targetQ === 1 ? targetYear - 1 : targetYear;
      const prevQRange = ist.quarterRange(prevQYear, prevQ);
      prevStartInstant = prevQRange.start;
      prevEndInstant = prevQRange.end;
      periodLabel = `Previous Quarter (Q${targetQ} ${targetYear})`;
      if (granularity === "auto") granularity = "monthly";
      break;
    }
    case "thisYear": {
      const y = parseInt(query.year, 10) || nowIst.year;
      startInstant = ist.fromISTParts(y, 1, 1);
      endInstant = new Date(ist.fromISTParts(y + 1, 1, 1).getTime() - 1);
      prevStartInstant = ist.fromISTParts(y - 1, 1, 1);
      prevEndInstant = new Date(ist.fromISTParts(y, 1, 1).getTime() - 1);
      periodLabel = `Year ${y}`;
      if (granularity === "auto") granularity = "monthly";
      break;
    }
    case "custom":
    default: {
      const s = query.startDate ? ist.parseISTDateTime(query.startDate) : null;
      const e = query.endDate ? ist.parseISTDateTime(query.endDate) : null;
      if (s && e) {
        startInstant = ist.startOfISTDay(s);
        endInstant = ist.endOfISTDay(e);
        const durationMs = endInstant.getTime() - startInstant.getTime();
        prevEndInstant = new Date(startInstant.getTime() - 1);
        prevStartInstant = new Date(prevEndInstant.getTime() - durationMs);
        const totalDays = Math.round(durationMs / 86400000) + 1;
        periodLabel = `Custom (${ist.formatISTDate(startInstant)} – ${ist.formatISTDate(endInstant)})`;
        periodType = "custom";
        if (granularity === "auto") granularity = totalDays <= 31 ? "daily" : totalDays <= 92 ? "weekly" : "monthly";
      } else {
        const y = parseInt(query.year, 10) || nowIst.year;
        const m = parseInt(query.month, 10) || nowIst.month;
        const r = ist.istMonthRange(y, m);
        startInstant = r.start;
        endInstant = r.end;
        const prevM = shiftMonth(y, m, -1);
        const pr = ist.istMonthRange(prevM.year, prevM.month);
        prevStartInstant = pr.start;
        prevEndInstant = pr.end;
        periodLabel = `${ist.MONTH_NAMES[m - 1]} ${y}`;
        periodType = "thisMonth";
        if (granularity === "auto") granularity = "monthly";
      }
      break;
    }
  }

  return {
    filter: periodType,
    periodLabel,
    startInstant,
    endInstant,
    prevStartInstant,
    prevEndInstant,
    startDateStr: ist.istDayKey(startInstant),
    endDateStr: ist.istDayKey(endInstant),
    granularity,
  };
}

/**
 * Filters records falling in [startInstant, endInstant].
 * Avoids double-counting: if a business has daily transactions in a month,
 * summary records for that month are superseded.
 */
function getRecordsForRange(records, startInstant, endInstant) {
  const startParts = ist.toISTParts(startInstant);
  const endParts = ist.toISTParts(endInstant);
  const startIdx = startParts.year * 12 + startParts.month;
  const endIdx = endParts.year * 12 + endParts.month;

  const txns = records.filter((r) => {
    if (!r.recordType || r.recordType === "transaction" || r.date) {
      if (r.date) {
        return r.date >= startInstant && r.date <= endInstant;
      }
    }
    return false;
  });

  const txnCoveredMonths = new Set(txns.map((r) => `${r.business}:${r.year}:${r.month}`));

  const summaries = records.filter((r) => {
    if (r.recordType === "transaction" || (r.date && !r.month)) return false;
    const idx = r.year * 12 + r.month;
    if (idx < startIdx || idx > endIdx) return false;
    if (txnCoveredMonths.has(`${r.business}:${r.year}:${r.month}`)) return false;
    return true;
  });

  return [...txns, ...summaries];
}

/**
 * Builds trend data buckets (daily, weekly, or monthly).
 */
function buildTrendBuckets(records, startInstant, endInstant, granularity, targetFor, isMonthQuery, monthsBack, year, month) {
  if (isMonthQuery) {
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
    return trend;
  }

  const buckets = [];
  const txns = records.filter((r) => r.recordType === "transaction" || r.date);
  const hasTxns = txns.length > 0;

  if (granularity === "daily" && hasTxns) {
    const startMs = startInstant.getTime();
    const endMs = endInstant.getTime();
    const totalDays = Math.min(Math.round((endMs - startMs) / 86400000) + 1, 93);
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startMs + i * 86400000);
      const dayKey = ist.istDayKey(d);
      const dayRecs = txns.filter((r) => ist.istDayKey(r.date) === dayKey);
      const agg = aggregate(dayRecs, { targetFor });
      const p = ist.toISTParts(d);
      buckets.push({
        key: dayKey,
        label: `${p.day} ${MONTH_SHORT[p.month - 1]}`,
        fullLabel: ist.formatISTDate(d),
        dateStr: dayKey,
        year: p.year,
        month: p.month,
        hasData: dayRecs.length > 0,
        ...agg,
      });
    }
  } else if (granularity === "weekly" && hasTxns) {
    const startMs = startInstant.getTime();
    const endMs = endInstant.getTime();
    const totalWeeks = Math.min(Math.ceil((endMs - startMs) / (7 * 86400000)), 52);
    for (let w = 0; w < totalWeeks; w++) {
      const wStart = new Date(startMs + w * 7 * 86400000);
      const wEnd = new Date(Math.min(startMs + (w + 1) * 7 * 86400000 - 1, endMs));
      const wRecs = txns.filter((r) => r.date >= wStart && r.date <= wEnd);
      const agg = aggregate(wRecs, { targetFor });
      buckets.push({
        key: `w${w + 1}`,
        label: `W${w + 1} (${ist.toISTParts(wStart).day} ${MONTH_SHORT[ist.toISTParts(wStart).month - 1]} – ${ist.toISTParts(wEnd).day} ${MONTH_SHORT[ist.toISTParts(wEnd).month - 1]})`,
        hasData: wRecs.length > 0,
        ...agg,
      });
    }
  } else {
    const startParts = ist.toISTParts(startInstant);
    const endParts = ist.toISTParts(endInstant);
    const startIdx = startParts.year * 12 + startParts.month;
    const endIdx = endParts.year * 12 + endParts.month;
    const monthCount = Math.max(endIdx - startIdx + 1, 1);

    for (let i = 0; i < monthCount; i++) {
      const idx = startIdx + i;
      const y = Math.floor((idx - 1) / 12);
      const m = ((idx - 1) % 12) + 1;
      const mRange = ist.istMonthRange(y, m);
      const mRecs = getRecordsForRange(records, mRange.start, mRange.end);
      const agg = aggregate(mRecs, { targetFor });
      buckets.push({
        key: `${y}-${m}`,
        label: `${MONTH_SHORT[m - 1]} ${y}`,
        monthName: `${ist.MONTH_NAMES[m - 1]} ${y}`,
        year: y,
        month: m,
        hasData: mRecs.length > 0,
        ...agg,
      });
    }
  }

  buckets.forEach((b, i) => {
    const prev = buckets[i - 1];
    b.growth = {
      recordedSales: prev && prev.recordedSales?.value ? growth(b.recordedSales?.value, prev.recordedSales?.value) : null,
      net: prev && prev.net?.value ? growth(b.net?.value, prev.net?.value) : null,
    };
  });

  return buckets;
}

/**
 * Builds analytics for either the Manager Portal or the Client Portal.
 * Both portals call this same method, ensuring identical calculation rules.
 */
async function buildAnalytics(req, scope) {
  const nowIst = ist.toISTParts(new Date());
  const isMonthQuery = !req.query.filter && (req.query.year || req.query.month);
  const year = parseInt(req.query.year, 10) || nowIst.year;
  const month = parseInt(req.query.month, 10) || nowIst.month;
  if (month < 1 || month > 12) throw Object.assign(new Error("Month must be 1-12."), { status: 400 });
  const monthsBack = Math.min(Math.max(parseInt(req.query.months, 10) || 12, 2), 36);

  const periodDates = resolvePeriodDates(req.query);

  if (!scope) scope = { ...(await scopedBusinesses(req)), audience: "manager" };
  const { businesses } = scope;
  const bizIds = businesses.map((b) => b._id);
  const bizById = new Map(businesses.map((b) => [String(b._id), b]));
  const targetFor = targetResolver(bizById);

  let rawRecords = [];
  if (bizIds.length) {
    if (isMonthQuery) {
      const first = shiftMonth(year, month, -(monthsBack - 1));
      rawRecords = await SalesRecord.find({
        business: { $in: bizIds },
        year: { $gte: first.year, $lte: year },
      }).lean();
    } else {
      rawRecords = await SalesRecord.find({ business: { $in: bizIds } }).lean();
    }
  }

  // Find date coverage across all available records for these businesses
  let minDate = null;
  let maxDate = null;
  rawRecords.forEach((r) => {
    let d = r.date ? new Date(r.date) : null;
    if (!d && r.year && r.month) {
      d = ist.fromISTParts(r.year, r.month, 1);
    }
    if (d && !Number.isNaN(d.getTime())) {
      if (!minDate || d < minDate) minDate = d;
      if (!maxDate || d > maxDate) maxDate = d;
    }
  });

  const availableDateRangeLabel = minDate && maxDate
    ? `${ist.formatISTDate(minDate)} – ${ist.formatISTDate(maxDate)}`
    : "No records found";

  // Selected period records
  const selectedRecords = isMonthQuery
    ? rawRecords.filter((r) => r.year === year && r.month === month)
    : getRecordsForRange(rawRecords, periodDates.startInstant, periodDates.endInstant);

  // Previous period records for growth comparison
  const prevPeriodRecords = isMonthQuery
    ? (() => {
        const prevP = shiftMonth(year, month, -1);
        return rawRecords.filter((r) => r.year === prevP.year && r.month === prevP.month);
      })()
    : getRecordsForRange(rawRecords, periodDates.prevStartInstant, periodDates.prevEndInstant);

  const selectedAgg = aggregate(selectedRecords, { targetFor });
  const prevAgg = aggregate(prevPeriodRecords, { targetFor });

  selectedAgg.growth = {
    recordedSales: growth(selectedAgg.recordedSales.value, prevAgg.recordedSales.value),
    net: growth(selectedAgg.net.value, prevAgg.net.value),
    orders: growth(selectedAgg.orders, prevAgg.orders),
    grossProfit: growth(selectedAgg.grossProfit.value, prevAgg.grossProfit.value),
    netProfit: growth(selectedAgg.netProfit.value, prevAgg.netProfit.value),
  };

  const trend = buildTrendBuckets(
    rawRecords,
    periodDates.startInstant,
    periodDates.endInstant,
    periodDates.granularity,
    targetFor,
    isMonthQuery,
    monthsBack,
    year,
    month
  );

  const businessBreakdown = businesses
    .map((b) => {
      const recs = selectedRecords.filter((r) => String(r.business) === String(b._id));
      const prevRecs = prevPeriodRecords.filter((r) => String(r.business) === String(b._id));
      const agg = aggregate(recs, { targetFor });
      const pAgg = aggregate(prevRecs, { targetFor });
      return {
        _id: b._id,
        name: b.name,
        code: b.code,
        category: b.category,
        city: b.city,
        state: b.state,
        hasRecord: recs.length > 0,
        recordCount: recs.length,
        source: recs[0] ? recs[0].source : null,
        salesBasis: recs[0] ? recs[0].salesBasis || "gross" : null,
        ...agg,
        growth: growth(agg.recordedSales.value, pAgg.recordedSales.value),
      };
    })
    .sort((a, b) => (b.recordedSales.value || 0) - (a.recordedSales.value || 0));

  // Business profitability rows
  const profitabilityRows = (isMonthQuery ? rawRecords : selectedRecords)
    .map((r) => {
      const b = bizById.get(String(r.business)) || {};
      const agg = aggregate([r], { targetFor });
      const f = recordFinancials(r);
      return {
        _id: r._id,
        year: r.year,
        month: r.month,
        monthName: r.monthName || `${ist.MONTH_NAMES[r.month - 1]} ${r.year}`,
        date: r.date || null,
        dateStr: r.dateStr || (r.date ? ist.istDayKey(r.date) : null),
        recordType: r.recordType || (r.date ? "transaction" : "summary"),
        periodType: r.periodType || (r.date ? "daily" : "monthly"),
        transactionId: r.transactionId || null,
        businessId: r.business,
        business: b.name || r.businessName,
        city: b.city || r.city,
        source: r.source,
        salesBasis: r.salesBasis || "gross",
        netSales: f.net,
        grossProfit: f.grossProfit,
        netProfit: f.netProfit,
        marginPct: f.net !== null && f.net > 0 && f.netProfit !== null ? Number(((f.netProfit / f.net) * 100).toFixed(2)) : null,
        ...agg,
      };
    })
    .sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : a.year * 12 + a.month;
      const dateB = b.date ? new Date(b.date).getTime() : b.year * 12 + b.month;
      return dateB - dateA || String(a.business).localeCompare(String(b.business));
    });

  // Sales Record History
  const salesHistory = selectedRecords
    .map((r) => {
      const b = bizById.get(String(r.business)) || {};
      const f = recordFinancials(r);
      const targetVal = targetFor(r);
      return {
        _id: r._id,
        date: r.date || (r.year && r.month ? ist.fromISTParts(r.year, r.month, 1) : null),
        dateStr: r.dateStr || (r.date ? ist.istDayKey(r.date) : r.monthName),
        transactionId: r.transactionId || null,
        recordType: r.recordType || (r.date ? "transaction" : "summary"),
        periodType: r.periodType || (r.date ? "daily" : "monthly"),
        businessId: r.business,
        businessName: b.name || r.businessName,
        city: b.city || r.city,
        state: b.state || r.state,
        totalSales: r.totalSales,
        salesBasis: r.salesBasis || "gross",
        orders: r.orders || 0,
        discount: f.discount,
        netSales: f.net,
        cost: f.cost,
        grossProfit: f.grossProfit,
        expenses: f.expenses,
        netProfit: f.netProfit,
        marginPct: f.net !== null && f.net > 0 && f.netProfit !== null ? Number(((f.netProfit / f.net) * 100).toFixed(2)) : null,
        target: targetVal,
        achievementPct: targetVal && targetVal > 0 && r.totalSales !== null ? Number(((r.totalSales / targetVal) * 100).toFixed(1)) : null,
        remarks: r.remarks || "",
        source: r.source,
        uploaderName: r.uploaderName || "",
        createdAt: r.createdAt,
      };
    })
    .sort((a, b) => {
      const tA = a.date ? new Date(a.date).getTime() : 0;
      const tB = b.date ? new Date(b.date).getTime() : 0;
      return tB - tA;
    });

  // Import pipeline tracking
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
    imports.portalManualEntries = await ClientSalesRecord.countDocuments({
      client: new mongoose.Types.ObjectId(String(scope.clientId)),
      date: { $gte: start, $lte: end },
    });
    imports.importHistory = await clientImportHistory(bizIds);
  }

  const latestRec = bizIds.length
    ? await SalesRecord.findOne({ business: { $in: bizIds } }).sort({ year: -1, month: -1 }).select("year month").lean()
    : null;
  const latestDataPeriod = latestRec
    ? { year: latestRec.year, month: latestRec.month, label: `${ist.MONTH_NAMES[latestRec.month - 1]} ${latestRec.year}` }
    : null;

  return {
    period: {
      filter: periodDates.filter,
      label: periodDates.periodLabel,
      startDate: periodDates.startDateStr,
      endDate: periodDates.endDateStr,
      granularity: periodDates.granularity,
      year,
      month,
      monthName: `${ist.MONTH_NAMES[month - 1]} ${year}`,
      monthsBack,
    },
    coverage: {
      selectedPeriod: periodDates.periodLabel,
      availableDataRange: availableDateRangeLabel,
      minDate: minDate ? ist.istDayKey(minDate) : null,
      maxDate: maxDate ? ist.istDayKey(maxDate) : null,
      totalRecords: rawRecords.length,
      hasRecords: rawRecords.length > 0,
    },
    latestDataPeriod,
    scope: {
      audience: scope.audience,
      businesses: businesses.length,
      available: (scope.available || []).map((b) => ({ _id: b._id, name: b.name, city: b.city, state: b.state })),
    },
    selected: selectedAgg,
    previous: prevAgg,
    trend,
    businessBreakdown,
    profitabilityRows,
    salesHistory,
    imports,
    isEmpty: selectedRecords.length === 0,
    emptyMessage: selectedRecords.length === 0
      ? `No sales data recorded for ${periodDates.periodLabel}.`
      : "",
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
  const data = await buildAnalytics(req, scope);
  const format = req.query.format === "csv" ? "csv" : "xlsx";

  const summaryRows = (data.trend || []).map((t) => ({
    Period: t.label || t.monthName,
    Records: t.recordCount,
    Orders: t.orders,
    "Total Sales (recorded)": show(t.recordedSales),
    "Gross Sales": show(t.gross),
    Discounts: show(t.discount),
    "Net Sales": show(t.net),
    "Cost of Goods/Services": show(t.cost),
    "Gross Profit": show(t.grossProfit),
    "Operating Expenses": show(t.expenses),
    "Net Profit / Loss": show(t.netProfit),
    "Profit Margin %": show(t.profitMargin, { pct: true }),
    Target: t.target?.value === null || t.target?.value === undefined ? "Not configured" : t.target.value,
    "Achievement %": t.target?.achievement === null || t.target?.achievement === undefined ? "Not configured" : t.target.achievement,
    "Period Growth %": t.growth?.recordedSales === null || t.growth?.recordedSales === undefined ? "n/a" : t.growth.recordedSales,
  }));

  const bizRows = (data.businessBreakdown || []).map((b) => ({
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
    Target: b.target?.value === null || b.target?.value === undefined ? "Not configured" : b.target.value,
    "Achievement %": b.target?.achievement === null || b.target?.achievement === undefined ? "Not configured" : b.target.achievement,
    "Period Growth %": b.growth === null || b.growth === undefined ? "n/a" : b.growth,
  }));

  const profRows = (data.profitabilityRows || []).map((r) => ({
    "Date / Month": r.dateStr || r.monthName,
    "Transaction ID": r.transactionId || "",
    Business: r.business,
    City: r.city,
    "Total Sales (recorded)": show(r.recordedSales),
    Discounts: show(r.discount),
    "Net Sales": show(r.net),
    Cost: show(r.cost),
    Expenses: show(r.expenses),
    "Net Profit / Loss": show(r.netProfit),
    "Margin %": show(r.profitMargin, { pct: true }),
    "Achievement %": r.target?.achievement === null || r.target?.achievement === undefined ? "Not configured" : r.target.achievement,
  }));

  const fileBase = `ESG_Sales_Report_${data.period.filter || (data.period.year + "-" + String(data.period.month).padStart(2, "0"))}`;
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

    const csv = `﻿Sales summary (${data.period.label})\r\n${toCsv(summaryRows)}\r\n\r\nBusiness breakdown – ${data.period.label}\r\n${toCsv(bizRows)}\r\n${profRows.length ? `\r\nBusiness x month records\r\n${toCsv(profRows)}\r\n` : ""}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.csv"`);
    return res.send(Buffer.from(csv, "utf8"));
  }

  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(summaryRows.length ? summaryRows : [{ Period: data.period.label, Records: 0 }]), "Summary");
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(bizRows.length ? bizRows : [{ Business: "No businesses in scope" }]), "Business Breakdown");
  if (profRows.length) xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(profRows), "Business x Month");
  const defs = Object.entries(data.definitions).map(([k, v]) => ({ Metric: k, Definition: v }));
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(defs), "Definitions");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.xlsx"`);
  return res.send(xlsx.write(wb, { type: "buffer", bookType: "xlsx" }));
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

// ===========================================================================
// Date-range analytics (daily / weekly / monthly / quarterly / yearly / custom)
// Same function for the Manager Portal and the Client Portal; only the
// business scope differs.
// ===========================================================================

async function buildRangeData(req, scope) {
  const range = P.resolveRange({ preset: req.query.preset, start: req.query.start, end: req.query.end });
  const prev = P.previousRange(range);
  const { businesses } = scope;
  const bizIds = businesses.map((b) => b._id);
  const windowStart = prev.start;
  const windowEnd = range.end;
  const ws = P.parts(windowStart);
  const we = P.parts(windowEnd);

  const [monthlyRecords, entries, availEntryMin, availEntryMax, availRecMin, availRecMax] = bizIds.length
    ? await Promise.all([
        SalesRecord.find({
          business: { $in: bizIds },
          source: { $ne: "daily_rollup" },
          $and: [
            { $or: [{ year: { $gt: ws.y } }, { year: ws.y, month: { $gte: ws.m } }] },
            { $or: [{ year: { $lt: we.y } }, { year: we.y, month: { $lte: we.m } }] },
          ],
        }).lean(),
        SalesEntry.find({ business: { $in: bizIds }, startKey: { $lte: windowEnd }, endKey: { $gte: windowStart } })
          .select("-reconciliation")
          .lean(),
        SalesEntry.findOne({ business: { $in: bizIds } }).sort({ startKey: 1 }).select("startKey").lean(),
        SalesEntry.findOne({ business: { $in: bizIds } }).sort({ endKey: -1 }).select("endKey").lean(),
        SalesRecord.findOne({ business: { $in: bizIds }, source: { $ne: "daily_rollup" } }).sort({ year: 1, month: 1 }).select("year month").lean(),
        SalesRecord.findOne({ business: { $in: bizIds }, source: { $ne: "daily_rollup" } }).sort({ year: -1, month: -1 }).select("year month").lean(),
      ])
    : [[], [], null, null, null, null];

  const firsts = [availEntryMin && availEntryMin.startKey, availRecMin && P.monthStart(availRecMin.year, availRecMin.month)].filter(Boolean).sort();
  const lasts = [availEntryMax && availEntryMax.endKey, availRecMax && P.monthEnd(availRecMax.year, availRecMax.month)].filter(Boolean).sort();
  const availableRange = firsts.length ? { start: firsts[0], end: lasts[lasts.length - 1], label: P.rangeLabel(firsts[0], lasts[lasts.length - 1]) } : null;

  const data = computeRangeAnalytics({
    businesses,
    monthlyRecords,
    entries,
    range,
    granularity: req.query.granularity || "auto",
    availableRange,
  });

  // Import pipeline for this reporting period
  const monthLabels = P.monthsBetween(range.start, range.end).map((m) => `${ist.MONTH_NAMES[m.m - 1]} ${m.y}`);
  const { start: cStart, end: cEnd } = { start: P.keyToDate(range.start), end: ist.endOfISTDay(P.keyToDate(range.end)) };
  const periodMatch = {
    $or: [
      { "reportPeriod.start": { $lte: range.end }, "reportPeriod.end": { $gte: range.start } },
      { "reportPeriod.start": null, periods: { $in: monthLabels } },
      { "reportPeriod.start": null, "periods.0": { $exists: false }, createdAt: { $gte: cStart, $lte: cEnd } },
    ],
  };
  const JOB_FIELDS = "status validCount invalidCount rejectedCount successCount updatedCount skippedCount totalRows businesses targetBusiness periods reportPeriod";
  let jobs;
  if (scope.audience === "client") jobs = await clientJobs(bizIds, periodMatch, JOB_FIELDS);
  else {
    const f = { ...periodMatch };
    if (req.user.role !== "admin") f.uploadedBy = req.user._id;
    jobs = await SalesImportJob.find(f).select(JOB_FIELDS).lean();
  }
  const included = data.history.filter((h) => h.status === "included");
  data.imports = {
    importedRecords: included.filter((h) => h.source === "excel_upload").length,
    manualRecords: included.filter((h) => h.source !== "excel_upload").length,
    pendingPreviews: jobs.filter((j) => j.status === "pending").length,
    pendingRows: jobs.filter((j) => j.status === "pending").reduce((s2, j) => s2 + (j.validCount || 0), 0),
    invalidRows: jobs.reduce((s2, j) => s2 + (j.rejectedCount || (j.status === "pending" ? j.invalidCount : 0) || 0), 0),
    skippedRows: jobs.reduce((s2, j) => s2 + (j.skippedCount || 0), 0),
    importsCompleted: jobs.filter((j) => ["completed", "partial"].includes(j.status)).length,
    importsFailed: jobs.filter((j) => ["failed", "rejected"].includes(j.status)).length,
    businessesWithoutRecord: data.businessBreakdown.filter((b) => !b.hasRecord).length,
  };
  if (scope.audience === "client") {
    data.imports.importHistory = await clientImportHistory(bizIds);
  }
  data.scope = {
    audience: scope.audience,
    businesses: businesses.length,
    available: (scope.available || []).map((b) => ({ _id: b._id, name: b.name, city: b.city, state: b.state })),
  };
  data.definitions = {
    recordedSales: "Sales as recorded: for restaurant day-wise reports this is \"My Amount\" (before discount).",
    netSales: "Gross − discount for gross records; the recorded value for net records (no double subtraction).",
    reportedTotalSales: "\"Total Sales\" exactly as the POS report states it (after discount, including tax and charges).",
    grossProfit: "Net sales − cost of goods/services — only when cost was recorded.",
    netProfit: "Gross profit − operating expenses — only when both were recorded. Not shown as profit otherwise.",
    target: "Monthly targets are compared only for whole calendar months.",
    growth: `Compared with ${data.period.previous.label}.`,
    inclusion: "A record is counted only when it lies completely inside the selected period; summaries are never split into days.",
  };
  return data;
}

const n2 = (m) => (m && m.value !== null && m.value !== undefined ? m.value : "");
const showRange = (m, pct = false) => {
  if (!m || m.status === "no_records") return "No records";
  if (m.value === null || m.value === undefined) return "Data unavailable";
  return m.status === "partial" ? `${pct ? `${m.value}%` : m.value} (partial: ${m.covered}/${m.total})` : pct ? `${m.value}%` : m.value;
};

async function sendRangeExport(req, res, scope) {
  const data = await buildRangeData(req, scope);
  const format = req.query.format === "csv" ? "csv" : "xlsx";
  const t = data.totals;
  const src = t.source;
  const summary = [
    ["Reporting period", data.period.label],
    ["Compared with", data.period.previous.label],
    ["Data in period", data.coverage.label || "No data"],
    ["Records", t.recordCount],
    ["Total sales (recorded)", showRange(t.recordedSales)],
    ["Gross sales", showRange(t.gross)],
    ["Discounts", showRange(t.discount)],
    ["Net sales", showRange(t.net)],
    ["Cost of goods/services", showRange(t.cost)],
    ["Gross profit", showRange(t.grossProfit)],
    ["Operating expenses", showRange(t.expenses)],
    ["Net profit / loss", showRange(t.netProfit)],
    ["Profit margin %", showRange(t.profitMargin, true)],
    ["Target", t.target.value === null ? "Not configured" : t.target.value],
    ["Target achievement %", t.target.achievement === null ? "Not configured" : t.target.achievement],
    ["Growth vs previous period %", t.growth.recordedSales === null ? `n/a (${t.growth.reason || "not comparable"})` : t.growth.recordedSales],
    ...(src
      ? [
          ["Report: Total Sales (incl. tax & charges)", n2(src.totalSales)],
          ["Report: Net Sales", n2(src.netSales)],
          ["Report: Total Tax", n2(src.tax)],
          ["Report: Service charge", n2(src.serviceCharge)],
          ["Report: Delivery charge", n2(src.deliveryCharge)],
          ["Report: Container charge", n2(src.containerCharge)],
          ["Report: Bills", n2(src.bills)],
          ["Report: Pax", n2(src.pax)],
          ...Object.entries(src.payments).map(([k, v]) => [`Payment: ${k}`, n2(v)]),
        ]
      : []),
  ].map(([Metric, Value]) => ({ Metric, Value }));
  const trend = data.trend.map((b) => ({
    Period: b.label,
    From: b.start,
    To: b.end,
    Records: b.records,
    "Total sales (recorded)": b.recordedSales ?? "",
    Discounts: b.discount ?? "",
    "Net sales": b.net ?? "",
    "Report Total Sales": b.reportedTotalSales ?? "",
    Tax: b.tax ?? "",
    Bills: b.bills ?? "",
    Pax: b.pax ?? "",
    "Net profit / loss": b.netProfit ?? "Data unavailable",
    Target: b.target ?? "",
  }));
  const biz = data.businessBreakdown.map((b) => ({
    Business: b.name,
    City: b.city,
    Records: b.records,
    "Total sales (recorded)": showRange(b.recordedSales),
    Discounts: showRange(b.discount),
    "Net sales": showRange(b.net),
    Cost: showRange(b.cost),
    Expenses: showRange(b.expenses),
    "Net profit / loss": showRange(b.netProfit),
    "Margin %": showRange(b.profitMargin, true),
    "Target %": b.target.achievement === null ? "Not configured" : b.target.achievement,
    "Growth %": b.growth === null ? "n/a" : b.growth,
  }));
  const history = data.history.map((h) => ({
    Status: h.status,
    Reason: h.reason || "",
    Business: h.business,
    From: h.start,
    To: h.end,
    Type: h.kind,
    "Total sales (recorded)": h.totalSales,
    Discount: h.discount ?? "",
    "Report Total Sales": h.reportedTotalSales ?? "",
    "Invoice Nos.": h.invoiceRange,
  }));
  const fileBase = `Sales_${data.period.start}_to_${data.period.end}`;
  if (format === "csv") {
    const toCsv = (rows) => {
      if (!rows.length) return "(none)";
      const cols = Object.keys(rows[0]);
      const esc = (v) => {
        const str = String(v == null ? "" : v);
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      };
      return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\r\n");
    };
    const csv = `\uFEFFSummary\r\n${toCsv(summary)}\r\n\r\nTrend (${data.granularity.used})\r\n${toCsv(trend)}\r\n\r\nBy business\r\n${toCsv(biz)}\r\n\r\nRecords\r\n${toCsv(history)}\r\n`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.csv"`);
    return res.send(Buffer.from(csv, "utf8"));
  }
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(summary), "Summary");
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(trend.length ? trend : [{ Period: "No data" }]), "Trend");
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(biz.length ? biz : [{ Business: "None" }]), "By business");
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(history.length ? history : [{ Status: "No records" }]), "Records");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.xlsx"`);
  return res.send(xlsx.write(wb, { type: "buffer", bookType: "xlsx" }));
}

const rangeError = (res, err, label) => {
  if (err.status) return res.status(err.status).json({ message: err.message });
  console.error(label, err);
  return res.status(500).json({ message: "Failed to load sales analytics." });
};

exports.getRangeAnalytics = async (req, res) => {
  try {
    const data = await buildRangeData(req, { ...(await scopedBusinesses(req)), audience: "manager" });
    res.setHeader("Cache-Control", "no-store");
    return res.json(data);
  } catch (err) {
    return rangeError(res, err, "Range analytics error:");
  }
};
exports.exportRangeAnalytics = async (req, res) => {
  try {
    return await sendRangeExport(req, res, { ...(await scopedBusinesses(req)), audience: "manager" });
  } catch (err) {
    return rangeError(res, err, "Range analytics export error:");
  }
};
exports.getClientRangeAnalytics = async (req, res) => {
  try {
    const data = await buildRangeData(req, await clientScope(req));
    res.setHeader("Cache-Control", "no-store");
    return res.json(data);
  } catch (err) {
    return rangeError(res, err, "Client range analytics error:");
  }
};
exports.exportClientRangeAnalytics = async (req, res) => {
  try {
    return await sendRangeExport(req, res, await clientScope(req));
  } catch (err) {
    return rangeError(res, err, "Client range analytics export error:");
  }
};

module.exports._internal = { buildAnalytics, shiftMonth, recordFinancials, isExclusiveTo, clientScopedBusinesses, resolvePeriodDates };
