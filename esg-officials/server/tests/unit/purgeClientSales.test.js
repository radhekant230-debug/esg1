const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createFakeDb } = require("../helpers/fakeMongo");
const { createPurger, PurgeError } = require("../../services/sales/purgeClientSales");

let BSON;
try {
  BSON = require("bson");
} catch (e) {
  BSON = require("mongoose").mongo.BSON;
}
const { ObjectId, EJSON } = BSON;

const id = () => new ObjectId();
const STAMP = "2026-10-15T08:00:00.000Z";

function world({ extraBusinesses = [], extraRecords = [] } = {}) {
  const U1 = id(); // Café Mysa client
  const U2 = id(); // another client
  const M = id(); // manager
  const B1 = id(); // CAFE MYSA, linked to U1
  const B2 = id(); // Hotel Royal, linked to U2
  const B3 = id(); // Maya Multicuisine, unlinked (similar letters, different business)
  const [J1, J2, J3, J4, J5] = [id(), id(), id(), id(), id()];
  const [F1, F2, F3, F5] = [id(), id(), id(), id()];
  const day = (b, name, k, sales, job) => ({ _id: id(), business: b, businessName: name, kind: "day", startKey: k, endKey: k, totalSales: sales, importJob: job, source: "excel_upload", updatedAt: new Date(STAMP) });
  const rec = (b, name, y, m, sales, extra = {}) => ({ _id: id(), business: b, businessName: name, year: y, month: m, monthName: `${m}/${y}`, totalSales: sales, source: "excel_upload", updatedAt: new Date(STAMP), ...extra });
  const seed = {
    users: [
      { _id: U1, role: "client", clientId: "CLI-2026-0002", name: "Mysa Owner", companyName: "Café Mysa", email: "cafemysa@client.com", password: "$2b$hash1", isActive: true },
      { _id: U2, role: "client", clientId: "CLI-2026-0001", name: "Royal Owner", companyName: "Hotel Royal Group", email: "royal@client.com", password: "$2b$hash2", isActive: true },
      { _id: M, role: "manager", name: "Manager" },
    ],
    clientprofiles: [
      { _id: id(), client: U1, businessName: "Café Mysa", updatedAt: new Date(STAMP) },
      { _id: id(), client: U2, businessName: "Hotel Royal", updatedAt: new Date(STAMP) },
    ],
    salesbusinesses: [
      { _id: B1, name: "CAFE MYSA", code: "BIZ-JH-RAN-0101", city: "Ranchi", state: "Jharkhand", clientAccount: U1 },
      { _id: B2, name: "Hotel Royal", code: "BIZ-JH-RAN-0001", city: "Ranchi", state: "Jharkhand", clientAccount: U2 },
      { _id: B3, name: "Maya Multicuisine Restaurant", code: "BIZ-JH-RAN-0002", city: "Ranchi", state: "Jharkhand", clientAccount: null },
      ...extraBusinesses,
    ],
    salesrecords: [
      rec(B1, "CAFE MYSA", 2026, 9, 612345.5, { importJob: J1 }),
      rec(B1, "CAFE MYSA", 2026, 10, 120000, { source: "daily_rollup" }),
      rec(B1, "CAFE MYSA", 2026, 10, 1500, { recordType: "transaction", date: new Date("2026-10-02"), transactionId: "T1", importJob: J2 }),
      rec(B2, "Hotel Royal", 2026, 9, 250000, { source: "manual" }),
      rec(B2, "Hotel Royal", 2026, 10, 260000, { importJob: J2 }),
      rec(B3, "Maya Multicuisine Restaurant", 2026, 9, 180000, { source: "manual" }),
      ...extraRecords,
    ],
    salesentries: [
      ...Array.from({ length: 30 }, (_, i) => day(B1, "CAFE MYSA", `2026-09-${String(i + 1).padStart(2, "0")}`, 20411.5, J1)),
      ...Array.from({ length: 5 }, (_, i) => day(B2, "Hotel Royal", `2026-09-0${i + 1}`, 50000, J3)),
    ],
    clientsalesrecords: [
      { _id: id(), client: U1, totalRevenue: 90000, date: new Date("2026-08-01"), updatedAt: new Date(STAMP) },
      { _id: id(), client: U1, totalRevenue: 95000, date: new Date("2026-07-01"), updatedAt: new Date(STAMP) },
      { _id: id(), client: U2, totalRevenue: 70000, date: new Date("2026-08-01"), updatedAt: new Date(STAMP) },
    ],
    salesimportjobs: [
      // only Café Mysa -> deleted with its file
      { _id: J1, filename: "mysa-sept.xlsx", targetBusiness: B1, businesses: [B1], affectedClients: [U1], originalFile: { fileId: F1 }, validRows: [{ data: { businessId: String(B1) } }], totalRevenue: 612345.5 },
      // covers both clients -> kept
      { _id: J2, filename: "both.xlsx", targetBusiness: null, businesses: [B1, B2], affectedClients: [U1, U2], originalFile: { fileId: F2 }, totalRevenue: 261500 },
      // Hotel Royal only; its history references J4 and it shares file F3 with J5
      { _id: J3, filename: "royal.xlsx", targetBusiness: B2, businesses: [B2], affectedClients: [U2], originalFile: { fileId: F3 }, replacedImports: [J4], totalRevenue: 250000 },
      // only Café Mysa, but referenced by J3's history -> kept
      { _id: J4, filename: "mysa-old.xlsx", targetBusiness: B1, businesses: [B1], affectedClients: [U1], originalFile: { fileId: null }, totalRevenue: 1 },
      // only Café Mysa -> deleted; its file F3 is also used by J3 -> file kept; F5 n/a
      { _id: J5, filename: "mysa-reupload.xlsx", targetBusiness: B1, businesses: [B1], affectedClients: [U1], originalFile: { fileId: F3 }, totalRevenue: 2 },
    ],
    "salesImportFiles.files": [{ _id: F1, filename: "mysa-sept.xlsx" }, { _id: F2, filename: "both.xlsx" }, { _id: F3, filename: "royal.xlsx" }, { _id: F5, filename: "unrelated" }],
    "salesImportFiles.chunks": [
      { _id: id(), files_id: F1, n: 0 },
      { _id: id(), files_id: F1, n: 1 },
      { _id: id(), files_id: F2, n: 0 },
      { _id: id(), files_id: F3, n: 0 },
    ],
    clientorders: [{ _id: id(), client: U1, value: 500, updatedAt: new Date(STAMP) }],
    clientleads: [{ _id: id(), client: U1, updatedAt: new Date(STAMP) }],
    campaignmetrics: [{ _id: id(), client: U1, updatedAt: new Date(STAMP) }],
    socialmediametrics: [],
    googlebusinessmetrics: [],
    contentcalendaritems: [{ _id: id(), client: U1, updatedAt: new Date(STAMP) }],
    clientreports: [],
    clientinvoices: [{ _id: id(), client: U1, updatedAt: new Date(STAMP) }],
    clientvaultdocuments: [],
    notifications: [{ _id: id(), recipient: U1, type: "sales_import" }],
    auditlogs: [],
  };
  const fake = createFakeDb(seed);
  const purger = createPurger({ db: fake.db, EJSON, ObjectId, withTransaction: (fn) => fake.withTransaction(fn) });
  return { fake, purger, ids: { U1, U2, B1, B2, B3, J1, J2, J3, J4, J5, F1, F2, F3, F5 } };
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "purge-test-"));
const s = (v) => String(v);

test("plan: identifies Café Mysa by client ID → linked business, counts exactly, changes nothing", async () => {
  const { fake, purger, ids } = world();
  const before = JSON.stringify(fake.data);
  const p = await purger.plan({ clientCode: "CLI-2026-0002", expectName: "Mysa" });
  assert.equal(JSON.stringify(fake.data), before, "dry run must not modify anything");
  assert.deepEqual(p.businesses.map((b) => b.code), ["BIZ-JH-RAN-0101"]);
  assert.equal(p.summary.salesRecords.count, 3);
  assert.deepEqual(p.summary.salesRecords.bySource, { excel_upload: 2, daily_rollup: 1 });
  assert.equal(p.summary.salesRecords.totalSales, 733845.5);
  assert.equal(p.summary.salesEntries.count, 30);
  assert.equal(p.summary.salesEntries.totalSales, 612345);
  assert.equal(p.summary.clientSalesRecords.count, 2);
  assert.deepEqual(p.ids.jobs.map(s).sort(), [s(ids.J1), s(ids.J5)].sort(), "J1 and J5 concern Café Mysa only");
  const kept = Object.fromEntries(p.summary.importJobsKept.map((j) => [j._id, j.reason]));
  assert.match(kept[s(ids.J2)], /other businesses/);
  assert.match(kept[s(ids.J4)], /history/);
  assert.deepEqual(p.ids.gridFiles.map(s), [s(ids.F1)], "F3 is still used by Hotel Royal's import");
  assert.equal(p.ids.gridChunks.length, 2);
  assert.equal(p.lookAlikes.length, 0, "Maya Multicuisine is not a look-alike of Café Mysa");
});

test("execute: backs up, deletes only Café Mysa sales, keeps account, businesses and every other client's data", async () => {
  const { fake, purger, ids } = world();
  const p = await purger.plan({ clientCode: "CLI-2026-0002", expectName: "Café Mysa" });
  const dir = tmp();
  const r = await purger.execute(p, { backupDir: dir, stamp: STAMP });

  assert.deepEqual(r.deleted, { salesrecords: 3, salesentries: 30, clientsalesrecords: 2, salesimportjobs: 2, "salesImportFiles.files": 1, "salesImportFiles.chunks": 2 });
  assert.equal(r.transactional, true);
  assert.ok(fake.ops.filter((o) => o.op === "deleteMany").every((o) => o.session), "every delete ran in the transaction");

  const v = r.verification;
  assert.equal(v.clientSalesNowEmpty, true);
  assert.equal(v.othersUnchanged, true);
  assert.equal(v.preservedUnchanged, true);
  assert.equal(v.businessesKept, true);
  assert.equal(v.othersAfter.records.count, 3, "Hotel Royal ×2 and Maya ×1 remain");
  assert.equal(v.othersAfter.records.total, 690000);
  assert.equal(v.othersAfter.entries.count, 5);

  // the account, its login and marketing data are untouched
  const u = fake.data.users.find((x) => s(x._id) === s(ids.U1));
  assert.equal(u.password, "$2b$hash1");
  assert.equal(fake.data.clientleads.length, 1);
  assert.equal(fake.data.clientorders.length, 1);
  assert.equal(fake.data.notifications.length, 1);
  // business kept and flagged so startup sample data is not re-seeded
  const b1 = fake.data.salesbusinesses.find((b) => s(b._id) === s(ids.B1));
  assert.ok(b1 && b1.salesDataPurgedAt instanceof Date);
  assert.ok(!fake.data.salesbusinesses.find((b) => s(b._id) === s(ids.B2)).salesDataPurgedAt);
  // shared files/jobs kept
  assert.deepEqual(fake.data["salesImportFiles.files"].map((f) => s(f._id)).sort(), [s(ids.F2), s(ids.F3), s(ids.F5)].sort());
  assert.deepEqual(fake.data.salesimportjobs.map((j) => s(j._id)).sort(), [s(ids.J2), s(ids.J3), s(ids.J4)].sort());
  // audit entry
  assert.equal(fake.data.auditlogs.length, 1);
  assert.equal(fake.data.auditlogs[0].action, "CLIENT_SALES_DATA_PURGED");
  // backup on disk
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  assert.equal(manifest.files.entries.count, 30);
});

test("restore: the backup puts every deleted document back", async () => {
  const { fake, purger } = world();
  const snapshot = (n) => fake.data[n].map((d) => s(d._id)).sort();
  const names = ["salesrecords", "salesentries", "clientsalesrecords", "salesimportjobs", "salesImportFiles.files", "salesImportFiles.chunks"];
  const before = Object.fromEntries(names.map((n) => [n, snapshot(n)]));
  const p = await purger.plan({ clientCode: "CLI-2026-0002" });
  const dir = tmp();
  await purger.execute(p, { backupDir: dir, stamp: STAMP });
  const r = await purger.restore(dir, { stamp: STAMP });
  names.forEach((n) => assert.deepEqual(snapshot(n), before[n], `${n} restored`));
  assert.equal(r.restored.salesentries, 30);
  assert.ok(fake.data.salesbusinesses.every((b) => !b.salesDataPurgedAt));
  assert.equal(fake.data.auditlogs.at(-1).action, "CLIENT_SALES_DATA_RESTORED");
});

test("data changed between plan and delete: the transaction rolls everything back", async () => {
  const { fake, purger } = world();
  const p = await purger.plan({ clientCode: "CLI-2026-0002" });
  fake.data.salesentries.splice(0, 1); // a concurrent change after the plan
  const before = JSON.stringify(fake.data);
  await assert.rejects(purger.execute(p, { backupDir: tmp(), stamp: STAMP }), /differ from the plan/);
  assert.equal(JSON.stringify(fake.data), before, "nothing deleted");
});

test("ambiguity stops before any change", async () => {
  // unknown or wrong client
  let w = world();
  await assert.rejects(w.purger.plan({ clientCode: "CLI-2026-9999" }), /found 0/);
  await assert.rejects(w.purger.plan({ clientCode: "CLI-2026-0002", expectName: "Hotel Royal" }), /does not match/);
  await assert.rejects(w.purger.plan({ clientCode: "" }), PurgeError);

  // duplicate client IDs
  w = world();
  w.fake.data.users.push({ _id: id(), role: "client", clientId: "CLI-2026-0002", companyName: "Mysa Duplicate" });
  await assert.rejects(w.purger.plan({ clientCode: "CLI-2026-0002" }), /found 2/);

  // an unlinked "Cafe Mysa" business that holds sales: refuse unless told what it is
  const B9 = id();
  w = world({
    extraBusinesses: [{ _id: B9, name: "Cafe Mysa", code: "BIZ-KA-BLR-0009", city: "Bengaluru", clientAccount: null }],
    extraRecords: [{ _id: id(), business: B9, businessName: "Cafe Mysa", year: 2026, month: 9, totalSales: 1000 }],
  });
  await assert.rejects(w.purger.plan({ clientCode: "CLI-2026-0002" }), (e) => e instanceof PurgeError && e.details.lookAlikes[0].code === "BIZ-KA-BLR-0009");
  const ack = await w.purger.plan({ clientCode: "CLI-2026-0002", acknowledgeUnlinked: true });
  assert.equal(ack.summary.salesRecords.count, 3, "the unlinked one is left alone");
  const inc = await w.purger.plan({ clientCode: "CLI-2026-0002", includeBusinessIds: ["BIZ-KA-BLR-0009"] });
  assert.equal(inc.summary.salesRecords.count, 4);

  // a business owned by another client can never be included
  w = world();
  await assert.rejects(w.purger.plan({ clientCode: "CLI-2026-0002", includeBusinessIds: ["BIZ-JH-RAN-0001"] }), /another client/);
});
