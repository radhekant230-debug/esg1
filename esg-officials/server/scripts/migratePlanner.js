/**
 * Planner / analytics migration. ADDITIVE ONLY — no existing document is
 * modified or removed. Steps:
 *   1. Back up the affected collections (scripts/backupDatabase.js)
 *   2. Create the new collections' indexes and the new Notification dedupe index
 *   3. Report legacy sales records (they keep salesBasis = gross by default;
 *      discount / cost / expenses stay "not recorded")
 * Usage: npm run migrate:planner
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { backup } = require("./backupDatabase");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || "esg-official-clients" });
  console.log("1) Backing up...");
  const b = await backup();
  console.log("   Backup:", b.dir, b.summary);

  console.log("2) Creating indexes...");
  const models = [
    require("../models/planner/ScheduledActivity"),
    require("../models/planner/NotificationJob"),
    require("../models/planner/SchedulerLock"),
    require("../models/AuditLog"),
    require("../models/Counter"),
    require("../models/Notification"),
    require("../models/sales/SalesRecord"),
    require("../models/sales/SalesImportJob"),
    require("../models/sales/SalesBusiness"),
    require("../models/sales/SalesEntry"), // restaurant day-wise report data
    require("../models/User"), // unique sparse username (login IDs such as maya@2040)
  ];
  for (const m of models) {
    await m.createIndexes();
    console.log(`   ✓ ${m.modelName}`);
  }

  const SalesRecord = require("../models/sales/SalesRecord");
  const legacy = await SalesRecord.countDocuments({ salesBasis: { $exists: false } });
  console.log(`3) ${legacy} legacy sales records have no salesBasis/discount/cost/expenses fields.`);
  console.log("   They are treated as GROSS sales with discounts/costs/expenses 'Not recorded' (no values invented).");

  await mongoose.disconnect();
  console.log("Migration complete.");
})().catch(async (err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
