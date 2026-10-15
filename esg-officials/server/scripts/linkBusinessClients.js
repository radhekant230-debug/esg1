/**
 * Links sales businesses (e.g. Ranchi / Dhanbad outlets) to client portal
 * accounts so manager uploads appear in the right Client Portal.
 *
 *   node scripts/linkBusinessClients.js                       # list businesses, links and suggestions
 *   node scripts/linkBusinessClients.js --business BIZ-JH-RAN-0001 --client owner@hotel.com
 *   node scripts/linkBusinessClients.js --business BIZ-JH-RAN-0001 --unlink
 *
 * Admins can do the same from Admin → State Sales → edit business → "Client portal account".
 */
require("dotenv").config();
const mongoose = require("mongoose");
const SalesBusiness = require("../models/sales/SalesBusiness");
const User = require("../models/User");
const { audit } = require("../services/audit");

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
};
const norm = (s) => String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || "esg-official-clients" });
  const code = arg("business");
  if (code) {
    const biz = await SalesBusiness.findOne({ code: code.toUpperCase() });
    if (!biz) throw new Error(`Business ${code} not found`);
    const before = biz.clientAccount;
    if (process.argv.includes("--unlink")) biz.clientAccount = null;
    else {
      const email = arg("client");
      const client = await User.findOne({ email: String(email || "").toLowerCase(), role: "client" });
      if (!client) throw new Error(`Client user ${email} not found`);
      biz.clientAccount = client._id;
    }
    await biz.save();
    await audit({ entityType: "SalesBusiness", entityId: biz._id, action: "CLIENT_ACCOUNT_LINKED_CLI", before: { clientAccount: before }, after: { clientAccount: biz.clientAccount } });
    console.log(`${biz.name} (${biz.city}) -> ${biz.clientAccount || "unlinked"}`);
  } else {
    const [businesses, clients] = await Promise.all([
      SalesBusiness.find({}).populate("clientAccount", "email companyName name").sort({ city: 1, name: 1 }).lean(),
      User.find({ role: "client" }).select("email companyName name").lean(),
    ]);
    console.table(
      businesses.map((b) => {
        const guess = !b.clientAccount && clients.find((c) => norm(c.companyName) && (norm(c.companyName) === norm(b.name) || norm(c.companyName).includes(norm(b.name))));
        return {
          code: b.code,
          business: b.name,
          city: b.city,
          linkedClient: b.clientAccount ? b.clientAccount.email : "",
          suggestion: guess ? guess.email : "",
        };
      })
    );
  }
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
