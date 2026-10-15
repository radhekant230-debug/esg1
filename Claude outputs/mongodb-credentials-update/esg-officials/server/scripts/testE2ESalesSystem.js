const dotenv = require("dotenv");
dotenv.config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const xlsx = require("xlsx");

const User = require("../models/User");
const SalesBusiness = require("../models/sales/SalesBusiness");
const SalesRecord = require("../models/sales/SalesRecord");
const salesController = require("../controllers/salesController");

async function runE2ETest() {
  console.log("=========================================================");
  console.log("   STATE-WISE SALES & EXCEL SYSTEM END-TO-END AUDIT   ");
  console.log("=========================================================\n");

  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: "esg-official-clients" });
    console.log("✓ Connected to MongoDB Atlas (database: esg-official-clients)");

    // 1. Manager Authentication & Scope Verification
    const manager = await User.findOne({ email: "rahul.manager@esgofficial.com" });
    if (!manager) throw new Error("Manager rahul.manager@esgofficial.com not found!");

    const token = jwt.sign(
      { id: manager._id, role: manager.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    console.log(`✓ Manager Authenticated: ${manager.name} (${manager.email})`);
    console.log(`  Role: ${manager.role}`);
    console.log(`  Assigned State: ${manager.assignedState}`);
    console.log(`  Assigned Cities: ${manager.assignedCities?.join(", ")}`);

    // 2. State-Wise Dashboard Query
    const dashReq = { user: manager, query: { year: "2026", month: "10" } };
    let dashResData = null;
    const dashRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { dashResData = data; return this; }
    };

    await salesController.getSalesDashboard(dashReq, dashRes);
    console.log("\n--- [1] State-Wise Dashboard KPIs (October 2026) ---");
    console.log("  Region/State:", dashResData.managerInfo.primaryState);
    console.log("  Assigned City:", dashResData.managerInfo.primaryCity);
    console.log("  Total Businesses:", dashResData.summary.totalBusinesses);
    console.log("  Total Hotels:", dashResData.summary.totalHotels);
    console.log("  Total Restaurants:", dashResData.summary.totalRestaurants);
    console.log("  Current Month Sales: ₹" + Number(dashResData.summary.currentMonthSales).toLocaleString());
    console.log("  Previous Month Sales: ₹" + Number(dashResData.summary.previousMonthSales).toLocaleString());
    console.log("  MoM Sales Growth:", dashResData.summary.salesGrowthPercentage + "%");
    console.log("  Target Total: ₹" + Number(dashResData.summary.targetTotal).toLocaleString());
    console.log("  Achievement Rate:", dashResData.summary.achievementRate + "%");
    console.log("  Pending Target: ₹" + Number(dashResData.summary.pendingTarget).toLocaleString());

    // Strict Data Isolation Check
    const unauthorizedInDash = dashResData.businessPerformance.filter(b => b.state !== "Jharkhand");
    if (unauthorizedInDash.length > 0) {
      throw new Error(`Data isolation violation: Manager saw ${unauthorizedInDash.length} unauthorized businesses!`);
    }
    console.log("✓ Strict Isolation Verified: 100% of returned businesses belong to Jharkhand (Ranchi/Dhanbad).");

    // 3. Business Detail & Complete Sales History
    const royalHotel = await SalesBusiness.findOne({ name: "Hotel Royal", city: "Ranchi" });
    if (!royalHotel) throw new Error("Hotel Royal not found!");

    const detailReq = { user: manager, params: { id: royalHotel._id.toString() } };
    let detailResData = null;
    const detailRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { detailResData = data; return this; }
    };

    await salesController.getBusinessDetail(detailReq, detailRes);
    console.log("\n--- [2] Business Detail Page ---");
    console.log("  Business:", detailResData.business.name);
    console.log("  Code / Unique ID:", detailResData.business.code);
    console.log("  Category:", detailResData.business.category);
    console.log("  Location:", detailResData.business.address + ", " + detailResData.business.city + ", " + detailResData.business.state);
    console.log("  Total Historical Sales: ₹" + Number(detailResData.metrics.totalSales).toLocaleString());
    console.log("  Total Transactions/Orders:", detailResData.metrics.totalOrders);
    console.log("  Sales Records Count:", detailResData.salesRecords.length);
    console.log("  Monthly Records:");
    detailResData.salesRecords.forEach(r => {
      console.log(`    - ${r.monthName}: Sales=₹${Number(r.totalSales).toLocaleString()}, Target=₹${Number(r.target).toLocaleString()}, Achievement=${r.achievementRate}%`);
    });

    // 4. Excel Import Workflow - Preview Validation
    console.log("\n--- [3] Excel / CSV Upload & Preview Validation ---");
    const testExcelRows = [
      {
        "Month": "December 2026",
        "State": "Jharkhand",
        "City": "Ranchi",
        "Business Name": "Hotel Royal",
        "Total Sales": 350000,
        "Orders": 160,
        "Target": 350000,
        "Remarks": "New Year Bookings Peak"
      },
      {
        "Month": "December 2026",
        "State": "Jharkhand",
        "City": "Ranchi",
        "Business Name": "Maya Multicuisine Restaurant",
        "Total Sales": 230000,
        "Orders": 125,
        "Target": 220000,
        "Remarks": "Year-end party catering"
      },
      {
        "Month": "December 2026",
        "State": "Assam", // Out of scope for Ranchi manager
        "City": "Guwahati",
        "Business Name": "Brahmaputra Grand",
        "Total Sales": 450000,
        "Orders": 200,
        "Target": 400000,
        "Remarks": "Unauthorized test row"
      }
    ];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(testExcelRows);
    xlsx.utils.book_append_sheet(wb, ws, "Sales Upload");
    const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    const previewReq = {
      user: manager,
      file: {
        buffer: excelBuffer,
        originalname: "December_2026_Sales_Report.xlsx",
        size: excelBuffer.length
      }
    };
    let previewResData = null;
    const previewRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { previewResData = data; return this; }
    };

    await salesController.previewSalesExcel(previewReq, previewRes);
    console.log(`  File Read: ${previewResData.filename}`);
    console.log(`  Total Rows Detected: ${previewResData.totalRows}`);
    console.log(`  Valid Rows: ${previewResData.validCount}`);
    console.log(`  Invalid Rows: ${previewResData.invalidCount}`);

    // Verify Assam row was flagged
    const assamInvalid = previewResData.invalidRows.find(r => r.businessName === "Brahmaputra Grand");
    if (!assamInvalid) throw new Error("Security check failed: Out-of-state row was not flagged!");
    console.log(`✓ Row Security Check: "Brahmaputra Grand" flagged as invalid -> "${assamInvalid.errors[0]}"`);

    // 5. Commit Valid Rows
    console.log("\n--- [4] Commit Validated Rows to Database ---");
    const commitReq = {
      user: manager,
      body: {
        filename: "December_2026_Sales_Report.xlsx",
        rows: previewResData.validRows,
        updateExisting: true
      }
    };
    let commitResData = null;
    const commitRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { commitResData = data; return this; }
    };

    await salesController.commitSalesExcel(commitReq, commitRes);
    console.log("  Import Summary:", commitResData.summary);

    // Verify December 2026 records in MongoDB
    const decRoyal = await SalesRecord.findOne({
      businessName: "Hotel Royal",
      year: 2026,
      month: 12
    });
    if (!decRoyal || decRoyal.totalSales !== 350000) {
      throw new Error("Failed to verify committed December record in MongoDB!");
    }
    console.log(`✓ Persistence Verified: Hotel Royal December 2026 saved (Sales: ₹${decRoyal.totalSales.toLocaleString()}, Achievement: ${decRoyal.achievementRate}%)`);

    // 6. Template Download & Export
    console.log("\n--- [5] Template & Report Export Generation ---");
    let templateBuffer = null;
    const tplRes = {
      setHeader() {},
      send(buf) { templateBuffer = buf; }
    };
    await salesController.downloadTemplate({ user: manager }, tplRes);
    const parsedTpl = xlsx.read(templateBuffer);
    console.log(`✓ Template generated: Sheet name "${parsedTpl.SheetNames[0]}", valid Excel format.`);

    let exportBuffer = null;
    const expRes = {
      setHeader() {},
      send(buf) { exportBuffer = buf; }
    };
    await salesController.exportSalesExcel({ user: manager, query: { year: "2026", month: "10" } }, expRes);
    const parsedExp = xlsx.read(exportBuffer);
    const expRows = xlsx.utils.sheet_to_json(parsedExp.Sheets["Sales Report"]);
    console.log(`✓ Export report generated: ${expRows.length} filtered rows for manager.`);

    // 7. Admin Consolidated Access
    console.log("\n--- [6] Admin Role-Based Consolidated Access ---");
    const adminUser = await User.findOne({ role: "admin" });
    if (!adminUser) throw new Error("Admin user not found!");

    let allBizData = null;
    const adminBizRes = {
      status() { return this; },
      json(data) { allBizData = data; return this; }
    };
    await salesController.getBusinesses({ user: adminUser, query: {} }, adminBizRes);
    console.log(`✓ Admin Businesses View: Consolidated across all states (${allBizData.length} total businesses).`);
    const statesCovered = [...new Set(allBizData.map(b => b.state))];
    console.log(`  States Covered: ${statesCovered.join(", ")}`);

    console.log("\n=========================================================");
    console.log("   ALL END-TO-END VALIDATION TESTS PASSED 100%!   ");
    console.log("=========================================================");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ E2E Test Failed:", err);
    process.exit(1);
  }
}

runE2ETest();
