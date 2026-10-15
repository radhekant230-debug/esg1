require("dotenv").config();
const assert = require("assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const SalesBusiness = require("../models/sales/SalesBusiness");
const SalesRecord = require("../models/sales/SalesRecord");
const SalesImportJob = require("../models/sales/SalesImportJob");

(async () => {
  try {
    console.log("==================================================");
    console.log(" TESTING MANAGER IMPORT BUTTON FLOW & SYNC        ");
    console.log("==================================================");

    await mongoose.connect(process.env.MONGO_URI, { dbName: "esg-official-clients" });
    console.log("Connected to MongoDB Atlas: esg-official-clients");

    const manager = await User.findOne({ role: "manager" }).lean();
    assert.ok(manager, "Manager user must exist in DB");

    const client = await User.findOne({ role: "client" }).lean();
    assert.ok(client, "Client user must exist in DB");

    let business = await SalesBusiness.findOne({ clientAccount: client._id }).lean();
    if (!business) {
      business = await SalesBusiness.findOne({}).lean();
      await SalesBusiness.updateOne({ _id: business._id }, { $set: { clientAccount: client._id } });
      business.clientAccount = client._id;
    }

    const secret = process.env.JWT_SECRET;
    const managerToken = jwt.sign({ id: manager._id, role: manager.role }, secret, { expiresIn: "1h" });
    const clientToken = jwt.sign({ id: client._id, role: client.role }, secret, { expiresIn: "1h" });

    const baseUrl = "http://localhost:5000/api";
    console.log(`Testing against live backend at: ${baseUrl}`);

    // 1. Prepare a 7-day CSV
    const testTxnId = `BTN-TEST-${Date.now()}`;
    const csvContent =
      "Transaction Date,Transaction ID,Business Name,Location,Total Sales,Sales Basis,Orders,Cost,Expenses\r\n" +
      `2026-10-18,${testTxnId}-1,${business.name},${business.city},25000,Gross,10,12000,3000\r\n` +
      `2026-10-19,${testTxnId}-2,${business.name},${business.city},35000,Gross,14,16000,4000\r\n`;

    const fd = new FormData();
    fd.append("file", new Blob([csvContent], { type: "text/csv" }), "manager_portal_upload.csv");
    fd.append("targetBusinessId", business._id.toString());
    fd.append("reportingPeriod", "auto");
    fd.append("autoDetect", "true");

    console.log("1. Manager sends upload to /sales/upload/preview...");
    const previewRes = await fetch(`${baseUrl}/sales/upload/preview`, {
      method: "POST",
      headers: { Authorization: `Bearer ${managerToken}` },
      body: fd,
    });
    const previewData = await previewRes.json();
    assert.equal(previewRes.status, 200, `Preview failed: ${JSON.stringify(previewData)}`);
    assert.equal(previewData.validCount, 2);
    console.log(`   ✔ Preview successful: ${previewData.validCount} valid rows detected.`);

    console.log("2. Manager commits import to /sales/upload/commit...");
    const commitRes = await fetch(`${baseUrl}/sales/upload/commit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        importJobId: previewData.importJobId,
        duplicateMode: "add",
      }),
    });
    const commitData = await commitRes.json();
    assert.equal(commitRes.status, 200, `Commit failed: ${JSON.stringify(commitData)}`);
    assert.equal(commitData.summary.successCount, 2);
    console.log(`   ✔ Import committed: ${commitData.summary.successCount} rows saved to database.`);

    console.log("3. Checking Manager Monthly Analytics (/sales/analytics/monthly)...");
    const mgrAnalyticsRes = await fetch(`${baseUrl}/sales/analytics/monthly?filter=custom&startDate=2026-10-18&endDate=2026-10-19&businessId=${business._id}`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const mgrData = await mgrAnalyticsRes.json();
    assert.equal(mgrAnalyticsRes.status, 200);
    assert.equal(mgrData.selected.recordedSales.value, 60000, "Manager sees 60,000 total sales (25k + 35k)");
    console.log(`   ✔ Manager Dashboard correctly reflects: ₹${mgrData.selected.recordedSales.value.toLocaleString("en-IN")}`);

    console.log("4. Checking Client Portal Analytics (/portal/analytics/monthly)...");
    const clientAnalyticsRes = await fetch(`${baseUrl}/portal/analytics/monthly?filter=custom&startDate=2026-10-18&endDate=2026-10-19`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const clientData = await clientAnalyticsRes.json();
    assert.equal(clientAnalyticsRes.status, 200);
    assert.equal(clientData.selected.recordedSales.value, 60000, "Client sees same 60,000 total sales");
    console.log(`   ✔ Client Dashboard automatically reflects: ₹${clientData.selected.recordedSales.value.toLocaleString("en-IN")}`);

    console.log("5. Checking Client Sync Status (/portal/sync-status)...");
    const syncRes = await fetch(`${baseUrl}/portal/sync-status`, {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const syncData = await syncRes.json();
    assert.equal(syncRes.status, 200);
    assert.ok(syncData.syncStamp || syncData.version, "Sync stamp present for real-time polling");
    console.log(`   ✔ Client Portal sync stamp: ${syncData.syncStamp || syncData.version}`);

    // Cleanup
    await SalesRecord.deleteMany({ transactionId: { $in: [`${testTxnId}-1`, `${testTxnId}-2`] } });
    await SalesImportJob.deleteOne({ _id: previewData.importJobId });
    console.log("\n✔ Cleaned up test import records.");
    console.log("\nALL MANAGER PORTAL IMPORT & SYNC CHECKS PASSED SUCCESSFULLY!");
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();
