/**
 * Preview of a sales file imported directly for a client that has no sales
 * business yet (the client's ledger is created only on confirm). Database
 * models are replaced by in-memory fakes; the real parser and controller run.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");
const path = require("path");
const XLSX = require("xlsx");
const { ObjectId } = require("bson");

const CLIENT = new ObjectId();
const MANAGER = new ObjectId();
const OTHER_BIZ = { _id: new ObjectId(), name: "Hotel Royal", code: "BIZ-JH-RAN-0001", city: "Ranchi", state: "Jharkhand", category: "Hotel", monthlyTarget: 0, clientAccount: new ObjectId() };
const db = { jobs: [], businesses: [OTHER_BIZ], records: [], entries: [], files: [] };

const q = (value) => {
  const o = { select: () => o, sort: () => o, lean: () => o, populate: () => o, session: () => o, limit: () => o, distinct: async () => (Array.isArray(value) ? value.map((v) => v._id) : []), then: (a, b) => Promise.resolve(value).then(a, b) };
  return o;
};
const matchesClient = (f, b) => !f.clientAccount || String(b.clientAccount) === String(f.clientAccount);
const fakes = {
  mongoose: { Types: { ObjectId: Object.assign(function (v) { return new ObjectId(v); }, { isValid: (v) => ObjectId.isValid(String(v)) }) }, startSession: async () => null },
  "models/sales/SalesBusiness": {
    find: (f = {}) => q(db.businesses.filter((b) => matchesClient(f, b))),
    findById: (id) => q(db.businesses.find((b) => String(b._id) === String(id)) || null),
    findOne: (f = {}) => q(db.businesses.find((b) => matchesClient(f, b) && (!f.isClientLedger || b.isClientLedger)) || null),
    exists: async () => null,
    create: async (d) => (db.businesses.push(d), d),
  },
  "models/sales/SalesRecord": { find: () => q([]), findOne: () => q(null) },
  "models/sales/SalesEntry": { find: () => q([]) },
  "models/sales/SalesImportJob": {
    find: () => q([]),
    findOne: () => q(null),
    updateMany: async () => ({}),
    create: async (d) => (db.jobs.push(d), d),
  },
  "models/User": {
    find: (f) => q(f && f.role === "client" ? [{ _id: CLIENT, name: "Café Mysa", companyName: "Café Mysa", clientId: "CLI-2026-0011", assignedManager: MANAGER }] : []),
    findById: () => q({ assignedCity: "Ranchi", assignedState: "Jharkhand" }),
  },
  "services/salesAccess": { getManagerAuthorizedBusinessQuery: async () => ({ city: { $in: ["Ranchi"] } }) },
  "services/audit": { audit: async () => {} },
  "services/sales/importFileStore": { saveFile: async () => ({ fileId: "f1" }), deleteFile: async () => {} },
  "services/portal/clientSalesFeed": { notifyClientsOfNewSales: async () => {} },
  "utils/transaction": { runInTransaction: async (fn) => fn(null) },
};
const realLoad = Module._load;
Module._load = function (req, parent, ...rest) {
  if (req === "mongoose") return fakes.mongoose;
  if (req.startsWith(".")) {
    const abs = path.resolve(path.dirname(parent.filename), req).replace(/\\/g, "/");
    const key = Object.keys(fakes).find((k) => abs.endsWith(`/server/${k}`) || abs.endsWith(`/server/${k}.js`));
    if (key) return fakes[key];
  }
  return realLoad.call(this, req, parent, ...rest);
};
const ctrl = require("../../controllers/salesImportController");
// the controller also requires models lazily, so the fakes stay installed for this test file

const csv = ["Date,Total Sales,Orders,Discount,Remarks", "2026-10-01,25400,82,1200,", "2026-10-02,31850,97,900,Sunday", "2026-10-03,abc,10,,bad amount"].join("\n");
const xlsxBuf = () => {
  const ws = XLSX.utils.aoa_to_sheet([["Month", "Total Sales", "Orders"], ["September 2026", 812000, 2410], ["August 2026", 790500, 2302]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sales");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
};
const call = async (file, body = {}) => {
  const res = { code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, set() { return this; } };
  const req = { file, body: { targetClientId: String(CLIENT), ...body }, user: { _id: MANAGER, role: "manager", name: "Rahul" }, query: {} };
  await ctrl.previewSalesExcel(req, res);
  return res;
};

test("CSV for a client without a business reaches the row-by-row preview, nothing saved", async () => {
  const before = { biz: db.businesses.length, records: db.records.length };
  const r = await call({ originalname: "mysa_daily.csv", buffer: Buffer.from(csv), size: csv.length });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.equal(r.body.validCount, 2);
  assert.equal(r.body.invalidCount, 1);
  assert.ok(r.body.invalidRows[0].errors.join(" ").length > 0, "invalid row explains why");
  assert.equal(r.body.portalTargets[0].businessName, "Café Mysa");
  const job = db.jobs.at(-1);
  assert.equal(String(job.targetClient), String(CLIENT), "client ID kept on the preview");
  assert.ok(job.pendingLedger && job.pendingLedger.city === "Ranchi");
  assert.deepEqual([db.businesses.length, db.records.length], [before.biz, before.records], "no ledger or records before confirm");
});

test("XLSX (monthly) for the same client previews too", async () => {
  const buf = xlsxBuf();
  const r = await call({ originalname: "mysa_monthly.xlsx", buffer: buf, size: buf.length });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.equal(r.body.validCount, 2);
});

test("invalid files get a specific message, not the generic one", async () => {
  const pdf = Buffer.from("%PDF-1.4 not a spreadsheet");
  let r = await call({ originalname: "report.pdf", buffer: pdf, size: pdf.length });
  assert.equal(r.code, 400);
  assert.doesNotMatch(r.body.message, /Failed to process/);
  r = await call({ originalname: "empty.csv", buffer: Buffer.from(""), size: 0 });
  assert.equal(r.code >= 400 && r.code < 500, true, JSON.stringify(r.body));
  r = await call({ originalname: "no_sales.csv", buffer: Buffer.from("Date,Remarks\n2026-10-01,x\n"), size: 30 });
  assert.equal(r.code, 422, JSON.stringify(r.body));
  assert.match(r.body.message, /Total Sales/);
  r = await call({ originalname: "x.csv", buffer: Buffer.from(csv), size: 10 }, { targetClientId: "not-an-id" });
  assert.deepEqual([r.code, r.body.message], [400, "Invalid target client."]);
});
