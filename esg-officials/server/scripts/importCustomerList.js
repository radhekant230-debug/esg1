/**
 * Imports a POS customer list (CSV/XLSX) into ONE client's Leads & Enquiries,
 * with the same mapping and duplicate protection as the "Import CSV / Excel"
 * button, then prints the Customer Insights figures read back from MongoDB.
 *
 *   # preview only (nothing is written)
 *   node scripts/importCustomerList.js --client CLI-2026-0002 --file "C:\path\Cafe_Mysa_Customer-List (1).csv"
 *   # write
 *   node scripts/importCustomerList.js --client CLI-2026-0002 --file "...csv" --apply
 *   # only print the figures from the database
 *   node scripts/importCustomerList.js --client CLI-2026-0002 --verify
 *
 * --client accepts the client ID (CLI-YYYY-NNNN), the user _id, or the login email.
 * Re-running with the same file updates the same customers (no duplicates).
 * Reads MONGO_URI from server/.env; never prints it.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const User = require("../models/User");
const ClientLead = require("../models/portal/ClientLead");
const { importCustomerList } = require("../services/portal/customerListImport");
const ci = require("../services/portal/customerInsights");

const argv = process.argv.slice(2);
const arg = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : null);
const has = (n) => argv.includes(`--${n}`);
const SOURCES = ClientLead.schema.path("source").enumValues;
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

async function figures(clientObjectId) {
  const [lg, tx] = await Promise.all([
    ci.leadGroups(ClientLead, { client: clientObjectId }, null),
    ci.txnGroups(
      { Business: require("../models/biz/Business"), BizSale: require("../models/biz/BizSale"), BizCustomer: require("../models/biz/BizCustomer") },
      clientObjectId,
      null
    ),
  ]);
  return ci.summarize(ci.filterCustomers(ci.mergeCustomers(lg, tx.groups, null), {}).list);
}

(async () => {
  const who = arg("client");
  if (!who) throw new Error("--client is required (client ID such as CLI-2026-0002, user _id or email).");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set (server/.env).");
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || "esg-official-clients" });

  const or = [{ clientId: who }, { email: who.toLowerCase() }];
  if (mongoose.Types.ObjectId.isValid(who)) or.push({ _id: who });
  const clients = await User.find({ role: "client", $or: or }).select("_id clientId companyName name email");
  if (clients.length !== 1) throw new Error(clients.length ? `"${who}" matches ${clients.length} clients; use the client _id.` : `No client account matches "${who}".`);
  const client = clients[0];
  console.log(`Client: ${client.companyName || client.name} (${client.clientId || client._id})`);

  if (!has("verify")) {
    const file = arg("file");
    if (!file || !fs.existsSync(file)) throw new Error("--file must point to the CSV/XLSX file.");
    const out = await importCustomerList({
      ClientLead,
      clientId: client._id,
      buffer: fs.readFileSync(file),
      filename: path.basename(file),
      sources: SOURCES,
      defaultSource: "Walk-in",
      mode: has("apply") ? "commit" : "preview",
      author: "Customer list import",
    });
    const s = out.summary;
    console.log(`File: ${s.file} — ${s.rows} rows · ${s.toCreate} new customers · ${s.toUpdate} existing (updated, not duplicated) · ${s.skipped} skipped`);
    s.skippedRows.slice(0, 5).forEach((r) => console.log(`  skipped row ${r.rowNumber}: ${r.reason}`));
    console.log(`Rows with visits: ${s.customerData.withVisits} · with total spent: ${s.customerData.withSpend} · with last visit: ${s.customerData.withLastVisit}`);
    console.log(`File totals: ${s.customerData.totalVisits.toLocaleString("en-IN")} visits · ${inr(s.customerData.totalSpent)} spent`);
    if (out.result) console.log(`Written: ${out.result.created} added · ${out.result.updated} updated · ${out.result.unchanged} already up to date`);
    else console.log("Preview only — nothing was written. Add --apply to import.");
  }

  const f = await figures(client._id);
  console.log("\nCustomer Insights (from the database):");
  console.log(`  Total unique customers   ${f.uniqueCustomers.toLocaleString("en-IN")}`);
  console.log(`  Total customer visits    ${f.totalVisits == null ? "Data unavailable" : f.totalVisits.toLocaleString("en-IN")}`);
  console.log(`  Total enquiries          ${f.totalEnquiries.toLocaleString("en-IN")}`);
  console.log(`  Returning customers      ${f.returningCustomers == null ? "Data unavailable" : f.returningCustomers.toLocaleString("en-IN")} (new: ${f.newCustomers ?? "-"})`);
  console.log(`  Highest spending         ${f.highestSpender ? `${f.highestSpender.name} ${inr(f.highestSpender.spent)}` : "Data unavailable"}`);
  console.log(`  Most frequent visitor    ${f.mostFrequentVisitor ? `${f.mostFrequentVisitor.name} (${f.mostFrequentVisitor.visits} visits)` : "Data unavailable"}`);
  console.log(`  Average customer spend   ${f.avgSpending == null ? "Data unavailable" : inr(f.avgSpending)}`);
  console.log(`  Converted enquiries      ${f.convertedEnquiries.toLocaleString("en-IN")}`);
  console.log(`  Customers without visit data: ${(f.uniqueCustomers - f.coverage.withVisitData).toLocaleString("en-IN")}`);
})()
  .catch((e) => {
    console.error(`Error: ${String(e.message).replace(/mongodb(\+srv)?:\/\/\S+/g, "<uri>")}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect().catch(() => {}));
