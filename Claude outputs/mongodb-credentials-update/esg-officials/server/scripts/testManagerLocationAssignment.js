const dotenv = require("dotenv");
dotenv.config();
const mongoose = require("mongoose");
const User = require("../models/User");
const SalesLocation = require("../models/sales/SalesLocation");
const SalesBusiness = require("../models/sales/SalesBusiness");
const SalesRecord = require("../models/sales/SalesRecord");
const clientController = require("../controllers/clientController");
const salesController = require("../controllers/salesController");
const { ensureSalesData } = require("../utils/salesBootstrap");

async function runTests() {
  console.log("=================================================================");
  console.log("STARTING TEST SUITE: MANAGER LOCATION ASSIGNMENT SYSTEM");
  console.log("=================================================================\n");

  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: "esg-official-clients" });
    console.log("✓ Connected to MongoDB Atlas: esg-official-clients\n");

    // 0. Bootstrap initial locations & sample businesses
    await ensureSalesData();
    console.log("✓ Bootstrap data verified.\n");

    // 1. Verify 7 Initial Locations in SalesLocation
    console.log("TEST 1: Verifying 7 Initial Required Locations...");
    const expectedLocations = [
      { city: "Raichur", state: "Karnataka" },
      { city: "Ranchi", state: "Jharkhand" },
      { city: "Dhanbad", state: "Jharkhand" },
      { city: "Jaipur", state: "Rajasthan" },
      { city: "Coimbatore", state: "Tamil Nadu" },
      { city: "Guwahati", state: "Assam" },
      { city: "Bhubaneswar", state: "Odisha" },
    ];

    for (const exp of expectedLocations) {
      const found = await SalesLocation.findOne({
        city: new RegExp(`^${exp.city}$`, "i"),
        state: new RegExp(`^${exp.state}$`, "i"),
      });
      if (!found) {
        throw new Error(`Missing expected location: ${exp.city}, ${exp.state}`);
      }
    }
    console.log("✓ All 7 required initial locations present in SalesLocation collection.\n");

    // Find Admin user
    const adminUser = await User.findOne({ role: "admin" });
    if (!adminUser) throw new Error("Admin user not found in database.");

    // Clean up test manager if exists
    const testEmail = "test.manager.cbe@esgofficial.com";
    await User.deleteOne({ email: testEmail });

    // 2. Test Add Manager Form: Create Manager with Location Assignment & Auto State Detection
    console.log("TEST 2: Creating Manager with Location (Coimbatore, Tamil Nadu)...");
    const coimbatoreBusinesses = await SalesBusiness.find({ city: "Coimbatore" });
    const assignedBizIds = coimbatoreBusinesses.map((b) => b._id.toString());

    let createResData = null;
    let createStatusCode = 200;
    const createReq = {
      user: adminUser,
      body: {
        name: "Karthik Subramanian",
        email: testEmail,
        password: "Password@123",
        phone: "+91 94433 11223",
        assignedCity: "Coimbatore", // Test state auto-detection
        assignedBusinesses: assignedBizIds,
        isActive: true,
      },
    };
    const createRes = {
      status(code) { createStatusCode = code; return this; },
      json(data) { createResData = data; return this; },
    };

    await clientController.createManager(createReq, createRes);

    if (createStatusCode !== 201) {
      throw new Error(`Failed to create manager. Status: ${createStatusCode}, Message: ${createResData?.message}`);
    }

    console.log(`✓ Manager created successfully: ${createResData.manager.name}`);
    console.log(`  Assigned City: ${createResData.manager.assignedCity}`);
    console.log(`  Assigned State (auto-detected): ${createResData.manager.assignedState}`);
    console.log(`  Assigned Businesses Count: ${createResData.manager.assignedBusinessesCount}`);

    if (createResData.manager.assignedState !== "Tamil Nadu") {
      throw new Error(`Auto state detection failed. Expected 'Tamil Nadu', got '${createResData.manager.assignedState}'`);
    }

    const createdManagerId = createResData.manager._id;

    // 3. Test GetAllManagers: Verify location and business counts in admin list
    console.log("\nTEST 3: Verifying Manager List Data (getAllManagers)...");
    let allManagersData = null;
    const getReq = { user: adminUser };
    const getRes = {
      status(code) { return this; },
      json(data) { allManagersData = data; return this; },
    };
    await clientController.getAllManagers(getReq, getRes);

    const targetManager = allManagersData.find((m) => m.email === testEmail);
    if (!targetManager) throw new Error("Created manager not found in getAllManagers list.");
    console.log(`✓ Manager found in list: ${targetManager.name}`);
    console.log(`  Assigned State: ${targetManager.assignedState}`);
    console.log(`  Assigned City: ${targetManager.assignedCity}`);
    console.log(`  Assigned Businesses Count: ${targetManager.assignedBusinessesCount}`);
    console.log(`  Account Status: ${targetManager.isActive ? "Active" : "Inactive"}`);

    // 4. Test Manager Dashboard: Verify Coimbatore Manager Scoping
    console.log("\nTEST 4: Verifying Manager Dashboard Scoping (Coimbatore Manager)...");
    const managerDoc = await User.findById(createdManagerId);
    let dashboardData = null;
    const dashReq = {
      user: managerDoc,
      query: { year: "2026", month: "10" },
    };
    const dashRes = {
      status(code) { return this; },
      json(data) { dashboardData = data; return this; },
    };
    await salesController.getSalesDashboard(dashReq, dashRes);

    console.log(`✓ Primary City in Dashboard: ${dashboardData.managerInfo.primaryCity}`);
    console.log(`✓ Primary State in Dashboard: ${dashboardData.managerInfo.primaryState}`);
    console.log(`✓ Authorized Businesses in Dashboard: ${dashboardData.businessPerformance.length}`);
    for (const b of dashboardData.businessPerformance) {
      if (b.city !== "Coimbatore") {
        throw new Error(`Cross-city leak! Manager saw business in ${b.city} instead of Coimbatore.`);
      }
    }
    console.log("✓ Strict city scoping verified: 100% of dashboard businesses belong to Coimbatore.");

    // 5. Test Backend Security Requirement 6: Block Cross-City Access
    console.log("\nTEST 5: Testing Backend Security (Attempting unauthorized cross-city query to Dhanbad)...");
    let forbiddenStatusCode = 200;
    let forbiddenData = null;
    const exploitReq = {
      user: managerDoc,
      query: { year: "2026", month: "10", city: "Dhanbad" }, // Coimbatore manager attempting to view Dhanbad
    };
    const exploitRes = {
      status(code) { forbiddenStatusCode = code; return this; },
      json(data) { forbiddenData = data; return this; },
    };
    await salesController.getSalesDashboard(exploitReq, exploitRes);

    if (forbiddenStatusCode !== 403) {
      throw new Error(`Security breach! Expected 403 Forbidden for cross-city query, got ${forbiddenStatusCode}`);
    }
    console.log(`✓ Cross-city query blocked by backend with 403 Forbidden: "${forbiddenData.message}"`);

    // 6. Test Edit Location: Reassign Location from Coimbatore to Raichur, Karnataka
    console.log("\nTEST 6: Reassigning Manager Location to Raichur, Karnataka...");
    const initialRecordCount = await SalesRecord.countDocuments();

    let updateResData = null;
    let updateStatusCode = 200;
    const updateReq = {
      user: adminUser,
      params: { id: createdManagerId },
      body: {
        assignedCity: "Raichur",
        assignedState: "Karnataka",
        assignedBusinesses: [], // Empty to test city-wide default assignment
      },
    };
    const updateRes = {
      status(code) { updateStatusCode = code; return this; },
      json(data) { updateResData = data; return this; },
    };
    await clientController.updateManagerLocation(updateReq, updateRes);

    console.log(`✓ Update Location Status: ${updateStatusCode}`);
    console.log(`  New City: ${updateResData.manager.assignedCity}`);
    console.log(`  New State: ${updateResData.manager.assignedState}`);

    // Verify historical sales records are untouched
    const afterUpdateRecordCount = await SalesRecord.countDocuments();
    if (afterUpdateRecordCount !== initialRecordCount) {
      throw new Error("Historical sales records were modified or deleted!");
    }
    console.log("✓ Historical sales records preserved intact (0 records lost).");

    // 7. Verify Manager Dashboard after location change
    console.log("\nTEST 7: Verifying Dashboard after Reassignment (Raichur Manager)...");
    const updatedManagerDoc = await User.findById(createdManagerId);
    let raichurDashboardData = null;
    const raichurDashReq = {
      user: updatedManagerDoc,
      query: { year: "2026", month: "10" },
    };
    const raichurDashRes = {
      status(code) { return this; },
      json(data) { raichurDashboardData = data; return this; },
    };
    await salesController.getSalesDashboard(raichurDashReq, raichurDashRes);

    console.log(`✓ Updated Primary City: ${raichurDashboardData.managerInfo.primaryCity}`);
    console.log(`✓ Updated Primary State: ${raichurDashboardData.managerInfo.primaryState}`);
    console.log(`✓ Raichur Businesses count: ${raichurDashboardData.businessPerformance.length}`);
    for (const b of raichurDashboardData.businessPerformance) {
      if (b.city !== "Raichur") {
        throw new Error(`Scoping error after reassignment! Found business in ${b.city}`);
      }
    }
    console.log("✓ Dashboard seamlessly transitioned to Raichur without code restart.");

    // 8. Test Toggle Status (Activate / Deactivate)
    console.log("\nTEST 8: Testing Activate / Deactivate Toggle...");
    let toggleResData = null;
    const toggleReq = {
      user: adminUser,
      params: { id: createdManagerId },
      body: { isActive: false },
    };
    const toggleRes = {
      status(code) { return this; },
      json(data) { toggleResData = data; return this; },
    };
    await clientController.toggleManagerStatus(toggleReq, toggleRes);

    console.log(`✓ Status toggled to: ${toggleResData.isActive ? "Active" : "Inactive"}`);
    const checkDoc = await User.findById(createdManagerId);
    if (checkDoc.isActive !== false) throw new Error("Manager isActive was not updated to false.");

    // Re-activate
    toggleReq.body = { isActive: true };
    await clientController.toggleManagerStatus(toggleReq, toggleRes);
    const checkDoc2 = await User.findById(createdManagerId);
    if (checkDoc2.isActive !== true) throw new Error("Manager isActive was not updated to true.");
    console.log("✓ Account successfully re-activated.");

    // 9. Clean up test manager
    await User.deleteOne({ _id: createdManagerId });
    console.log("\n✓ Test manager cleaned up successfully.");

    console.log("\n=================================================================");
    console.log("ALL TESTS PASSED WITH 100% SUCCESS!");
    console.log("=================================================================\n");

    process.exit(0);
  } catch (err) {
    console.error("\n❌ TEST SUITE FAILED:", err);
    process.exit(1);
  }
}

runTests();
