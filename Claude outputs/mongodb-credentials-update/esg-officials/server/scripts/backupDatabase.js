/**
 * Exports collections to timestamped JSON (Extended JSON) files in server/backups/
 * before running migrations. Usage:
 *   npm run db:backup                      (default planner/sales collections)
 *   node scripts/backupDatabase.js --all   (every collection)
 * Restore a file with:  mongoimport --uri "$MONGO_URI" --collection <name> --file <file> --jsonArray
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { EJSON } = mongoose.mongo.BSON;

const DEFAULT_COLLECTIONS = [
  "users",
  "notifications",
  "salesrecords",
  "salesbusinesses",
  "salesimportjobs",
  "calendarevents",
  "tasks",
];

async function backup({ all = false, dir = path.join(__dirname, "..", "backups") } = {}) {
  const db = mongoose.connection.db;
  const existing = (await db.listCollections().toArray()).map((c) => c.name);
  const names = all ? existing : DEFAULT_COLLECTIONS.filter((n) => existing.includes(n));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(dir, `backup_${stamp}`);
  fs.mkdirSync(target, { recursive: true });
  const summary = {};
  for (const name of names) {
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(path.join(target, `${name}.json`), EJSON.stringify(docs, null, 0, { relaxed: false }));
    summary[name] = docs.length;
  }
  fs.writeFileSync(path.join(target, "_summary.json"), JSON.stringify({ createdAt: new Date(), summary }, null, 2));
  return { dir: target, summary };
}

module.exports = { backup };

if (require.main === module) {
  (async () => {
    await require("../config/db").connectDB({ retries: 1 }); // shared, validated connection (never logs the URI)
    const result = await backup({ all: process.argv.includes("--all") });
    console.log("Backup written to", result.dir);
    console.table(result.summary);
    await mongoose.disconnect();
  })().catch((err) => {
    console.error("Backup failed:", err);
    process.exit(1);
  });
}
