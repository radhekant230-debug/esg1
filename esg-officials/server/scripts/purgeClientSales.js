/**
 * Permanently removes one client's SALES data from both portals, keeping the
 * account, login, profile, businesses and all non-sales data.
 *
 *   # 1. Dry run (default): identifies the client by its client ID and counts what would go
 *   node scripts/purgeClientSales.js --client CLI-2026-0002 --expect-name "Mysa"
 *
 *   # 2. Delete: backs up first, deletes in a transaction, verifies, audits
 *   node scripts/purgeClientSales.js --client CLI-2026-0002 --expect-name "Mysa" --execute --confirm CLI-2026-0002
 *
 *   # Undo from the backup the run printed
 *   node scripts/purgeClientSales.js --restore backups/sales-purge/CLI-2026-0002-<timestamp>
 *
 * Options:
 *   --include-business <code>   also purge a business that is not linked to the client
 *                               (only if it is not linked to another client)
 *   --acknowledge-unlinked      proceed although look-alike unlinked businesses hold sales
 *                               (they are left untouched)
 *
 * Reads MONGO_URI from .env and never prints it. Stop the server before --execute
 * if possible, so no import runs at the same time.
 */
require("dotenv").config();
const path = require("path");
const mongoose = require("mongoose");
const { createPurger, PurgeError } = require("../services/sales/purgeClientSales");
const { runInTransaction } = require("../utils/transaction");

const User = require("../models/User");
const SalesBusiness = require("../models/sales/SalesBusiness");
const SalesRecord = require("../models/sales/SalesRecord");
const SalesEntry = require("../models/sales/SalesEntry");
const SalesImportJob = require("../models/sales/SalesImportJob");
const ClientSalesRecord = require("../models/portal/ClientSalesRecord");
const ClientProfile = require("../models/portal/ClientProfile");
const ClientOrder = require("../models/portal/ClientOrder");
const ClientLead = require("../models/portal/ClientLead");
const CampaignMetric = require("../models/portal/CampaignMetric");
const SocialMediaMetric = require("../models/portal/SocialMediaMetric");
const GoogleBusinessMetric = require("../models/portal/GoogleBusinessMetric");
const ContentCalendarItem = require("../models/portal/ContentCalendarItem");
const ClientReport = require("../models/portal/ClientReport");
const ClientInvoice = require("../models/portal/ClientInvoice");
const ClientVaultDocument = require("../models/portal/ClientVaultDocument");
const AuditLog = require("../models/AuditLog");
const Notification = require("../models/Notification");

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 ? argv[i + 1] : null;
};
const args = (name) => argv.reduce((a, v, i) => (v === `--${name}` && argv[i + 1] ? [...a, argv[i + 1]] : a), []);
const has = (name) => argv.includes(`--${name}`);
const cn = (M) => M.collection.collectionName;

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function printPlan(p) {
  const s = p.summary;
  console.log("\nClient");
  console.log(`  ${p.clientCode}  ${p.client.companyName || p.client.name}  (user ${p.client._id}${p.client.profileName ? `, profile "${p.client.profileName}"` : ""})`);
  console.log("\nBusinesses whose sales are removed (the businesses themselves are kept)");
  if (!p.businesses.length) console.log("  none linked to this client");
  p.businesses.forEach((b) => console.log(`  ${b.code}  ${b.name}, ${b.city}  [${b.linkedBy}]`));
  if (p.lookAlikes.length) {
    console.log("\nSimilar names NOT linked to this client (never touched)");
    p.lookAlikes.forEach((b) => console.log(`  ${b.code}  ${b.name}, ${b.city}  linked to ${b.linkedClient || "no client"}  sales records ${b.salesRecords}, entries ${b.salesEntries}`));
  }
  console.log("\nTo delete");
  console.log(`  salesrecords        ${s.salesRecords.count}  (${Object.entries(s.salesRecords.bySource).map(([k, v]) => `${k} ${v}`).join(", ") || "-"})  ${money(s.salesRecords.totalSales)}  months ${s.salesRecords.months.join(", ") || "-"}`);
  console.log(`  salesentries        ${s.salesEntries.count}  ${money(s.salesEntries.totalSales)}`);
  console.log(`  clientsalesrecords  ${s.clientSalesRecords.count}  ${money(s.clientSalesRecords.totalRevenue)}`);
  console.log(`  salesimportjobs     ${s.importJobsDeleted}`);
  console.log(`  original files      ${s.originalFilesDeleted} (${s.originalFileChunksDeleted} chunks)`);
  if (s.importJobsKept.length) {
    console.log("\nImport jobs kept (shared or not attributable)");
    s.importJobsKept.forEach((j) => console.log(`  ${j._id}  ${j.filename}  — ${j.reason}`));
  }
  console.log(`\nKept: client orders ${s.keptForReference.clientOrders}, notifications ${s.keptForReference.notifications}, audit logs, account, profile and all marketing data.`);
}

(async () => {
  if (!process.env.MONGO_URI) throw new PurgeError("MONGO_URI is not set (server/.env).");
  const dbName = process.env.MONGO_DB_NAME || "esg-official-clients";
  await mongoose.connect(process.env.MONGO_URI, { dbName });
  console.log(`Connected to database "${dbName}".`);

  const purger = createPurger({
    db: mongoose.connection.db,
    EJSON: mongoose.mongo.BSON.EJSON,
    ObjectId: mongoose.Types.ObjectId,
    withTransaction: runInTransaction,
    names: {
      users: cn(User),
      profiles: cn(ClientProfile),
      businesses: cn(SalesBusiness),
      records: cn(SalesRecord),
      entries: cn(SalesEntry),
      clientSales: cn(ClientSalesRecord),
      jobs: cn(SalesImportJob),
      audit: cn(AuditLog),
      notifications: cn(Notification),
      orders: cn(ClientOrder),
    },
    preserved: Object.fromEntries(
      [ClientProfile, ClientOrder, ClientLead, CampaignMetric, SocialMediaMetric, GoogleBusinessMetric, ContentCalendarItem, ClientReport, ClientInvoice, ClientVaultDocument].map((M) => [cn(M), "client"])
    ),
  });
  const stamp = new Date().toISOString();

  if (arg("restore")) {
    const dir = path.resolve(arg("restore"));
    const { manifest, restored } = await purger.restore(dir, { stamp });
    console.log(`Restored backup of ${manifest.clientCode} from ${dir}:`);
    Object.entries(restored).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
    return;
  }

  const clientCode = arg("client");
  const p = await purger.plan({
    clientCode,
    expectName: arg("expect-name") || "",
    includeBusinessIds: args("include-business"),
    acknowledgeUnlinked: has("acknowledge-unlinked"),
  });
  printPlan(p);

  if (!has("execute")) {
    console.log("\nDry run only — nothing was changed. Add --execute --confirm " + clientCode + " to delete.");
    return;
  }
  if (arg("confirm") !== clientCode) throw new PurgeError(`--confirm must repeat the client ID (${clientCode}). Nothing was changed.`);

  const backupDir = path.resolve(__dirname, "..", "backups", "sales-purge", `${clientCode}-${stamp.replace(/[:.]/g, "-")}`);
  const r = await purger.execute(p, { backupDir, stamp });
  const v = r.verification;
  console.log(`\nBackup written and checked: ${backupDir}`);
  console.log(`Deleted (${r.transactional ? "in one transaction" : "standalone MongoDB: no transaction, backup is the undo"}):`);
  Object.entries(r.deleted).forEach(([k, n]) => console.log(`  ${k}: ${n}`));
  console.log("\nVerification");
  console.log(`  client's sales left:            ${JSON.stringify(v.remaining)}  -> ${v.clientSalesNowEmpty ? "none" : "SOME REMAIN"}`);
  console.log(`  other clients' sales unchanged: ${v.othersUnchanged ? "yes" : "NO"}  (salesrecords ${v.othersAfter.records.count} / ${money(v.othersAfter.records.total)}, salesentries ${v.othersAfter.entries.count} / ${money(v.othersAfter.entries.total)})`);
  console.log(`  account & non-sales data:       ${v.preservedUnchanged && v.preservedAfter.user.exists ? "unchanged" : "CHANGED"}`);
  console.log(`  businesses kept:                ${v.businessesKept ? "yes" : "NO"}`);
  if (!v.clientSalesNowEmpty || !v.othersUnchanged || !v.preservedUnchanged || !v.businessesKept) process.exitCode = 2;
})()
  .catch((e) => {
    console.error(`\n${e.name === "PurgeError" ? "Stopped" : "Error"}: ${e.message}`);
    if (e.details) console.error(JSON.stringify(e.details, null, 2));
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect().catch(() => {}));
