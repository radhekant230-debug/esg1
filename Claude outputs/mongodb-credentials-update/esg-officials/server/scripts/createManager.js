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

  console.log("Connecting to MongoDB Atlas...");
  await require("../config/db").connectDB({ retries: 1 }); // shared, validated connection (never logs the URI)
  console.log("Connected to MongoDB Atlas.");

  // Priority: CLI args -> Environment variables -> Interactive prompt
  const args = process.argv.slice(2);
  let email = args[0] || process.env.MANAGER_EMAIL;
  let password = args[1] || process.env.MANAGER_PASSWORD;
  let name = args[2] || process.env.MANAGER_NAME || "Rahul Sharma";
  let phone = args[3] || process.env.MANAGER_PHONE || "";

  if (!email) {
    email = await prompt("Enter Manager Email (default: rahul.manager@esgofficial.com): ") || "rahul.manager@esgofficial.com";
  }
  if (!password) {
    password = await prompt("Enter Manager Password (min 6 chars): ");
  }

  email = email.trim().toLowerCase();

  if (!email || !password) {
    console.error("Error: Email and password are required.");
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("Error: Password must be at least 6 characters long.");
    process.exit(1);
  }

  const existing = await User.findOne({ email });
  const hashedPassword = await bcrypt.hash(password, 10);

  if (existing) {
    console.log(`User ${email} already exists. Updating to active manager...`);
    existing.role = "manager";
    existing.isActive = true;
    existing.isVerified = true;
    existing.password = hashedPassword;
    if (name) existing.name = name.trim();
    if (phone) existing.phone = phone.trim();
    await existing.save();
    console.log(`Success: Manager ${email} (${existing.name}) updated and password reset successfully!`);
  } else {
    const newManager = await User.create({
      name: name.trim(),
      email,
      password: hashedPassword,
      phone: phone.trim(),
      role: "manager",
      isActive: true,
      isVerified: true,
    });
    console.log(`Success: Manager ${email} (${newManager.name}) created successfully!`);
  }

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Execution failed:", err.message);
  process.exit(1);
});
