/**
 * Customer Insights for Leads & Enquiries (one row per customer, not per enquiry).
 *
 * Identity: a customer is the same person across enquiries and sales when the
 * phone number matches (last 10 digits), else the email. Enquiries with neither
 * stay separate (never merged on name alone).
 *
 * Visits and spending come only from actual records, in this order:
 *   1. POS sales (BizSale) of the client's business: one visit = one distinct
 *      IST day with a completed sale; spending = sum of bill totals. Range-aware.
 *   2. Customer-list import (ClientLead.customerStats): the visit count, total
 *      spent and last visit reported by the POS customer export. These are
 *      lifetime totals (the export has no per-visit history), flagged as such.
 * Enquiry counts come from ClientLead and are always separate from visits.
 * Estimated enquiry values are never counted as spending.
 * Missing data stays null ("Data unavailable"); nothing is filled in.
 */
const ist = require("../../utils/istDate");

const DAY = 24 * 3600e3;

const phoneKey = (p) => {
  const d = String(p || "").replace(/\D/g, "");
  return d.length >= 7 ? d.slice(-10) : "";
};
const customerKey = ({ phone, email, id }) => {
  const p = phoneKey(phone);
  if (p) return `p:${p}`;
  const e = String(email || "").trim().toLowerCase();
  if (e) return `e:${e}`;
  return id ? `l:${id}` : "";
};
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const inRange = (d, r) => Boolean(d) && (!r || ((!r.from || d >= r.from) && (!r.to || d <= r.to)));

// Same key as customerKey(), computed inside MongoDB
const KEY_STAGES = [
  {
    $addFields: {
      _d: {
        $reduce: {
          input: { $regexFindAll: { input: { $ifNull: ["$phone", ""] }, regex: /\d/ } },
          initialValue: "",
          in: { $concat: ["$$value", "$$this.match"] },
        },
      },
    },
  },
  {
    $addFields: {
      _k: {
        $cond: [
          { $gte: [{ $strLenCP: "$_d" }, 7] },
          { $concat: ["p:", { $substrCP: ["$_d", { $max: [0, { $subtract: [{ $strLenCP: "$_d" }, 10] }] }, 10] }] },
          {
            $cond: [
              { $gt: [{ $trim: { input: { $ifNull: ["$email", ""] } } }, ""] },
              { $concat: ["e:", { $toLower: { $trim: { input: "$email" } } }] },
              { $concat: ["l:", { $toString: "$_id" }] },
            ],
          },
        ],
      },
    },
  },
];

/** Enquiries grouped per customer. */
async function leadGroups(ClientLead, match, range, keys = null) {
  const within = range
    ? { $and: [...(range.from ? [{ $gte: ["$enquiryDate", range.from] }] : []), ...(range.to ? [{ $lte: ["$enquiryDate", range.to] }] : [])] }
    : true;
  const rows = await ClientLead.aggregate(
    [
      { $match: match },
      ...KEY_STAGES,
      ...(keys ? [{ $match: { _k: { $in: keys } } }] : []),
      { $sort: { enquiryDate: -1, _id: -1 } },
      {
        $group: {
          _id: "$_k",
          leadId: { $first: "$_id" },
          name: { $first: "$name" },
          phone: { $first: "$phone" },
          email: { $first: "$email" },
          source: { $first: "$source" },
          campaign: { $first: "$campaign" },
          status: { $first: "$status" },
          statuses: { $addToSet: "$status" },
          enquiries: { $sum: 1 },
          enquiriesInRange: { $sum: { $cond: [within, 1, 0] } },
          converted: { $sum: { $cond: [{ $eq: ["$status", "Converted"] }, 1, 0] } },
          convertedInRange: { $sum: { $cond: [{ $and: [within, { $eq: ["$status", "Converted"] }] }, 1, 0] } },
          lost: { $sum: { $cond: [{ $eq: ["$status", "Lost"] }, 1, 0] } },
          maxEstimate: { $max: { $ifNull: ["$estimatedValue", 0] } },
          lastEnquiry: { $max: "$enquiryDate" },
          firstEnquiry: { $min: "$enquiryDate" },
          statsVisits: { $max: "$customerStats.visits" },
          statsSpent: { $max: "$customerStats.totalSpent" },
          statsAvg: { $max: "$customerStats.avgSpend" },
          statsLastVisit: { $max: "$customerStats.lastVisitAt" },
        },
      },
      { $limit: 100000 },
    ],
    { allowDiskUse: true }
  );
  return rows;
}

/** Completed POS sales grouped per customer (distinct IST days = visits). */
async function txnGroups({ Business, BizSale, BizCustomer }, clientObjectId, range) {
  const bizIds = (await Business.find({ owner: clientObjectId }).select("_id").lean()).map((b) => b._id);
  if (!bizIds.length) return { groups: [], hasSales: false, unidentified: 0 };
  const within = range
    ? { $and: [...(range.from ? [{ $gte: ["$saleDate", range.from] }] : []), ...(range.to ? [{ $lte: ["$saleDate", range.to] }] : [])] }
    : true;
  const day = { $dateToString: { format: "%Y-%m-%d", date: "$saleDate", timezone: "Asia/Kolkata" } };
  const rows = await BizSale.aggregate(
    [
      { $match: { business: { $in: bizIds }, status: { $in: ["completed", "partial"] } } },
      {
        $group: {
          _id: { c: "$customer", p: { $ifNull: ["$customerPhone", ""] } },
          name: { $first: "$customerName" },
          days: { $addToSet: day },
          daysInRange: { $addToSet: { $cond: [within, day, null] } },
          spent: { $sum: "$total" },
          spentInRange: { $sum: { $cond: [within, "$total", 0] } },
          bills: { $sum: 1 },
          billsInRange: { $sum: { $cond: [within, 1, 0] } },
          last: { $max: "$saleDate" },
        },
      },
    ],
    { allowDiskUse: true }
  );
  const ids = rows.map((r) => r._id.c).filter(Boolean);
  const custs = ids.length ? await BizCustomer.find({ _id: { $in: ids } }).select("name phone email").lean() : [];
  const byId = new Map(custs.map((c) => [String(c._id), c]));
  let unidentified = 0;
  const merged = new Map();
  rows.forEach((r) => {
    const c = r._id.c ? byId.get(String(r._id.c)) : null;
    const key = customerKey({ phone: r._id.p || (c && c.phone), email: c && c.email }) || (r._id.c ? `b:${r._id.c}` : "");
    if (!key) {
      unidentified += r.bills; // walk-in bills with no customer ID or phone
      return;
    }
    const m = merged.get(key) || { key, name: "", phone: "", email: "", days: new Set(), daysInRange: new Set(), spent: 0, spentInRange: 0, bills: 0, billsInRange: 0, last: null };
    m.name = m.name || (c && c.name) || r.name || "";
    m.phone = m.phone || r._id.p || (c && c.phone) || "";
    m.email = m.email || (c && c.email) || "";
    r.days.forEach((d) => m.days.add(d));
    r.daysInRange.filter(Boolean).forEach((d) => m.daysInRange.add(d));
    m.spent += r.spent;
    m.spentInRange += r.spentInRange;
    m.bills += r.bills;
    m.billsInRange += r.billsInRange || 0;
    if (!m.last || r.last > m.last) m.last = r.last;
    merged.set(key, m);
  });
  return { groups: [...merged.values()], hasSales: true, unidentified };
}

/** Pure: merges enquiry groups and sales groups into customer rows. */
function mergeCustomers(leads, txns, range) {
  const out = new Map();
  leads.forEach((g) => {
    out.set(g._id, {
      key: g._id,
      leadId: g.leadId ? String(g.leadId) : null,
      name: g.name,
      phone: g.phone || "",
      email: g.email || "",
      source: g.source,
      status: g.status,
      // RFM segment from the customer list ("RFM: loyal" -> "loyal")
      segment: /^RFM:/i.test(g.campaign || "") ? String(g.campaign).replace(/^RFM:\s*/i, "").trim() : null,
      statuses: g.statuses || [],
      enquiries: range ? g.enquiriesInRange : g.enquiries,
      enquiriesAllTime: g.enquiries,
      converted: range ? g.convertedInRange : g.converted,
      lost: g.lost,
      maxEstimate: round2(g.maxEstimate),
      lastEnquiry: g.lastEnquiry || null,
      _stats: g.statsVisits != null || g.statsSpent != null || g.statsLastVisit != null ? { visits: g.statsVisits, spent: g.statsSpent, last: g.statsLastVisit, avg: g.statsAvg ?? null } : null,
    });
  });
  txns.forEach((t) => {
    let c = out.get(t.key);
    if (!c) {
      c = { key: t.key, leadId: null, name: t.name || "Customer", phone: t.phone, email: t.email, source: null, status: null, segment: null, statuses: [], enquiries: 0, enquiriesAllTime: 0, converted: 0, lost: 0, maxEstimate: 0, lastEnquiry: null, _stats: null };
      out.set(t.key, c);
    }
    c._txn = t;
  });

  const rows = [];
  out.forEach((c) => {
    let visits = null;
    let lifetimeVisits = null;
    let spent = null;
    let lastVisit = null;
    let dataSource = null;
    let scope = null;
    let avgSpend = null;
    if (c._txn) {
      lifetimeVisits = c._txn.days.size;
      visits = range ? c._txn.daysInRange.size : lifetimeVisits;
      spent = round2(range ? c._txn.spentInRange : c._txn.spent);
      lastVisit = c._txn.last;
      const bills = range ? c._txn.billsInRange : c._txn.bills;
      avgSpend = bills ? round2(spent / bills) : null; // per bill
      dataSource = "POS sales";
      scope = range ? "range" : "all";
    } else if (c._stats) {
      visits = c._stats.visits != null ? Number(c._stats.visits) : null;
      lifetimeVisits = visits;
      spent = c._stats.spent != null ? round2(c._stats.spent) : null;
      lastVisit = c._stats.last || null;
      avgSpend = c._stats.avg != null ? round2(c._stats.avg) : null; // avg_spend as exported
      dataSource = "Customer list";
      scope = "lifetime";
    }
    const visitedInRange = c._txn ? (range ? c._txn.daysInRange.size > 0 : true) : inRange(lastVisit, range);
    const active = !range || c.enquiries > 0 || visitedInRange;
    if (!active) return;
    const lastActivity = [lastVisit, c.lastEnquiry].filter(Boolean).map((d) => new Date(d)).sort((a, b) => b - a)[0] || null;
    const { _txn, _stats, ...rest } = c;
    rows.push({
      ...rest,
      visits,
      lifetimeVisits,
      spent,
      avgSpend,
      // actual spending of customers with at least one converted enquiry (never the estimate)
      convertedValue: c.converted > 0 && spent != null ? spent : null,
      lastVisit,
      lastActivity,
      type: lifetimeVisits == null || lifetimeVisits === 0 ? null : lifetimeVisits > 1 ? "Returning" : "New",
      dataSource,
      scope,
    });
  });
  return rows;
}

const INSIGHTS = {
  topSpending: { sort: "spend_desc", keep: (c) => c.spent > 0 },
  frequentVisitors: { sort: "visits_desc", keep: (c) => c.visits > 0 },
  frequentEnquirers: { sort: "enquiries_desc", keep: (c) => c.enquiries > 0 },
  highestValue: { sort: "value_desc", keep: (c) => c.spent > 0 },
  recentVisitors: { sort: "recent_visit", keep: (c) => Boolean(c.lastVisit) },
  inactive: { sort: "inactive", keep: () => true },
  newVsReturning: { sort: "type", keep: (c) => Boolean(c.type) },
  topConverted: { sort: "converted_desc", keep: (c) => c.converted > 0 },
  lostLeads: { sort: "lost_desc", keep: (c) => c.lost > 0 },
  highValueLeads: { sort: "estimate_desc", keep: (c) => c.maxEstimate > 0 },
};
const VISIT_BANDS = { one: [1, 1], "2-5": [2, 5], "6-10": [6, 10], "10+": [11, Infinity] };

const desc = (f) => (a, b) => (b[f] ?? -Infinity) - (a[f] ?? -Infinity);
const time = (d) => (d ? new Date(d).getTime() : null);
const SORTERS = {
  spend_desc: desc("spent"),
  visits_desc: (a, b) => desc("visits")(a, b) || desc("spent")(a, b),
  enquiries_desc: (a, b) => desc("enquiries")(a, b) || desc("converted")(a, b) || desc("spent")(a, b),
  value_desc: (a, b) => desc("spent")(a, b) || desc("lifetimeVisits")(a, b),
  recent_visit: (a, b) => (time(b.lastVisit) ?? -Infinity) - (time(a.lastVisit) ?? -Infinity),
  newest_lead: (a, b) => (time(b.lastEnquiry) ?? -Infinity) - (time(a.lastEnquiry) ?? -Infinity),
  inactive: (a, b) => (time(a.lastActivity) ?? -Infinity) - (time(b.lastActivity) ?? -Infinity),
  type: (a, b) => (a.type === b.type ? desc("lifetimeVisits")(a, b) : a.type === "Returning" ? -1 : 1),
  converted_desc: (a, b) => desc("converted")(a, b) || desc("spent")(a, b),
  lost_desc: (a, b) => desc("lost")(a, b) || (time(b.lastEnquiry) ?? 0) - (time(a.lastEnquiry) ?? 0),
  estimate_desc: desc("maxEstimate"),
  segment: (a, b) => (a.segment || "\uffff").localeCompare(b.segment || "\uffff") || desc("spent")(a, b),
};

/** Pure: applies customer filters, insight and sort. */
function filterCustomers(rows, q = {}, now = new Date()) {
  const insight = INSIGHTS[q.insight] || null;
  const num = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const min = num(q.spendMin);
  const max = num(q.spendMax);
  const band = VISIT_BANDS[q.visits];
  const term = String(q.customer || "").trim().toLowerCase();
  const digits = term.replace(/\D/g, "");
  const inactiveDays = Math.min(Math.max(parseInt(q.inactiveDays, 10) || 60, 1), 3650);
  const cutoff = now.getTime() - inactiveDays * DAY;
  let list = rows.filter((c) => {
    if (insight && !insight.keep(c)) return false;
    if (q.insight === "inactive" && !(time(c.lastActivity) != null && time(c.lastActivity) < cutoff)) return false;
    if (term) {
      const hit = String(c.name || "").toLowerCase().includes(term) || String(c.email || "").toLowerCase().includes(term) || (digits.length >= 3 && String(c.phone || "").replace(/\D/g, "").includes(digits));
      if (!hit) return false;
    }
    if (q.status && !c.statuses.includes(q.status)) return false;
    if (q.source && c.source !== q.source) return false;
    if (q.segment && String(c.segment || "").toLowerCase() !== String(q.segment).toLowerCase()) return false;
    if (q.type === "new" && c.type !== "New") return false;
    if (q.type === "returning" && c.type !== "Returning") return false;
    if (band && !(c.visits != null && c.visits >= band[0] && c.visits <= band[1])) return false;
    if (q.visits === "most" && !(c.visits > 0)) return false;
    if (min != null && !(c.spent != null && c.spent >= min)) return false;
    if (max != null && !(c.spent != null && c.spent <= max)) return false;
    return true;
  });
  const sortKey = q.visits === "most" && !q.sort ? "visits_desc" : q.sort && SORTERS[q.sort] ? q.sort : insight ? insight.sort : "newest_lead";
  list = list.sort((a, b) => SORTERS[sortKey](a, b) || String(a.name).localeCompare(String(b.name)));
  return { list, sortKey, inactiveDays };
}

/** Pure: summary cards over the filtered customers. */
function summarize(list) {
  const known = list.filter((c) => c.visits != null);
  const spenders = list.filter((c) => c.spent != null);
  const top = (arr, f) => arr.reduce((best, c) => (c[f] > (best ? best[f] : 0) ? c : best), null);
  const hs = top(spenders, "spent");
  const mf = top(known, "visits");
  const typed = list.filter((c) => c.type);
  const spentTotal = spenders.reduce((a, c) => a + c.spent, 0);
  return {
    uniqueCustomers: list.length,
    totalVisits: known.length ? known.reduce((a, c) => a + c.visits, 0) : null,
    totalEnquiries: list.reduce((a, c) => a + c.enquiries, 0),
    returningCustomers: typed.length ? typed.filter((c) => c.type === "Returning").length : null,
    newCustomers: typed.length ? typed.filter((c) => c.type === "New").length : null,
    highestSpender: hs ? { name: hs.name, spent: hs.spent } : null,
    mostFrequentVisitor: mf ? { name: mf.name, visits: mf.visits } : null,
    avgSpending: spenders.length ? round2(spentTotal / spenders.length) : null,
    convertedEnquiries: list.reduce((a, c) => a + c.converted, 0),
    coverage: { withVisitData: known.length, withSpendData: spenders.length, withoutData: list.length - list.filter((c) => c.visits != null || c.spent != null).length },
  };
}

const money = (s) => (s == null ? null : Number(String(s).replace(/[^\d.]/g, "")) || 0);

/** Visit/spend figures written in an import note (older imports). */
function parseImportNote(text) {
  const t = String(text || "");
  if (!t.startsWith("Imported from customer list:")) return null;
  const v = t.match(/(\d+)\s+visits?\b/);
  if (!v) return null;
  const spent = t.match(/total spent\s*₹?\s*([\d,]+(?:\.\d+)?)/i);
  const avg = t.match(/avg spend\s*₹?\s*([\d,]+(?:\.\d+)?)/i);
  return { visits: Number(v[1]), totalSpent: spent ? money(spent[1]) : null, avgSpend: avg ? money(avg[1]) : null };
}

/** { from, to } (UTC instants of IST day bounds) for a preset or custom range. */
function dateRange({ range, from, to }, now = new Date()) {
  const today = ist.startOfISTDay(now);
  const p = ist.toISTParts(now);
  const end = (d) => new Date(d.getTime() + DAY - 1);
  switch (range) {
    case "today":
      return { from: today, to: end(today) };
    case "yesterday":
      return { from: new Date(today - DAY), to: new Date(today.getTime() - 1) };
    case "last7":
      return { from: new Date(today - 6 * DAY), to: end(today) };
    case "last30":
      return { from: new Date(today - 29 * DAY), to: end(today) };
    case "thisMonth":
      return { from: ist.fromISTParts(p.year, p.month, 1), to: end(today) };
    case "lastMonth": {
      const y = p.month === 1 ? p.year - 1 : p.year;
      const m = p.month === 1 ? 12 : p.month - 1;
      return { from: ist.fromISTParts(y, m, 1), to: new Date(ist.fromISTParts(p.year, p.month, 1).getTime() - 1) };
    }
    case "custom": {
      const f = /^\d{4}-\d{2}-\d{2}$/.test(from || "") ? ist.fromISTParts(...from.split("-").map(Number)) : null;
      const t = /^\d{4}-\d{2}-\d{2}$/.test(to || "") ? end(ist.fromISTParts(...to.split("-").map(Number))) : null;
      if (f && t && t < f) return { from: t, to: f, swapped: true };
      return f || t ? { from: f, to: t } : null;
    }
    default:
      return null;
  }
}

/** Leaderboard metrics: value to rank by (null = metric not recorded for that customer). */
const RANK_BY = {
  spending: { label: "Highest Total Spending", value: (c) => c.spent, missing: "no recorded spending" },
  visits: { label: "Most Frequent Visitors", value: (c) => c.visits, missing: "no visit records" },
  enquiries: { label: "Most Enquiries", value: (c) => c.enquiries, missing: "no enquiries" },
  avg: { label: "Highest Average Spending", value: (c) => c.avgSpend, missing: "no average spend recorded" },
  recent: { label: "Most Recent Visitors", value: (c) => time(c.lastVisit), missing: "no last-visit date" },
  converted: { label: "Highest Value Converted Customers", value: (c) => c.convertedValue, missing: "no converted enquiry with recorded spending" },
};

/**
 * Pure: ranks customers by one metric. Customers without the metric are left
 * out (and counted), never ranked as zero. Ranks are sequential (#1, #2, ...)
 * after filtering; ties keep a stable order (higher spending, then name).
 */
function rankCustomers(rows, { rankBy = "spending", dir = "desc", top = null } = {}) {
  const metric = RANK_BY[rankBy] || RANK_BY.spending;
  const withValue = rows.filter((c) => {
    const v = metric.value(c);
    return v != null && !(rankBy === "enquiries" && v === 0);
  });
  const sign = dir === "asc" ? 1 : -1;
  withValue.sort((a, b) => sign * (metric.value(a) - metric.value(b)) || (b.spent ?? -1) - (a.spent ?? -1) || String(a.name).localeCompare(String(b.name)));
  const limited = top ? withValue.slice(0, top) : withValue;
  return {
    rankBy: RANK_BY[rankBy] ? rankBy : "spending",
    label: metric.label,
    list: limited.map((c, i) => ({ ...c, rank: i + 1 })),
    ranked: withValue.length,
    excluded: rows.length - withValue.length,
    excludedReason: metric.missing,
  };
}

/**
 * One customer base per client (and date range), shared by the KPI cards, the
 * leaderboard and the table for 60 s and by requests that arrive while it is
 * still being computed. Writes to a client's enquiries clear its entries.
 */
const CACHE_MS = 60 * 1000;
const baseCache = new Map();
function customerBase({ ClientLead, salesModels, clientObjectId, range }) {
  const key = `${clientObjectId}|${range && range.from ? range.from.getTime() : ""}|${range && range.to ? range.to.getTime() : ""}`;
  const hit = baseCache.get(key);
  if (hit && hit.until > Date.now()) return hit.promise;
  const promise = Promise.all([leadGroups(ClientLead, { client: clientObjectId }, range), txnGroups(salesModels, clientObjectId, range)]).then(([lg, tx]) => ({
    all: mergeCustomers(lg, tx.groups, range),
    posSales: tx.hasSales,
    unidentified: tx.unidentified,
  }));
  baseCache.set(key, { until: Date.now() + CACHE_MS, promise });
  promise.catch(() => baseCache.delete(key));
  while (baseCache.size > 200) baseCache.delete(baseCache.keys().next().value);
  return promise;
}
function invalidateCustomerBase(clientId) {
  const prefix = `${clientId}|`;
  [...baseCache.keys()].forEach((k) => k.startsWith(prefix) && baseCache.delete(k));
}

module.exports = { customerBase, invalidateCustomerBase, RANK_BY, rankCustomers, dateRange, parseImportNote, phoneKey, customerKey, leadGroups, txnGroups, mergeCustomers, filterCustomers, summarize, INSIGHTS, VISIT_BANDS };
