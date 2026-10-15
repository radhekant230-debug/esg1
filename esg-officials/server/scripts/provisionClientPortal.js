/**
 * Activates the Client Portal for an existing sales business (no duplicate
 * business or user; safe to re-run).
 *
 *   # Dry run: shows the business, any existing account and what would change
 *   node scripts/provisionClientPortal.js --business "Maya Multicuisine Restaurant" --city Ranchi --login maya@2040
 *
 *   # Apply (temporary password read from the environment, not the command line)
 *   PORTAL_TEMP_PASSWORD=... node scripts/provisionClientPortal.js --business "Maya Multicuisine Restaurant" --city Ranchi --login maya@2040 --apply
 *   (Windows PowerShell: $env:PORTAL_TEMP_PASSWORD="..."; node scripts/...)
 *
 *   --reset-password   also replace the password of an account that already exists
 *
 * Reads MONGO_URI from .env and never prints it or any password hash.
 */
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const SalesBusiness = require("../models/sales/SalesBusiness");
const SalesRecord = require("../models/sales/SalesRecord");
const SalesEntry = require("../models/sales/SalesEntry");
const ClientProfile = require("../models/portal/ClientProfile");
const { audit } = require("../services/audit");
const { buildLoginQuery } = require("../utils/loginQuery");
const { createProvisioner, ProvisionError } = require("../services/portal/provisionClientPortal");

const argv = process.argv.slice(2);
const arg = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i > -1 ? argv[i + 1] : null;
};
const has = (n) => argv.includes(`--${n}`);
const safeUser = (u) => (u ? { _id: String(u._id), clientId: u.clientId || null, username: u.username || null, email: u.email, role: u.role, companyName: u.companyName || "", isActive: u.isActive, isVerified: u.isVerified } : null);

(async () => {
  if (!process.env.MONGO_URI) throw new ProvisionError("MONGO_URI is not set (server/.env).");
  const dbName = process.env.MONGO_DB_NAME || "esg-official-clients";
  await mongoose.connect(process.env.MONGO_URI, { dbName });
  console.log(`Connected to database "${dbName}".`);

  const p = createProvisioner({
    User,
    SalesBusiness,
    ClientProfile,
    hashPassword: (pw) => bcrypt.hash(pw, 10), // same as Admin → Create client
    comparePassword: (pw, hash) => bcrypt.compare(pw, hash),
    buildLoginQuery,
    audit: (entry) => audit(entry, { strict: false }),
  });

  const plan = await p.plan({ businessName: arg("business"), city: arg("city"), login: arg("login") });
  const b = plan.business;
  const [records, entries] = await Promise.all([SalesRecord.countDocuments({ business: b._id }), SalesEntry.countDocuments({ business: b._id })]);
  const manager = b.assignedManager ? await User.findById(b.assignedManager).select("name email role") : null;

  console.log("\nBusiness");
  console.log(`  _id ${b._id}  code ${b.code}  ${b.name}, ${b.city}, ${b.state}`);
  console.log(`  assigned manager: ${manager ? `${manager.name} (${manager._id})` : "none"}`);
  console.log(`  linked client account: ${b.clientAccount || "none (shows \"(no client portal)\")"}`);
  console.log(`  sales data: ${records} salesrecords, ${entries} salesentries`);
  console.log("\nAccount");
  console.log(plan.user ? `  ${plan.how}: ${JSON.stringify(safeUser(plan.user))}` : "  none — a new client account will be created");
  console.log(`  client profile: ${plan.profile ? "exists" : "will be created"}`);

  if (!has("apply")) {
    console.log("\nDry run only — nothing was changed. Add --apply (with PORTAL_TEMP_PASSWORD set) to activate.");
    return;
  }

  // backup of what may change (no password hashes)
  const dir = path.resolve(__dirname, "..", "backups", "portal-provision");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${b.code}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ business: b.toObject(), user: safeUser(plan.user), profile: plan.profile ? plan.profile.toObject() : null }, null, 2));

  await User.createIndexes(); // unique sparse index on the new username field
  const r = await p.apply(plan, { tempPassword: process.env.PORTAL_TEMP_PASSWORD || "", resetPassword: has("reset-password") });
  console.log(`\nBackup: ${file}`);
  console.log(`Changes: ${r.changes.length ? r.changes.join(", ") : "none (already set up)"}`);
  console.log("Checks:", JSON.stringify(r.checks));
  console.log("Result:", JSON.stringify({ businessId: String(r.business._id), ...safeUser(r.user) }));
})()
  .catch((e) => {
    console.error(`\n${e.name === "ProvisionError" ? "Stopped" : "Error"}: ${e.message}`);
    if (e.details) console.error(JSON.stringify(e.details, null, 2));
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect().catch(() => {}));
