/**
 * Fills ClientLead.customerStats for customers imported from a POS customer
 * list BEFORE structured visit/spend fields existed. Reads the import note
 * ("Imported from customer list: 12 visits · avg spend ₹450 · total spent ₹5,400 …").
 *
 * Only notes that report a visit count are used (those come from a customer
 * export, so "total spent" there is the customer's actual spend). Leads that
 * already have customerStats are never touched. Last visit is taken from the
 * enquiry date only when that date came from the file (it differs from the
 * moment the lead was created).
 *
 *   node scripts/backfillCustomerStats.js            # dry run: counts only
 *   node scripts/backfillCustomerStats.js --apply    # write
 *   --client <userId>                                # one client only
 *
 * Re-importing the same customer file also fills these fields.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const ClientLead = require("../models/portal/ClientLead");

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const clientArg = argv.includes("--client") ? argv[argv.indexOf("--client") + 1] : null;
const { parseImportNote: parseNote } = require("../services/portal/customerInsights");

(async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set (server/.env).");
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || "esg-official-clients" });
  const filter = { "notes.text": /^Imported from customer list:/, $or: [{ customerStats: null }, { "customerStats.source": { $in: [null, ""] } }] };
  if (clientArg) filter.client = new mongoose.Types.ObjectId(clientArg);
  let seen = 0;
  let fill = 0;
  let ops = [];
  const flush = async () => {
    if (apply && ops.length) await ClientLead.bulkWrite(ops, { ordered: false });
    ops = [];
  };
  for await (const lead of ClientLead.find(filter).select("notes enquiryDate createdAt customerStats").lean().cursor()) {
    seen += 1;
    const note = (lead.notes || []).find((n) => String(n.text).startsWith("Imported from customer list:"));
    const stats = note && parseNote(note.text);
    if (!stats) continue;
    const fromFile = lead.enquiryDate && lead.createdAt && Math.abs(new Date(lead.enquiryDate) - new Date(lead.createdAt)) > 2 * 60 * 1000;
    ops.push({ updateOne: { filter: { _id: lead._id, $or: [{ customerStats: null }, { "customerStats.source": { $in: [null, ""] } }] }, update: { $set: { customerStats: { ...stats, lastVisitAt: fromFile ? lead.enquiryDate : null, source: "customer_list_note", updatedAt: new Date() } } } } });
    fill += 1;
    if (ops.length >= 1000) await flush();
  }
  await flush();
  console.log(`${seen} imported enquiries checked; ${fill} ${apply ? "updated" : "would be updated (dry run — add --apply)"}.`);
})()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect().catch(() => {}));

