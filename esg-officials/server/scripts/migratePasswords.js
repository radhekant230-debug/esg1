require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const User = require("../models/User");

async function migrate() {
  if (!process.env.MONGO_URI) {
    console.error("Error: MONGO_URI is missing from environment.");
    process.exit(1);
  }

  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(process.env.MONGO_URI, { dbName: "esg-official-clients" });
  console.log("Connected to MongoDB.");

  const allUsers = await User.find({});
  console.log(`Found ${allUsers.length} total user accounts in database.`);

  // 1. Safe Backup of User Records (sanitized without plaintext passwords)
  const backupDir = path.join(__dirname, "../backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `users_backup_${timestamp}.json`);

  const backupData = allUsers.map((u) => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    clientId: u.clientId || null,
    isActive: u.isActive,
    isVerified: u.isVerified,
    hasBcryptHash: /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(u.password),
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }));

  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), "utf8");
  console.log(`✓ Safe user metadata backup written to: ${backupPath}`);

  // 2. Inspect and migrate any plaintext passwords
  let migratedCount = 0;
  let alreadyHashedCount = 0;

  for (const user of allUsers) {
    const isBcrypt = typeof user.password === "string" && 
      (user.password.startsWith("$2a$") || user.password.startsWith("$2b$") || user.password.startsWith("$2y$")) && 
      user.password.length === 60;
    if (!isBcrypt) {
      console.log(`Migrating plaintext password for user: ${user.email} (${user.role})...`);
      const hashedPassword = await bcrypt.hash(user.password, 10);
      user.password = hashedPassword;
      await user.save();
      migratedCount++;
    } else {
      alreadyHashedCount++;
    }
  }

  console.log(`\nMigration Summary:`);
  console.log(`- Already securely hashed: ${alreadyHashedCount}`);
  console.log(`- Migrated plaintext passwords to bcrypt: ${migratedCount}`);
  console.log(`- Total accounts verified: ${allUsers.length}`);

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
