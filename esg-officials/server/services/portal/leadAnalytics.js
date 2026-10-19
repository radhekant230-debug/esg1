/**
 * Manager Portal → Leads & Enquiries: advanced filters and analytics.
 *
 * Enquiry figures come from ClientLead (status, source, enquiryDate,
 * estimatedValue, campaign "RFM: <segment>" for imported customer lists).
 * Sales figures come only from recorded sales, never from enquiry estimates:
 *   - product / category / customer level: BizSale line items (completed sales),
 *     otherwise the product summaries on ClientSalesRecord (topProducts,
 *     categoryBreakdown);
 *   - revenue / transactions: BizSale, else POS imports (SalesEntry of the
 *     client's linked SalesBusiness), else ClientSalesRecord.
 * When no product-level data exists the response says so (available: false);
 * nothing is invented.
 */
const ist = require("../../utils/istDate");

const DAY = 24 * 3600e3;
const OPEN = ["New", "Contacted", "Qualified"];
// Estimated value bands (₹)
const VALUE_BANDS = { low: [0, 5000], medium: [5000, 25000], high: [25000, null] };
const SORTS = {
  newest: { enquiryDate: -1, _id: -1 },
  oldest: { enquiryDate: 1, _id: 1 },
  sales_desc: { estimatedValue: -1, _id: -1 },
  sales_asc: { estimatedValue: 1, _id: 1 },
  revenue_desc: { isConverted: -1, estimatedValue: -1, _id: -1 },
  revenue_asc: { isConverted: -1, estimatedValue: 1, _id: 1 },
};
const escapeRegex = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const num = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

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

/**
 * Mongo filter on ClientLead from query params (all optional, combined with AND):
 *   status, source, segment, valueBand (low|medium|high|custom) + valueMin/valueMax,
 *   range (today|yesterday|last7|last30|thisMonth|lastMonth|custom) + from/to (YYYY-MM-DD), q
 */
function buildLeadFilter(clientObjectId, query = {}, { statuses = [], sources = [], now = new Date() } = {}) {
  const filter = { client: clientObjectId };
  if (query.status && statuses.includes(query.status)) filter.status = query.status;
  if (query.source && sources.includes(query.source)) filter.source = query.source;
  const segment = String(query.segment || "").trim().slice(0, 60);
  if (segment) filter.campaign = new RegExp(`^RFM:\\s*${escapeRegex(segment)}\\s*$`, "i");

  let [min, max] = [null, null];
  if (VALUE_BANDS[query.valueBand]) [min, max] = VALUE_BANDS[query.valueBand];
  else if (query.valueBand === "custom") [min, max] = [num(query.valueMin), num(query.valueMax)];
  if (min != null || max != null) {
    filter.estimatedValue = {};
    if (min != null) filter.estimatedValue.$gte = min;
    if (max != null) filter.estimatedValue[query.valueBand === "custom" ? "$lte" : "$lt"] = max;
  }

  const dr = dateRange(query, now);
  if (dr && (dr.from || dr.to)) {
    filter.enquiryDate = {};
    if (dr.from) filter.enquiryDate.$gte = dr.from;
    if (dr.to) filter.enquiryDate.$lte = dr.to;
  }

  const q = String(query.q || "").trim().slice(0, 80);
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: re }, { phone: re }, { email: re }, { campaign: re }];
  }
  return { filter, dateRange: dr };
}

const sortFor = (key) => SORTS[key] || SORTS.newest;

/** Enquiry KPIs, source/status breakdowns, trend and top enquiries — one aggregation. */
async function enquiryAnalytics(ClientLead, filter, dr) {
  const spanDays = dr && dr.from && dr.to ? (dr.to - dr.from) / DAY : Infinity;
  const fmt = spanDays <= 62 ? "%Y-%m-%d" : "%Y-%m";
  const paise = { $round: [{ $multiply: [{ $ifNull: ["$estimatedValue", 0] }, 100] }, 0] };
  const [r] = await ClientLead.aggregate([
    { $match: filter },
    {
      $facet: {
        status: [{ $group: { _id: "$status", n: { $sum: 1 }, paise: { $sum: paise } } }],
        source: [
          {
            $group: {
              _id: "$source",
              total: { $sum: 1 },
              converted: { $sum: { $cond: [{ $eq: ["$status", "Converted"] }, 1, 0] } },
              convertedPaise: { $sum: { $cond: [{ $eq: ["$status", "Converted"] }, paise, 0] } },
            },
          },
        ],
        trend: [
          {
            $group: {
              _id: { $dateToString: { format: fmt, date: "$enquiryDate", timezone: "Asia/Kolkata" } },
              enquiries: { $sum: 1 },
              converted: { $sum: { $cond: [{ $eq: ["$status", "Converted"] }, 1, 0] } },
              convertedPaise: { $sum: { $cond: [{ $eq: ["$status", "Converted"] }, paise, 0] } },
            },
          },
          { $sort: { _id: 1 } },
          { $limit: 400 },
        ],
        top: [{ $match: { estimatedValue: { $gt: 0 } } }, { $sort: { estimatedValue: -1, _id: 1 } }, { $limit: 10 }, { $project: { name: 1, phone: 1, status: 1, source: 1, estimatedValue: 1, enquiryDate: 1 } }],
        topConverted: [
          { $match: { status: "Converted", estimatedValue: { $gt: 0 } } },
          { $group: { _id: { $ifNull: [{ $cond: [{ $gt: ["$phone", ""] }, "$phone", null] }, { $ifNull: ["$email", "$name"] }] }, name: { $first: "$name" }, paise: { $sum: paise }, enquiries: { $sum: 1 } } },
          { $sort: { paise: -1 } },
          { $limit: 10 },
        ],
      },
    },
  ]);
  const by = Object.fromEntries((r.status || []).map((g) => [g._id, g]));
  const n = (s) => (by[s] ? by[s].n : 0);
  const v = (list) => round2(list.reduce((a, s) => a + (by[s] ? by[s].paise : 0), 0) / 100);
  const total = (r.status || []).reduce((a, g) => a + g.n, 0);
  const converted = n("Converted");
  const convertedValue = v(["Converted"]);
  const bySource = (r.source || [])
    .map((s) => ({ source: s._id || "Other", total: s.total, converted: s.converted, convertedValue: round2(s.convertedPaise / 100), conversionRate: s.total ? round2((s.converted / s.total) * 100) : 0 }))
    .sort((a, b) => b.converted - a.converted || b.convertedValue - a.convertedValue || b.total - a.total);
  const best = bySource.find((s) => s.converted > 0) || null;
  return {
    kpis: {
      totalEnquiries: total,
      converted,
      convertedValue,
      pipelineValue: v(OPEN),
      lostValue: v(["Lost"]),
      conversionRate: total ? round2((converted / total) * 100) : 0,
      avgConvertedValue: converted ? round2(convertedValue / converted) : 0,
      bestSource: best ? { source: best.source, converted: best.converted, convertedValue: best.convertedValue } : null,
    },
    byStatus: ["New", "Contacted", "Qualified", "Converted", "Lost"].map((s) => ({ status: s, count: n(s), value: v([s]) })),
    bySource,
    trend: { granularity: fmt === "%Y-%m" ? "month" : "day", points: (r.trend || []).map((t) => ({ period: t._id, enquiries: t.enquiries, converted: t.converted, convertedValue: round2(t.convertedPaise / 100) })) },
    topEnquiries: r.top || [],
    topConvertedCustomers: (r.topConverted || []).map((c) => ({ name: c.name, value: round2(c.paise / 100), enquiries: c.enquiries })),
  };
}

/**
 * Recorded sales for the client in the date range (and optional location).
 * models: { Business, BizSale, SalesBusiness, SalesEntry, ClientSalesRecord }
 */
async function salesAnalytics(models, clientObjectId, dr, { businessId = null } = {}) {
  const { Business, BizSale, SalesBusiness, SalesEntry, ClientSalesRecord } = models;
  const out = { available: false, productSource: null, revenueSource: null, products: [], categories: [], customers: [], totals: null, trend: [], locations: [] };

  // ---- 1. POS line items (BizSale) ----
  const bizIds = (await Business.find({ owner: clientObjectId }).select("_id").lean()).map((b) => b._id);
  if (bizIds.length) {
    const match = { business: { $in: bizIds }, status: { $in: ["completed", "partial"] } };
    if (dr && (dr.from || dr.to)) {
      match.saleDate = {};
      if (dr.from) match.saleDate.$gte = dr.from;
      if (dr.to) match.saleDate.$lte = dr.to;
    }
    const [r] = await BizSale.aggregate([
      { $match: match },
      {
        $facet: {
          totals: [{ $group: { _id: null, revenue: { $sum: "$total" }, sales: { $sum: 1 }, max: { $max: "$total" } } }],
          highest: [{ $sort: { total: -1 } }, { $limit: 1 }, { $project: { total: 1, invoiceNo: 1, customerName: 1, saleDate: 1 } }],
          products: [
            { $unwind: "$items" },
            { $group: { _id: { $ifNull: ["$items.product", "$items.productName"] }, name: { $first: "$items.productName" }, units: { $sum: "$items.quantity" }, revenue: { $sum: "$items.lineTotal" }, product: { $first: "$items.product" } } },
            { $lookup: { from: "bizproducts", localField: "product", foreignField: "_id", as: "p" } },
            { $lookup: { from: "bizcategories", localField: "p.0.category", foreignField: "_id", as: "c" } },
            { $project: { name: 1, units: 1, revenue: 1, category: { $ifNull: [{ $arrayElemAt: ["$c.name", 0] }, "Uncategorised"] } } },
            { $sort: { units: -1 } },
            { $limit: 200 },
          ],
          customers: [
            { $match: { $or: [{ customer: { $ne: null } }, { customerPhone: { $gt: "" } }, { customerName: { $gt: "" } }] } },
            { $group: { _id: { $ifNull: ["$customer", { $ifNull: ["$customerPhone", "$customerName"] }] }, name: { $first: "$customerName" }, total: { $sum: "$total" }, sales: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $limit: 10 },
          ],
          trend: [{ $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$saleDate", timezone: "Asia/Kolkata" } }, revenue: { $sum: "$total" }, sales: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $limit: 400 }],
        },
      },
    ]);
    const t = r && r.totals[0];
    if (t && t.sales) {
      const products = r.products.map((p) => ({ name: p.name || "Unnamed item", category: p.category, units: round2(p.units), revenue: round2(p.revenue) }));
      const units = products.reduce((a, p) => a + p.units, 0);
      const cats = new Map();
      products.forEach((p) => {
        const c = cats.get(p.category) || { category: p.category, units: 0, revenue: 0 };
        c.units += p.units;
        c.revenue += p.revenue;
        cats.set(p.category, c);
      });
      const h = r.highest[0];
      return {
        ...out,
        available: true,
        productSource: "POS sales line items",
        revenueSource: "POS sales",
        products,
        categories: [...cats.values()].map((c) => ({ ...c, units: round2(c.units), revenue: round2(c.revenue) })).sort((a, b) => b.revenue - a.revenue),
        customers: r.customers.map((c) => ({ name: c.name || "Customer", total: round2(c.total), sales: c.sales })),
        totals: { revenue: round2(t.revenue), transactions: t.sales, unitsSold: round2(units), avgSale: round2(t.revenue / t.sales), highestSale: h ? { amount: round2(h.total), invoice: h.invoiceNo || "", customer: h.customerName || "", date: h.saleDate } : null },
        trend: r.trend.map((x) => ({ period: x._id, revenue: round2(x.revenue), sales: x.sales })),
      };
    }
  }

  // ---- 2. Revenue from POS imports (SalesEntry), product summaries from ClientSalesRecord ----
  const locations = await SalesBusiness.find({ clientAccount: clientObjectId }).select("_id name city").lean();
  out.locations = locations.map((l) => ({ id: String(l._id), name: l.name, city: l.city || "" }));
  const locIds = locations.map((l) => l._id).filter((id) => !businessId || String(id) === String(businessId));
  const keyOf = (d) => (d ? ist.istDayKey(d) : null);
  if (locIds.length) {
    const m = { business: { $in: locIds } };
    if (dr && dr.from) m.startKey = { $gte: keyOf(dr.from) };
    if (dr && dr.to) m.endKey = { $lte: keyOf(dr.to) };
    const [e] = await SalesEntry.aggregate([
      { $match: m },
      {
        $facet: {
          totals: [{ $group: { _id: null, revenue: { $sum: "$totalSales" }, txns: { $sum: { $cond: [{ $eq: ["$kind", "txn"] }, 1, { $ifNull: ["$metrics.bills", { $ifNull: ["$orders", 0] }] }] } }, rows: { $sum: 1 } } }],
          highest: [{ $match: { kind: "txn" } }, { $sort: { totalSales: -1 } }, { $limit: 1 }, { $project: { totalSales: 1, transactionId: 1, startDate: 1 } }],
          trend: [{ $group: { _id: "$startKey", revenue: { $sum: "$totalSales" } } }, { $sort: { _id: 1 } }, { $limit: 400 }],
        },
      },
    ]);
    const t = e && e.totals[0];
    if (t && t.rows) {
      const h = e.highest[0];
      out.revenueSource = "POS sales imports";
      out.totals = { revenue: round2(t.revenue), transactions: t.txns || null, unitsSold: null, avgSale: t.txns ? round2(t.revenue / t.txns) : null, highestSale: h ? { amount: round2(h.totalSales), invoice: h.transactionId || "", customer: "", date: h.startDate } : null };
      out.trend = e.trend.map((x) => ({ period: x._id, revenue: round2(x.revenue) }));
    }
  }

  const csm = { client: clientObjectId, verificationStatus: { $nin: ["Estimated", "estimated"] } };
  if (dr && (dr.from || dr.to)) {
    csm.date = {};
    if (dr.from) csm.date.$gte = dr.from;
    if (dr.to) csm.date.$lte = dr.to;
  }
  const [c] = await ClientSalesRecord.aggregate([
    { $match: csm },
    {
      $facet: {
        totals: [{ $group: { _id: null, revenue: { $sum: "$totalRevenue" }, orders: { $sum: "$ordersCount" }, rows: { $sum: 1 } } }],
        products: [{ $unwind: "$topProducts" }, { $group: { _id: "$topProducts.name", category: { $first: "$topProducts.category" }, units: { $sum: "$topProducts.unitsSold" }, revenue: { $sum: "$topProducts.revenue" } } }, { $sort: { units: -1 } }, { $limit: 200 }],
        categories: [{ $unwind: "$categoryBreakdown" }, { $group: { _id: "$categoryBreakdown.category", units: { $sum: "$categoryBreakdown.itemsSold" }, revenue: { $sum: "$categoryBreakdown.amount" } } }, { $sort: { revenue: -1 } }],
        trend: [{ $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "Asia/Kolkata" } }, revenue: { $sum: "$totalRevenue" } } }, { $sort: { _id: 1 } }, { $limit: 400 }],
      },
    },
  ]);
  if (c && c.products.length) {
    out.productSource = "Recorded sales summaries (top products)";
    out.products = c.products.map((p) => ({ name: p._id, category: p.category || "General", units: round2(p.units), revenue: round2(p.revenue) }));
    out.categories = c.categories.map((x) => ({ category: x._id, units: round2(x.units), revenue: round2(x.revenue) }));
  }
  const ct = c && c.totals[0];
  if (!out.totals && ct && ct.rows) {
    out.revenueSource = "Recorded sales summaries";
    out.totals = { revenue: round2(ct.revenue), transactions: ct.orders || null, unitsSold: null, avgSale: ct.orders ? round2(ct.revenue / ct.orders) : null, highestSale: null };
    out.trend = c.trend.map((x) => ({ period: x._id, revenue: round2(x.revenue) }));
  }
  if (out.totals && out.products.length) out.totals.unitsSold = round2(out.products.reduce((a, p) => a + p.units, 0));
  out.available = out.products.length > 0;
  return out;
}

module.exports = { buildLeadFilter, dateRange, sortFor, enquiryAnalytics, salesAnalytics, VALUE_BANDS, SORTS };
