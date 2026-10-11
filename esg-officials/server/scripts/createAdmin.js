require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const readline = require("readline");
const User = require("../models/User");

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function run() {
  if (!process.env.MONGO_URI) {
    console.error("Error: MONGO_URI is missing from server/.env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI, { dbName: "esg-official-clients" });
  console.log("Connected to MongoDB.");

  // Priority: CLI args -> Environment variables -> Interactive prompt
  const args = process.argv.slice(2);
  let email = args[0] || process.env.ADMIN_EMAIL;
  let password = args[1] || process.env.ADMIN_PASSWORD;
  let name = args[2] || process.env.ADMIN_NAME || "ESG Administrator";

  if (!email) {
    email = await prompt("Enter Admin Email: ");
  }
  if (!password) {
    password = await prompt("Enter Admin Password (min 8 chars): ");
  }

  email = email.trim().toLowerCase();

  if (!email || !password) {
    console.error("Error: Email and password are required.");
    process.exit(1);
  }

  const existing = await User.findOne({ email });

  const hashedPassword = await bcrypt.hash(password, 10);

  if (existing) {
    console.log(`User ${email} already exists. Updating to active administrator...`);
    existing.role = "admin";
    existing.isActive = true;
    existing.isVerified = true;
    existing.password = hashedPassword;
    if (name) existing.name = name;
    await existing.save();
    console.log(`Success: Administrator ${email} updated successfully!`);
  } else {
    await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
      isActive: true,
      isVerified: true,
    });
    console.log(`Success: Administrator ${email} created successfully!`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Execution failed:", err.message);
  process.exit(1);
});
