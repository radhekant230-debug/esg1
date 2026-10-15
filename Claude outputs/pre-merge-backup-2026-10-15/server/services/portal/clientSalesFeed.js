/**
 * Client Portal <- Manager imports.
 *
 * Manager uploads are saved as SalesRecord documents keyed by the business's
 * stable ID (SalesBusiness._id). A business belongs to a client portal account
 * through SalesBusiness.clientAccount (set by an admin). The Client Portal reads
 * those SAME SalesRecord documents through this module — nothing is copied, so
 * the manager and client dashboards can never disagree, and a re-upload that
 * replaces a month is visible to the client immediately.
 *
 * A client only ever sees records of businesses whose clientAccount is that
 * client: a Ranchi upload can never appear in a Dhanbad client's dashboard.
 */
const mongoose = require("mongoose");
const SalesBusiness = require("../../models/sales/SalesBusiness");
const SalesRecord = require("../../models/sales/SalesRecord");
const SalesImportJob = require("../../models/sales/SalesImportJob");
const ClientSalesRecord = require("../../models/portal/ClientSalesRecord");
const Notification = require("../../models/Notification");
const { aggregate, recordFinancials, growth } = require("../sales/financials");
const ist = require("../../utils/istDate");

const toId = (v) => (v instanceof mongoose.Types.ObjectId ? v : new mongoose.Types.ObjectId(String(v)));

async function clientBusinesses(clientId) {
  if (!clientId) return [];
  return SalesBusiness.find({ clientAccount: toId(clientId) })
    .select("name code city state category monthlyTarget")
    .sort({ city: 1, name: 1 })
    .lean();
}

/** Maps a SalesRecord to the shape the client portal tabs already render. */
function toPortalRecord(r, biz) {
  const f = recordFinancials(r);
  const target = r.target > 0 ? r.target : biz && biz.monthlyTarget > 0 ? biz.monthlyTarget : null;
  const isTxn = r.recordType === "transaction" || Boolean(r.date);
  return {
    _id: r._id,
    source: "manager_import",
    dataSource: r.source === "excel_upload" ? "Account manager upload" : "Account manager entry",
    verificationStatus: "Verified",
    recordType: r.recordType || (isTxn ? "transaction" : "summary"),
    periodType: r.periodType || (isTxn ? "daily" : "monthly"),
    transactionId: r.transactionId || null,
    date: r.date || ist.fromISTParts(r.year, r.month, 1),
    dateStr: r.dateStr || (r.date ? ist.istDayKey(r.date) : null),
    month: r.month,
    year: r.year,
    reportingMonth: r.monthName,
    business: biz ? { _id: biz._id, name: biz.name, city: biz.city, state: biz.state } : { _id: r.business },
    businessName: r.businessName,
    city: r.city,
    totalRevenue: r.totalSales,
    grossSales: f.gross,
    discounts: f.discount,
    netRevenue: f.net,
    costOfGoodsSold: f.cost,
    expenses: f.expenses,
    netProfit: f.netProfit,
    ordersCount: r.orders || 0,
    averageOrderValue: r.orders > 0 ? Math.round(r.totalSales / r.orders) : 0,
    target,
    achievementRate: target ? Number(((r.totalSales / target) * 100).toFixed(1)) : null,
    returnsAmount: 0,
    returnsCount: 0,
    adAttributedRevenue: 0,
    categoryBreakdown: [],
    topProducts: [],
    remarks: r.remarks || "",
    importJob: r.importJob || null,
    updatedAt: r.updatedAt,
  };
}

/**
 * Everything the client's Sales and Overview tabs need.
 * Manual portal entries (ClientSalesRecord) are kept, except for months that
 * already have manager-imported data (the import is authoritative there, so
 * the same month is never counted twice).
 */
async function buildClientSalesFeed(clientId) {
  const businesses = await clientBusinesses(clientId);
  const bizById = new Map(businesses.map((b) => [String(b._id), b]));
  const [imported, manual] = await Promise.all([
    businesses.length
      ? SalesRecord.find({ business: { $in: businesses.map((b) => b._id) } }).sort({ year: 1, month: 1 }).lean()
      : [],
    ClientSalesRecord.find({ client: toId(clientId) }).sort({ date: 1 }).lean(),
  ]);

  const importedRecords = imported.map((r) => toPortalRecord(r, bizById.get(String(r.business))));
  const importedPeriods = new Set(imported.map((r) => `${r.year}-${r.month}`));
  const keptManual = [];
  let supersededManual = 0;
  manual.forEach((m) => {
    const p = ist.toISTParts(m.date);
    if (p && importedPeriods.has(`${p.year}-${p.month}`)) supersededManual++;
    else keptManual.push({ ...m, source: m.source || "Manual Entry" });
  });

  const records = [...keptManual, ...importedRecords].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Monthly summary (imported data, all of the client's businesses)
  const byMonth = new Map();
  imported.forEach((r) => {
    const k = `${r.year}-${String(r.month).padStart(2, "0")}`;
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(r);
  });
  const targetFor = (r) => {
    if (r.target > 0) return r.target;
    const b = bizById.get(String(r.business));
    return b && b.monthlyTarget > 0 ? b.monthlyTarget : null;
  };
  const monthly = [...byMonth.keys()].sort().map((k) => {
    const list = byMonth.get(k);
    const [y, m] = k.split("-").map(Number);
    const a = aggregate(list, { targetFor });
    return {
      key: k,
      year: y,
      month: m,
      monthName: `${ist.MONTH_NAMES[m - 1]} ${y}`,
      label: `${ist.MONTH_NAMES[m - 1].slice(0, 3)} ${y}`,
      totalSales: a.recordedSales.value,
      orders: a.orders,
      target: a.target.value,
      achievement: a.target.achievement,
      discount: a.discount.value,
      netSales: a.net.value,
      netProfit: a.netProfit.value,
      businesses: list.length,
      lastUpdatedAt: list.reduce((mx, r) => (r.updatedAt > mx ? r.updatedAt : mx), list[0].updatedAt),
    };
  });
  monthly.forEach((row, i) => {
    row.growth = i ? growth(row.totalSales, monthly[i - 1].totalSales) : null;
  });

  const lastUpdatedAt = imported.reduce((mx, r) => (!mx || r.updatedAt > mx ? r.updatedAt : mx), null);
  return {
    businesses: businesses.map((b) => ({ _id: b._id, name: b.name, city: b.city, state: b.state, category: b.category })),
    records,
    importedRecords,
    monthly,
    supersededManual,
    lastUpdatedAt,
    lastUpdatedLabel: lastUpdatedAt ? ist.formatISTDateTime(lastUpdatedAt) : "",
  };
}

/**
 * Cheap change detector for auto-refresh: changes whenever a record of the
 * client's businesses (or a manual portal entry) is created, replaced or deleted.
 */
async function getClientSyncStamp(clientId) {
  const businesses = await SalesBusiness.find({ clientAccount: toId(clientId) }).select("_id updatedAt").lean();
  const [imp] = businesses.length
    ? await SalesRecord.aggregate([
        { $match: { business: { $in: businesses.map((b) => b._id) } } },
        { $group: { _id: null, n: { $sum: 1 }, last: { $max: "$updatedAt" } } },
      ])
    : [];
  const [man] = await ClientSalesRecord.aggregate([
    { $match: { client: toId(clientId) } },
    { $group: { _id: null, n: { $sum: 1 }, last: { $max: "$updatedAt" } } },
  ]);
  // Import pipeline changes (pending previews, rejected rows) also refresh the portal
  const lastJob = businesses.length
    ? await SalesImportJob.findOne({ $or: [{ businesses: { $in: businesses.map((b) => b._id) } }, { targetBusiness: { $in: businesses.map((b) => b._id) } }] })
        .sort({ updatedAt: -1 })
        .select("updatedAt")
        .lean()
    : null;
  const bizStamp = businesses.map((b) => `${b._id}`).sort().join(",");
  const lastUpdatedAt = [imp && imp.last, man && man.last].filter(Boolean).sort((a, b) => b - a)[0] || null;
  const raw = `${bizStamp}|${imp ? imp.n : 0}:${imp && imp.last ? new Date(imp.last).getTime() : 0}|${man ? man.n : 0}:${man && man.last ? new Date(man.last).getTime() : 0}|${lastJob ? new Date(lastJob.updatedAt).getTime() : 0}`;
  return {
    version: require("crypto").createHash("sha1").update(raw).digest("hex").slice(0, 16),
    lastUpdatedAt,
    lastUpdatedLabel: lastUpdatedAt ? ist.formatISTDateTime(lastUpdatedAt) : "",
    importedRecords: imp ? imp.n : 0,
  };
}

/** In-app notification for each client portal that received new/replaced data. */
async function notifyClientsOfNewSales({ importJobId, businessIds = [], periods = [], replaced = false }) {
  if (!businessIds.length) return [];
  const businesses = await SalesBusiness.find({ _id: { $in: businessIds.map(toId) }, clientAccount: { $ne: null } })
    .select("name city clientAccount")
    .lean();
  const byClient = new Map();
  businesses.forEach((b) => {
    const k = String(b.clientAccount);
    if (!byClient.has(k)) byClient.set(k, []);
    byClient.get(k).push(`${b.name} (${b.city})`);
  });
  const notified = [];
  for (const [clientId, names] of byClient) {
    try {
      await Notification.create({
        recipient: clientId,
        type: "update",
        title: replaced ? "Sales data updated" : "New sales data available",
        message: `Your account manager ${replaced ? "updated" : "published"} sales for ${periods.join(", ") || "the latest period"} — ${names.join(", ")}. Your dashboard has been refreshed.`,
        link: "/client/dashboard?tab=sales",
        dedupeKey: `sales-import:${importJobId}:${clientId}`,
      });
    } catch (err) {
      if (!(err && err.code === 11000)) throw err;
    }
    notified.push(clientId);
  }
  return notified;
}

module.exports = { clientBusinesses, toPortalRecord, buildClientSalesFeed, getClientSyncStamp, notifyClientsOfNewSales };
