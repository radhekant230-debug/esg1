const bcrypt = require("bcryptjs");
const User = require("../models/User");

/**
 * Ensures an active Manager account exists upon server startup.
 * Uses environment variables MANAGER_EMAIL, MANAGER_PASSWORD, and optional MANAGER_NAME.
 * Never overrides an existing manager's password unless explicitly instructed via SYNC_MANAGER_PASSWORD=true.
 */
async function ensureManagerAccount() {
  const managerEmail = process.env.MANAGER_EMAIL
    ? process.env.MANAGER_EMAIL.trim().toLowerCase()
    : "rahul.manager@esgofficial.com";
  const managerPassword = process.env.MANAGER_PASSWORD || "password123";
  const managerName = process.env.MANAGER_NAME ? process.env.MANAGER_NAME.trim() : "Rahul Sharma";

  try {
    const existingManager = await User.findOne({ email: managerEmail });

    if (!existingManager) {
      const hashedPassword = await bcrypt.hash(managerPassword, 10);
      await User.create({
        name: managerName,
        email: managerEmail,
        password: hashedPassword,
        role: "manager",
        isActive: true,
        isVerified: true,
      });
      console.log(`[managerBootstrap] Default manager created successfully for: ${managerEmail}`);
    } else {
      let needsSave = false;

      // Ensure proper role & active status
      if (existingManager.role !== "manager" && existingManager.role !== "admin") {
        existingManager.role = "manager";
        needsSave = true;
      }
      if (!existingManager.isActive) {
        existingManager.isActive = true;
        needsSave = true;
      }
      if (!existingManager.isVerified) {
        existingManager.isVerified = true;
        needsSave = true;
      }

      // If SYNC_MANAGER_PASSWORD=true is set in env, synchronize password
      if (process.env.SYNC_MANAGER_PASSWORD === "true") {
        existingManager.password = await bcrypt.hash(managerPassword, 10);
        needsSave = true;
        console.log(`[managerBootstrap] Manager password synchronized from environment for: ${managerEmail}`);
      }

      if (needsSave) {
        await existingManager.save();
        console.log(`[managerBootstrap] Manager permissions verified for: ${managerEmail}`);
      }
    }
  } catch (error) {
    console.error("[managerBootstrap] Failed to verify or bootstrap manager account:", error.message);
  }
}

module.exports = { ensureManagerAccount };
