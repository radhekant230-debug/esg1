const bcrypt = require("bcryptjs");
const User = require("../models/User");

/**
 * Ensures an administrator account exists upon server startup.
 * Uses environment variables ADMIN_EMAIL, ADMIN_PASSWORD, and optional ADMIN_NAME.
 * Never overrides an existing admin's password unless explicitly instructed via SYNC_ADMIN_PASSWORD=true.
 */
async function ensureAdminAccount() {
  const adminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim().toLowerCase() : null;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME ? process.env.ADMIN_NAME.trim() : "ESG Administrator";

  try {
    const existingAdminCount = await User.countDocuments({ role: "admin" });

    // If ADMIN_EMAIL and ADMIN_PASSWORD are provided in environment
    if (adminEmail && adminPassword) {
      const existingUser = await User.findOne({ email: adminEmail });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await User.create({
          name: adminName,
          email: adminEmail,
          password: hashedPassword,
          role: "admin",
          isActive: true,
          isVerified: true,
        });
        console.log(`[adminBootstrap] Admin account created successfully for: ${adminEmail}`);
      } else {
        // If user exists, ensure they have admin privileges
        let needsSave = false;
        if (existingUser.role !== "admin") {
          existingUser.role = "admin";
          needsSave = true;
        }
        if (!existingUser.isActive) {
          existingUser.isActive = true;
          needsSave = true;
        }
        if (!existingUser.isVerified) {
          existingUser.isVerified = true;
          needsSave = true;
        }
        if (process.env.SYNC_ADMIN_PASSWORD === "true") {
          existingUser.password = await bcrypt.hash(adminPassword, 10);
          needsSave = true;
          console.log(`[adminBootstrap] Admin password synced from environment variable for: ${adminEmail}`);
        }
        if (needsSave) {
          await existingUser.save();
          console.log(`[adminBootstrap] Admin permissions verified for: ${adminEmail}`);
        }
      }
      return;
    }

    // If no credentials supplied in env, report status
    if (existingAdminCount === 0) {
      console.warn(
        "[adminBootstrap] WARNING: No admin account found in the database. " +
        "Define ADMIN_EMAIL and ADMIN_PASSWORD in your environment variables, or run 'npm run create-admin' to create one."
      );
    } else {
      console.log(`[adminBootstrap] Verified ${existingAdminCount} administrator account(s) present in database.`);
    }
  } catch (error) {
    console.error("[adminBootstrap] Failed to verify or bootstrap admin account:", error.message);
  }
}

module.exports = { ensureAdminAccount };
