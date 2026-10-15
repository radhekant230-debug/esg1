const dotenv = require("dotenv");
dotenv.config();
const mongoose = require("mongoose");
const { ensureSalesData } = require("../utils/salesBootstrap");
const User = require("../models/User");
const SalesBusiness = require("../models/sales/SalesBusiness");
const SalesRecord = require("../models/sales/SalesRecord");

async function runTest() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI, { dbName: "esg-official-clients" });
    console.log("Connected!");

    console.log("Running ensureSalesData()...");
    await ensureSalesData();
    console.log("ensureSalesData completed successfully!");

    const manager = await User.findOne({ email: "rahul.manager@esgofficial.com" });
    console.log("Manager found:", {
      email: manager.email,
      role: manager.role,
      assignedState: manager.assignedState,
      assignedCity: manager.assignedCity,
      assignedCities: manager.assignedCities
    });

    const businesses = await SalesBusiness.find({});
    console.log(`Total businesses in DB: ${businesses.length}`);
    businesses.forEach(b => console.log(` - [${b.code}] ${b.name} (${b.category}) in ${b.city}, ${b.state}`));

    const records = await SalesRecord.find({}).populate("business");
    console.log(`Total sales records in DB: ${records.length}`);
    records.forEach(r => console.log(` - ${r.monthName} ${r.year} | ${r.business?.name}: Sales=${r.totalSales}, Target=${r.target}, Achievement=${r.achievementRate}%`));

    await mongoose.disconnect();
    console.log("Test finished cleanly!");
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

runTest();
