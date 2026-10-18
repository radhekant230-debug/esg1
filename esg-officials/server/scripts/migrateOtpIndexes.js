/**
 * Replaces the OTP collection's fixed 5-minute TTL index (createdAt_1,
 * expireAfterSeconds 300) with the expiresAt TTL index, so OTP_EXPIRY_MINUTES
 * applies. Only touches indexes of the otps collection; no documents change.
 *
 *   npm run migrate:otp
 */
require("dotenv").config();
const mongoose = require("mongoose");
const OTP = require("../models/OTP");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || "esg-official-clients" });
  const indexes = await OTP.collection.indexes().catch(() => []);
  const old = indexes.find((i) => i.key && i.key.createdAt === 1 && Object.keys(i.key).length === 1 && i.expireAfterSeconds !== undefined);
  if (old) {
    await OTP.collection.dropIndex(old.name);
    console.log(`Dropped ${old.name} (TTL ${old.expireAfterSeconds}s)`);
  } else console.log("No fixed createdAt TTL index found.");
  await OTP.createIndexes();
  console.log("OTP indexes:", (await OTP.collection.indexes()).map((i) => i.name).join(", "));
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error("OTP index migration failed:", e.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
