/**
 * Client Portal monthly analytics: runs the real analytics controller against a
 * small in-memory stand-in for MongoDB (no database needed) and checks the
 * financial rules, manager/client parity and client data isolation.
 * The full HTTP + MongoDB version is scenario 16 in scripts/testPlanningSystem.js.
 */
const test = require("node:test");
const Module = require("module");
const path = require("path");
const assert = require("assert");
const SERVER = path.join(__dirname, "..", "..");
let n = 0;
class ObjectId { constructor(v) { this.v = v ? String(v) : `oid${++n}`.padStart(24, "0"); } toString() { return this.v; } toJSON() { return this.v; } equals(o) { return String(o) === this.v; } static isValid(v) { return typeof v === "string" ? v.length === 24 : v instanceof ObjectId; } }
const get = (doc, key) => key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), doc);
const eq = (a, b) => String(a) === String(b);
function matchVal(v, cond) {
  if (cond && typeof cond === "object" && !(cond instanceof ObjectId) && !(cond instanceof Date) && Object.keys(cond).some((k) => k.startsWith("$"))) {
    return Object.entries(cond).every(([op, c]) => {
      if (op === "$in") return Array.isArray(v) ? v.some((x) => c.some((y) => eq(x, y))) : c.some((y) => eq(v, y));
      if (op === "$gte") return v >= c; if (op === "$lte") return v <= c;
      if (op === "$ne") return c === null ? v != null : !eq(v, c);
      if (op === "$exists") return c ? v !== undefined : v === undefined;
      throw new Error("op " + op);
    });
  }
  if (Array.isArray(v)) return v.some((x) => eq(x, cond));
  if (cond === null) return v == null;
  return eq(v, cond);
}
function match(doc, f) {
  return Object.entries(f || {}).every(([k, c]) => {
    if (k === "$and") return c.every((x) => match(doc, x));
    if (k === "$or") return c.some((x) => match(doc, x));
    return matchVal(get(doc, k), c);
  });
}
function Q(rows) { const q = { rows, select: () => q, lean: () => q, populate: () => q, sort(s) { const [[k, d]] = Object.entries(s); const ks = Object.entries(s); rows.sort((a, b) => { for (const [k, d] of ks) { if (a[k] < b[k]) return -d; if (a[k] > b[k]) return d; } return 0; }); return q; }, limit(l) { rows.splice(l); return q; }, then(r, j) { return Promise.resolve(rows).then(r, j); } }; return q; }
function model(rows) {
  return {
    rows,
    find: (f) => Q(rows.filter((d) => match(d, f))),
    findOne: (f) => { const q = Q(rows.filter((d) => match(d, f))); const t = q.then; q.then = (r, j) => t.call(q, (x) => x[0] || null).then(r, j); return q; },
    countDocuments: async (f) => rows.filter((d) => match(d, f)).length,
    aggregate: async (pipe) => {
      let r = rows.filter((d) => match(d, pipe[0].$match));
      const g = pipe[1].$group; const by = new Map();
      r.forEach((d) => { const k = g._id === null ? "all" : String(d[g._id.slice(1)]); by.set(k, [...(by.get(k) || []), d]); });
      return [...by.entries()].map(([k, list]) => ({ _id: k === "all" ? null : list[0][g._id.slice(1)], n: list.length }));
    },
  };
}
const ist = require(path.join(SERVER, "utils/istDate"));
const clientA = new ObjectId(), clientD = new ObjectId(), mgr = new ObjectId();
const bizA = { _id: new ObjectId(), name: "Hotel Green Horizon", city: "Ranchi", state: "Jharkhand", category: "Hotel", monthlyTarget: 350000, clientAccount: clientA };
const bizA2 = { _id: new ObjectId(), name: "Green Horizon Cafe", city: "Ranchi", state: "Jharkhand", category: "Restaurant", monthlyTarget: 0, clientAccount: clientA };
const bizD = { _id: new ObjectId(), name: "Coal Capital Grand", city: "Dhanbad", state: "Jharkhand", category: "Hotel", monthlyTarget: 0, clientAccount: clientD };
const rec = (b, y, m, x) => ({ _id: new ObjectId(), business: b._id, businessName: b.name, city: b.city, year: y, month: m, monthName: `${ist.MONTH_NAMES[m - 1]} ${y}`, salesBasis: "gross", discount: null, cost: null, expenses: null, reportedProfit: null, target: 0, orders: 0, source: "excel_upload", updatedAt: new Date(), ...x });
const jobA = { _id: new ObjectId(), filename: "ranchi_oct.csv", status: "completed", periods: ["October 2025"], businesses: [bizA._id], targetBusiness: bizA._id, createdAt: new Date("2026-10-10"), totalRows: 1, successCount: 1, rejectedCount: 0 };
const jobMixed = { _id: new ObjectId(), filename: "ranchi_and_dhanbad.xlsx", status: "partial", periods: ["October 2025"], businesses: [bizA2._id, bizD._id], targetBusiness: null, createdAt: new Date("2026-10-11"), totalRows: 9, successCount: 2, rejectedCount: 7 };
const jobD = { _id: new ObjectId(), filename: "dhanbad_only.csv", status: "pending", periods: ["October 2025"], businesses: [bizD._id], createdAt: new Date("2026-10-12"), validCount: 3, invalidCount: 2 };
const records = [
  rec(bizA, 2025, 9, { totalSales: 160000, orders: 80 }),
  rec(bizA, 2025, 10, { totalSales: 200000, orders: 90, discount: 20000, cost: 90000, expenses: 50000, target: 250000, importJob: jobA._id }),
  rec(bizA2, 2025, 10, { totalSales: 50000, orders: 30, importJob: jobMixed._id, source: "excel_upload" }),
  rec(bizD, 2025, 10, { totalSales: 99000, orders: 40, discount: 1000, cost: 1, expenses: 1, importJob: jobMixed._id }),
];
const M = {
  "models/sales/SalesBusiness": model([bizA, bizA2, bizD]),
  "models/sales/SalesRecord": model(records),
  "models/sales/SalesImportJob": model([jobA, jobMixed, jobD]),
  "models/portal/ClientSalesRecord": model([{ client: clientA, date: new Date("2025-10-15T00:00:00Z") }, { client: clientD, date: new Date("2025-10-15T00:00:00Z") }]),
  "models/User": model([]),
  "services/salesAccess": { getManagerAuthorizedBusinessQuery: async () => ({ city: { $in: ["Ranchi", "Dhanbad"] } }) },
};
const realLoad = Module._load;
Module._load = function (req, parent) {
  if (req === "mongoose") return { Types: { ObjectId } };
  if (parent && req.startsWith(".")) {
    const rel = path.relative(SERVER, path.resolve(path.dirname(parent.filename), req)).replace(/\.js$/, "");
    if (M[rel]) return M[rel];
  }
  return realLoad.apply(this, arguments);
};
const ctl = require(path.join(SERVER, "controllers/salesAnalyticsController"));
const call = (fn, req) => new Promise((resolve) => {
  const res = { statusCode: 200, headers: {}, status(c) { this.statusCode = c; return this; }, setHeader(k, v) { this.headers[k] = v; }, json(b) { resolve({ status: this.statusCode, body: JSON.parse(JSON.stringify(b)) }); }, send(b) { resolve({ status: this.statusCode, body: b.toString() }); } };
  fn(req, res);
});
test("client analytics: calculations, parity with manager view, isolation", async () => {
  const q = { year: "2025", month: "10", months: "6" };
  const a = await call(ctl.getClientMonthlyAnalytics, { user: { _id: clientA, role: "client" }, targetClientId: clientA, query: q });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  const s = a.body.selected;
  assert.deepEqual(a.body.scope.available.map((b) => b.name).sort(), ["Green Horizon Cafe", "Hotel Green Horizon"]);
  assert.equal(s.recordedSales.value, 250000);
  assert.equal(s.discount.status, "partial"); assert.equal(s.discount.value, 20000);
  assert.equal(s.cost.covered, 1);
  assert.equal(s.growth.recordedSales, 56.25, "(250000-160000)/160000");
  assert.ok(a.body.businessBreakdown.every((b) => b.city === "Ranchi"));
  assert.equal(a.body.imports.importedRecords, 2);
  assert.equal(a.body.imports.importsCompleted, 1, "mixed-client job excluded from counts");
  assert.equal(a.body.imports.invalidRows, 0, "other clients' rejected rows not exposed");
  assert.equal(a.body.imports.pendingPreviews, 0, "Dhanbad pending preview not shown");
  assert.equal(a.body.imports.portalManualEntries, 1);
  const hist = a.body.imports.importHistory;
  assert.equal(hist.length, 2);
  const mixed = hist.find((h) => h.sharedFile);
  assert.equal(mixed.filename, undefined, "shared file name hidden"); assert.equal(mixed.recordsForYou, 1); assert.equal(mixed.totalRows, undefined);
  assert.equal(hist.find((h) => !h.sharedFile).filename, "ranchi_oct.csv");
  assert.deepEqual(a.body.latestDataPeriod, { year: 2025, month: 10, label: "October 2025" });
  assert.equal(a.body.profitabilityRows.length, 3);
  assert.ok(!JSON.stringify(a.body).includes("Coal Capital"), "no Dhanbad data anywhere in the client payload");

  const one = await call(ctl.getClientMonthlyAnalytics, { user: { _id: clientA, role: "client" }, targetClientId: clientA, query: { ...q, businessId: String(bizA._id) } });
  const os = one.body.selected;
  assert.equal(one.body.scope.businesses, 1);
  assert.deepEqual([os.net.value, os.grossProfit.value, os.netProfit.value, os.profitMargin.value, os.target.achievement], [180000, 90000, 40000, 22.22, 80]);
  const sep = one.body.trend.find((t) => t.label === "Sep 2025");
  assert.equal(sep.cost.value, null); assert.equal(sep.cost.status, "unavailable");

  const sneaky = await call(ctl.getClientMonthlyAnalytics, { user: { _id: clientD, role: "client" }, targetClientId: clientD, query: { ...q, businessId: String(bizA._id) } });
  assert.equal(sneaky.body.scope.businesses, 0); assert.equal(sneaky.body.selected.recordCount, 0);
  assert.ok(!JSON.stringify(sneaky.body).includes("Green Horizon"));
  const dd = await call(ctl.getClientMonthlyAnalytics, { user: { _id: clientD, role: "client" }, targetClientId: clientD, query: q });
  assert.equal(dd.body.selected.recordedSales.value, 99000);
  assert.equal(dd.body.imports.pendingPreviews, 1, "Dhanbad sees its own pending preview");
  assert.ok(!JSON.stringify(dd.body).includes("Green Horizon"));

  const mg = await call(ctl.getMonthlyAnalytics, { user: { _id: mgr, role: "manager" }, query: { ...q, businessId: String(bizA._id) } });
  for (const k of ["recordedSales", "discount", "net", "cost", "grossProfit", "expenses", "netProfit", "profitMargin"]) assert.equal(mg.body.selected[k].value, os[k].value, k);
  assert.equal(mg.body.scope.available.length, 3);

  const ex = await call(ctl.exportClientMonthlyAnalytics, { user: { _id: clientA, role: "client" }, targetClientId: clientA, query: { ...q, format: "csv" } });
  assert.equal(ex.status, 200); assert.match(ex.body, /Hotel Green Horizon/); assert.doesNotMatch(ex.body, /Coal Capital/);
  const ex2 = await call(ctl.exportClientMonthlyAnalytics, { user: { _id: clientA, role: "client" }, targetClientId: clientA, query: { ...q, format: "xlsx" } });
  assert.equal(ex2.status, 200);
  // Exports contain the filtered data (business filter applied), never other clients
  const exB = await call(ctl.exportClientMonthlyAnalytics, { user: { _id: clientA, role: "client" }, targetClientId: clientA, query: { ...q, businessId: String(bizA._id), format: "csv" } });
  assert.match(exB.body, /Hotel Green Horizon/);
  assert.doesNotMatch(exB.body, /Green Horizon Cafe|Coal Capital/);
  assert.match(exB.body, /October 2025/);
  assert.match(exB.body, /Business x month/);
  assert.match(exB.body, /40000/, "net profit exported");
  const none = await call(ctl.getClientMonthlyAnalytics, { user: { role: "admin" }, targetClientId: null, query: q });
  assert.equal(none.status, 404);
});
