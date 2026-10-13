const dotenv = require("dotenv");
dotenv.config();
const mongoose = require("mongoose");
const User = require("../models/User");
const salesController = require("../controllers/salesController");
const xlsx = require("xlsx");

async function runApiTest() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: "esg-official-clients" });
    const manager = await User.findOne({ email: "rahul.manager@esgofficial.com" });

    console.log("Testing getSalesDashboard for Rahul...");
    let dashboardData = null;
    const mockReq = {
      user: manager,
      query: { year: "2026", month: "10" }
    };
    const mockRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { dashboardData = data; return this; }
    };

    await salesController.getSalesDashboard(mockReq, mockRes);
    console.log("Dashboard response status:", mockRes.statusCode || 200);
    console.log("Scope:", dashboardData?.scope);
    console.log("KPIs:", dashboardData?.kpis);
    console.log("Top Performers count:", dashboardData?.topPerformers?.length);
    console.log("Lowest Performers count:", dashboardData?.lowestPerformers?.length);
    console.log("Trend points count:", dashboardData?.charts?.monthlyTrend?.length);
    console.log("Business bars count:", dashboardData?.charts?.businessSales?.length);

    // Verify strict isolation: none of the businesses should be outside Jharkhand
    const nonJharkhand = dashboardData?.businesses?.filter(b => b.state !== "Jharkhand");
    if (nonJharkhand && nonJharkhand.length > 0) {
      throw new Error(`Data isolation failed! Found non-Jharkhand businesses: ${JSON.stringify(nonJharkhand)}`);
    } else {
      console.log("✓ Strict data isolation verified: All returned businesses belong to Jharkhand.");
    }

    // Test Excel preview with a valid file buffer
    console.log("\nTesting Excel preview workflow...");
    const sampleRows = [
      {
        "Month": "November 2026",
        "State": "Jharkhand",
        "City": "Ranchi",
        "Business Name": "Hotel Royal",
        "Total Sales": 310000,
        "Orders": 150,
        "Target": 320000,
        "Remarks": "Festival surge"
      },
      {
        "Month": "November 2026",
        "State": "Rajasthan", // Should fail authorization because manager is Jharkhand only
        "City": "Jaipur",
        "Business Name": "Royal Rajputana Palace",
        "Total Sales": 400000,
        "Orders": 200,
        "Target": 400000,
        "Remarks": "Unauthorized state test"
      }
    ];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(sampleRows);
    xlsx.utils.book_append_sheet(wb, ws, "Sales");
    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    const previewReq = {
      user: manager,
      file: {
        buffer,
        originalname: "Test_Sales_Upload.xlsx",
        size: buffer.length
      }
    };
    let previewData = null;
    const previewRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { previewData = data; return this; }
    };

    await salesController.previewSalesExcel(previewReq, previewRes);
    console.log("Preview status:", previewRes.statusCode || 200);
    console.log("Valid rows:", previewData?.validCount);
    console.log("Invalid rows:", previewData?.invalidCount);
    if (previewData?.invalidRows?.length > 0) {
      console.log("Invalid row errors:", previewData.invalidRows.map(r => r.errors));
    }

    // Verify row 2 failed authorization
    const unauthRow = previewData?.invalidRows?.find(r => r.businessName === "Royal Rajputana Palace");
    if (unauthRow) {
      console.log("✓ Permission check passed: Royal Rajputana Palace was correctly flagged as unauthorized for Ranchi manager.");
    } else {
      throw new Error("Authorization check failed! Jaipur row was not flagged as invalid.");
    }

    // Test commit of valid rows
    console.log("\nTesting commit workflow...");
    const commitReq = {
      user: manager,
      body: {
        filename: "Test_Sales_Upload.xlsx",
        rows: previewData.validRows,
        updateExisting: true
      }
    };
    let commitData = null;
    const commitRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { commitData = data; return this; }
    };

    await salesController.commitSalesExcel(commitReq, commitRes);
    console.log("Commit status:", commitRes.statusCode || 200);
    console.log("Commit summary:", commitData?.summary);

    // Verify the record landed in MongoDB
    const committedRecord = await mongoose.model("SalesRecord").findOne({
      businessName: "Hotel Royal",
      year: 2026,
      month: 11
    });
    if (committedRecord && committedRecord.totalSales === 310000) {
      console.log("✓ Database persistence verified: Hotel Royal November 2026 sales record saved with totalSales=310000, achievementRate=" + committedRecord.achievementRate + "%");
    } else {
      throw new Error("Record was not found in MongoDB!");
    }

    await mongoose.disconnect();
    console.log("\nAll API logic & security checks passed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("API test failed:", err);
    process.exit(1);
  }
}

runApiTest();
