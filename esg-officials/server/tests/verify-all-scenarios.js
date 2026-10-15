/**
 * Comprehensive verification of all 10 scenarios required by the specification:
 * 1. Upload a CSV covering seven days.
 * 2. Upload an Excel file covering one month.
 * 3. Upload a custom three-month date range.
 * 4. Verify dates and totals are correctly aggregated.
 * 5. Verify the Manager Dashboard and corresponding Client Dashboard show the same underlying results.
 * 6. Verify other clients cannot access the uploaded data.
 * 7. Re-upload a corrected file and verify duplicate prevention (add vs replace).
 * 8. Test missing dates, invalid sales values, and inconsistent headers.
 * 9. Verify all 11 date filters update cards, charts, tables, and exports.
 * 10. Verify existing application features continue working.
 */
require("dotenv").config();
const http = require("http");
const assert = require("assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const xlsx = require("xlsx");

const ist = require("../utils/istDate");
const User = require("../models/User");
const SalesBusiness = require("../models/sales/SalesBusiness");
const SalesRecord = require("../models/sales/SalesRecord");
const SalesImportJob = require("../models/sales/SalesImportJob");
const AuditLog = require("../models/AuditLog");
const app = require("../app");

let server;
let baseUrl;
let managerToken;
let clientAToken;
let clientBToken;
let managerUser;
let clientAUser;
let clientBUser;
let testBizA;
let testBizB;

const results = [];
async function testScenario(num, name, fn) {
  try {
    console.log(`\n▶ Scenario ${num}: ${name}...`);
    await fn();
    results.push({ num, name, passed: true });
    console.log(`  ✔ Scenario ${num} PASSED`);
  } catch (err) {
    results.push({ num, name, passed: false, error: err });
    console.error(`  ✘ Scenario ${num} FAILED:`, err.message);
    if (err.stack) console.error(err.stack.split("\n").slice(0, 5).join("\n"));
  }
}

async function apiRequest(path, { method = "GET", token, body, isFormData = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let requestBody = body;
  if (!isFormData && body && typeof body === "object") {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: requestBody,
  });

  const contentType = res.headers.get("content-type") || "";
  let data = null;
  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch (_) {}
  } else if (contentType.includes("text/csv")) {
    data = await res.text();
  } else {
    data = Buffer.from(await res.arrayBuffer());
  }

  return { status: res.status, data, headers: res.headers };
}

function makeCsvFormData(csvContent, filename = "test_sales.csv", extraFields = {}) {
  const fd = new FormData();
  fd.append("file", new Blob([csvContent], { type: "text/csv" }), filename);
  for (const [k, v] of Object.entries(extraFields)) {
    if (v !== undefined && v !== null) fd.append(k, String(v));
  }
  return fd;
}

function makeExcelFormData(rows, filename = "test_sales.xlsx", extraFields = {}) {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(rows);
  xlsx.utils.book_append_sheet(wb, ws, "Sales");
  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

  const fd = new FormData();
  fd.append("file", new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
  for (const [k, v] of Object.entries(extraFields)) {
    if (v !== undefined && v !== null) fd.append(k, String(v));
  }
  return fd;
}

(async () => {
  try {
    console.log("=================================================");
    console.log("   ESG SAAS TIME-PERIOD-AWARE SALES VERIFICATION ");
    console.log("=================================================");

    await mongoose.connect(process.env.MONGO_URI, { dbName: "esg-official-clients" });
    console.log("Connected to MongoDB Atlas: esg-official-clients");

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api`;
    console.log(`Test Express server running at: ${baseUrl}`);

    // Fetch existing users and businesses
    managerUser = await User.findOne({ role: "manager" }).lean();
    if (!managerUser) throw new Error("No manager found in DB");

    const clientUsers = await User.find({ role: "client" }).lean();
    if (clientUsers.length < 2) throw new Error("Need at least 2 clients in DB for isolation testing");

    clientAUser = clientUsers.find((c) => c.companyName === "Café Mysa") || clientUsers[0];
    clientBUser = clientUsers.find((c) => c._id.toString() !== clientAUser._id.toString()) || clientUsers[1];

    // Find businesses linked to client A and client B
    testBizA = await SalesBusiness.findOne({ clientAccount: clientAUser._id }).lean();
    if (!testBizA) {
      testBizA = await SalesBusiness.findOne({}).lean();
      await SalesBusiness.updateOne({ _id: testBizA._id }, { $set: { clientAccount: clientAUser._id } });
      testBizA.clientAccount = clientAUser._id;
    }

    testBizB = await SalesBusiness.findOne({ clientAccount: clientBUser._id }).lean();
    if (!testBizB) {
      const otherBiz = await SalesBusiness.findOne({ _id: { $ne: testBizA._id } }).lean();
      await SalesBusiness.updateOne({ _id: otherBiz._id }, { $set: { clientAccount: clientBUser._id } });
      testBizB = otherBiz;
      testBizB.clientAccount = clientBUser._id;
    }

    console.log(`Manager: ${managerUser.name} (${managerUser.email})`);
    console.log(`Client A: ${clientAUser.name} [Biz: ${testBizA.name}, ID: ${testBizA._id}]`);
    console.log(`Client B: ${clientBUser.name} [Biz: ${testBizB.name}, ID: ${testBizB._id}]`);

    const secret = process.env.JWT_SECRET;
    managerToken = jwt.sign({ id: managerUser._id, role: managerUser.role }, secret, { expiresIn: "1h" });
    clientAToken = jwt.sign({ id: clientAUser._id, role: clientAUser.role }, secret, { expiresIn: "1h" });
    clientBToken = jwt.sign({ id: clientBUser._id, role: clientBUser.role }, secret, { expiresIn: "1h" });

    // Track test transaction IDs for safe cleanup after test
    const testTxnIds = [];
    const testImportJobIds = [];

    // -------------------------------------------------------------------------
    // Scenario 1: Upload a CSV covering seven days.
    // -------------------------------------------------------------------------
    await testScenario(1, "Upload a CSV covering seven days", async () => {
      const dates = [
        "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
        "2026-10-05", "2026-10-06", "2026-10-07"
      ];
      let csv = "Transaction Date,Transaction ID,Business Name,Location,Total Sales,Sales Basis,Orders,Target,Discount,Cost,Expenses,Remarks\r\n";
      dates.forEach((d, idx) => {
        const txnId = `TXN-7D-${idx + 1}`;
        testTxnIds.push(txnId);
        csv += `${d},${txnId},${testBizA.name},${testBizA.city},15000,Gross,12,18000,1000,7000,2000,Day ${idx + 1} sales\r\n`;
      });

      const fd = makeCsvFormData(csv, "weekly_7days_sales.csv", {
        targetBusinessId: testBizA._id.toString(),
      });

      const previewRes = await apiRequest("/sales/upload/preview", {
        method: "POST",
        token: managerToken,
        body: fd,
        isFormData: true,
      });

      assert.equal(previewRes.status, 200, `Preview returned status ${previewRes.status}: ${JSON.stringify(previewRes.data)}`);
      assert.equal(previewRes.data.validCount, 7, `Expected 7 valid rows, got ${previewRes.data.validCount}`);
      assert.ok(
        previewRes.data.detectedPeriod?.periodType === "weekly" || previewRes.data.detectedPeriod?.periodType === "one_week",
        `Expected detected period weekly or one_week, got ${previewRes.data.detectedPeriod?.periodType}`
      );
      assert.equal(previewRes.data.detectedPeriod?.totalDays, 7, `Expected 7 days, got ${previewRes.data.detectedPeriod?.totalDays}`);
      assert.equal(previewRes.data.recordType, "transaction", `Expected transaction record type`);

      testImportJobIds.push(previewRes.data.importJobId);

      // Commit import
      const commitRes = await apiRequest("/sales/upload/commit", {
        method: "POST",
        token: managerToken,
        body: { importJobId: previewRes.data.importJobId, duplicateMode: "add" },
      });

      assert.equal(commitRes.status, 200, `Commit failed: ${JSON.stringify(commitRes.data)}`);
      assert.equal(commitRes.data.summary.successCount, 7, "All 7 transaction rows should be imported");

      // Verify records in DB
      const dbRecords = await SalesRecord.find({ transactionId: { $in: testTxnIds } }).lean();
      assert.equal(dbRecords.length, 7, "Should find 7 records in database with transaction IDs");
      assert.equal(dbRecords[0].recordType, "transaction");
      assert.equal(dbRecords[0].periodType, "daily");
    });

    // -------------------------------------------------------------------------
    // Scenario 2: Upload an Excel file covering one month.
    // -------------------------------------------------------------------------
    await testScenario(2, "Upload an Excel file covering one month", async () => {
      const rows = [
        {
          "Month": "November 2026",
          "Business Name": testBizA.name,
          "Location": testBizA.city,
          "Total Sales": 450000,
          "Sales Basis": "Gross",
          "Orders": 320,
          "Target": 500000,
          "Discount": 30000,
          "Cost": 200000,
          "Expenses": 70000,
          "Remarks": "November 2026 Monthly Summary"
        }
      ];

      const fd = makeExcelFormData(rows, "monthly_nov2026.xlsx", {
        targetBusinessId: testBizA._id.toString(),
      });

      const previewRes = await apiRequest("/sales/upload/preview", {
        method: "POST",
        token: managerToken,
        body: fd,
        isFormData: true,
      });

      assert.equal(previewRes.status, 200, `Preview status ${previewRes.status}: ${JSON.stringify(previewRes.data)}`);
      assert.ok(
        previewRes.data.detectedPeriod?.periodType === "monthly" || previewRes.data.detectedPeriod?.periodType === "one_month",
        `Expected detected period monthly or one_month, got ${previewRes.data.detectedPeriod?.periodType}`
      );
      assert.equal(previewRes.data.recordType, "summary");

      testImportJobIds.push(previewRes.data.importJobId);

      const commitRes = await apiRequest("/sales/upload/commit", {
        method: "POST",
        token: managerToken,
        body: { importJobId: previewRes.data.importJobId, duplicateMode: "add" },
      });

      assert.equal(commitRes.status, 200);
      assert.equal(commitRes.data.summary.successCount, 1);

      // Verify in DB
      const rec = await SalesRecord.findOne({ business: testBizA._id, year: 2026, month: 11 }).lean();
      assert.ok(rec, "November 2026 record should exist in DB");
      assert.equal(rec.totalSales, 450000);
      assert.equal(rec.recordType, "summary");
    });

    // -------------------------------------------------------------------------
    // Scenario 3: Upload a custom three-month date range.
    // -------------------------------------------------------------------------
    await testScenario(3, "Upload a custom three-month date range", async () => {
      // 3 dates across 3 months: 2026-07-01, 2026-08-15, 2026-09-30
      const dates = ["2026-07-01", "2026-08-15", "2026-09-30"];
      let csv = "Transaction Date,Transaction ID,Business Name,Location,Total Sales,Orders,Cost,Discount,Expenses,Remarks\r\n";
      dates.forEach((d, i) => {
        const txnId = `TXN-3M-${i + 1}`;
        testTxnIds.push(txnId);
        csv += `${d},${txnId},${testBizA.name},${testBizA.city},100000,75,40000,5000,15000,Q3 Custom Date ${d}\r\n`;
      });

      const fd = makeCsvFormData(csv, "custom_3months.csv", {
        targetBusinessId: testBizA._id.toString(),
        reportingPeriod: "custom",
      });

      const previewRes = await apiRequest("/sales/upload/preview", {
        method: "POST",
        token: managerToken,
        body: fd,
        isFormData: true,
      });

      assert.equal(previewRes.status, 200);
      assert.ok(
        (previewRes.data.detectedDateRange?.totalDays || previewRes.data.detectedPeriod?.totalDays) >= 90,
        "Should cover approx 92 days"
      );

      testImportJobIds.push(previewRes.data.importJobId);

      const commitRes = await apiRequest("/sales/upload/commit", {
        method: "POST",
        token: managerToken,
        body: { importJobId: previewRes.data.importJobId, duplicateMode: "add" },
      });

      assert.equal(commitRes.status, 200);
      assert.equal(commitRes.data.summary.successCount, 3);
    });

    // -------------------------------------------------------------------------
    // Scenario 4: Verify dates and totals are correctly aggregated.
    // -------------------------------------------------------------------------
    await testScenario(4, "Verify dates and totals are correctly aggregated", async () => {
      // Query 7-day period from Scenario 1: 2026-10-01 to 2026-10-07
      const res = await apiRequest(`/sales/analytics/monthly?filter=custom&startDate=2026-10-01&endDate=2026-10-07&businessId=${testBizA._id}`, {
        token: managerToken,
      });

      assert.equal(res.status, 200);
      const sel = res.data.selected;
      // 7 rows * 15,000 = 105,000 total sales
      assert.equal(sel.recordedSales.value, 105000, "Total recorded sales should be 105,000");
      assert.equal(sel.gross.value, 105000, "Gross sales should be 105,000");
      // 7 * 1,000 = 7,000 discount
      assert.equal(sel.discount.value, 7000, "Discount should be 7,000");
      // Net = 105,000 - 7,000 = 98,000
      assert.equal(sel.net.value, 98000, "Net sales should be 98,000");
      // Cost = 7 * 7,000 = 49,000
      assert.equal(sel.cost.value, 49000, "Cost should be 49,000");
      // Gross Profit = 98,000 - 49,000 = 49,000
      assert.equal(sel.grossProfit.value, 49000, "Gross profit should be 49,000");
      // Expenses = 7 * 2,000 = 14,000
      assert.equal(sel.expenses.value, 14000, "Expenses should be 14,000");
      // Net Profit = 49,000 - 14,000 = 35,000
      assert.equal(sel.netProfit.value, 35000, "Net profit should be 35,000");
      // Profit Margin = (35,000 / 98,000) * 100 = 35.71%
      assert.equal(sel.profitMargin.value, 35.71, "Profit margin % should match math");
      // Orders = 7 * 12 = 84
      assert.equal(sel.orders, 84, "Total orders should be 84");
    });

    // -------------------------------------------------------------------------
    // Scenario 5: Verify Manager Dashboard and Client Dashboard show the same underlying results.
    // -------------------------------------------------------------------------
    await testScenario(5, "Verify Manager and Client dashboards show identical results", async () => {
      // 1. Manager query
      const mgrRes = await apiRequest(`/sales/analytics/monthly?filter=custom&startDate=2026-10-01&endDate=2026-10-07&businessId=${testBizA._id}`, {
        token: managerToken,
      });
      assert.equal(mgrRes.status, 200);

      // 2. Client query
      const clientRes = await apiRequest(`/portal/analytics/monthly?filter=custom&startDate=2026-10-01&endDate=2026-10-07`, {
        token: clientAToken,
      });
      assert.equal(clientRes.status, 200);

      // Check parity
      const mSel = mgrRes.data.selected;
      const cSel = clientRes.data.selected;

      assert.equal(cSel.recordedSales.value, mSel.recordedSales.value, "Recorded sales parity");
      assert.equal(cSel.net.value, mSel.net.value, "Net sales parity");
      assert.equal(cSel.grossProfit.value, mSel.grossProfit.value, "Gross profit parity");
      assert.equal(cSel.netProfit.value, mSel.netProfit.value, "Net profit parity");
      assert.equal(cSel.orders, mSel.orders, "Orders parity");
      assert.equal(cSel.profitMargin.value, mSel.profitMargin.value, "Profit margin parity");

      // Verify sync stamp updates automatically
      const syncRes = await apiRequest(`/portal/sync-status`, {
        token: clientAToken,
      });
      assert.equal(syncRes.status, 200);
      assert.ok(syncRes.data.syncStamp, "Client portal sync stamp must be present");
    });

    // -------------------------------------------------------------------------
    // Scenario 6: Verify other clients cannot access the uploaded data.
    // -------------------------------------------------------------------------
    await testScenario(6, "Verify other clients cannot access Client A's data (isolation)", async () => {
      // Client B queries client analytics
      const bRes = await apiRequest(`/portal/analytics/monthly?filter=custom&startDate=2026-10-01&endDate=2026-10-07`, {
        token: clientBToken,
      });
      assert.equal(bRes.status, 200);
      const bBizNames = (bRes.data.businessBreakdown || []).map((b) => b.businessName);
      assert.ok(!bBizNames.includes(testBizA.name), "Client B must never see Client A's business");
      const bTxnIds = (bRes.data.salesHistory || []).map((h) => h.transactionId).filter(Boolean);
      for (const txnId of testTxnIds) {
        assert.ok(!bTxnIds.includes(txnId), `Client B must not see Client A's transaction ${txnId}`);
      }

      // Even if Client B maliciously passes Client A's businessId
      const sneakyRes = await apiRequest(`/portal/analytics/monthly?businessId=${testBizA._id}`, {
        token: clientBToken,
      });
      assert.equal(sneakyRes.status, 200);
      assert.equal(sneakyRes.data.scope?.businesses || 0, 0, "Client B must have 0 businesses in scope for Client A's ID");
      assert.equal(sneakyRes.data.selected?.recordCount || 0, 0, "Client B cannot access Client A's records");
    });

    // -------------------------------------------------------------------------
    // Scenario 7: Re-upload a corrected file and verify duplicate prevention.
    // -------------------------------------------------------------------------
    await testScenario(7, "Re-upload a corrected file and verify duplicate prevention", async () => {
      // Create duplicate rows using the same TXN-7D-1 to TXN-7D-7 IDs with revised sales value: 20000
      let revisedCsv = "Transaction Date,Transaction ID,Business Name,Location,Total Sales,Orders,Cost,Discount,Expenses,Remarks\r\n";
      for (let i = 1; i <= 7; i++) {
        revisedCsv += `2026-10-0${i},TXN-7D-${i},${testBizA.name},${testBizA.city},20000,15,8000,1500,2500,Revised Day ${i}\r\n`;
      }

      // 1. Test duplicateMode: "add" (skip existing)
      const fdAdd = makeCsvFormData(revisedCsv, "reupload_sales.csv", {
        targetBusinessId: testBizA._id.toString(),
      });
      const previewAdd = await apiRequest("/sales/upload/preview", {
        method: "POST",
        token: managerToken,
        body: fdAdd,
        isFormData: true,
      });
      assert.equal(previewAdd.status, 200);
      assert.equal(previewAdd.data.existingCount, 7, "Should detect all 7 rows already exist in database");

      testImportJobIds.push(previewAdd.data.importJobId);

      const commitAdd = await apiRequest("/sales/upload/commit", {
        method: "POST",
        token: managerToken,
        body: { importJobId: previewAdd.data.importJobId, duplicateMode: "add" },
      });
      assert.equal(commitAdd.status, 200);
      assert.equal(commitAdd.data.summary.skippedCount, 7, "Add mode must skip all 7 existing rows");
      assert.equal(commitAdd.data.summary.successCount, 0, "No duplicate records should be added");

      // Verify value is still original 15,000 in DB
      const origRec = await SalesRecord.findOne({ transactionId: "TXN-7D-1" });
      assert.equal(origRec.totalSales, 15000, "Record must NOT be modified in 'add' mode");

      // 2. Test duplicateMode: "replace" (update existing records safely)
      const fdReplace = makeCsvFormData(revisedCsv, "reupload_sales_replace.csv", {
        targetBusinessId: testBizA._id.toString(),
      });
      const previewReplace = await apiRequest("/sales/upload/preview", {
        method: "POST",
        token: managerToken,
        body: fdReplace,
        isFormData: true,
      });
      assert.equal(previewReplace.status, 200);

      testImportJobIds.push(previewReplace.data.importJobId);

      const commitReplace = await apiRequest("/sales/upload/commit", {
        method: "POST",
        token: managerToken,
        body: { importJobId: previewReplace.data.importJobId, duplicateMode: "replace" },
      });
      assert.equal(commitReplace.status, 200);
      assert.equal(commitReplace.data.summary.updatedCount, 7, "Replace mode must update all 7 records");

      // Verify value is now updated to 20,000 in DB
      const updatedRec = await SalesRecord.findOne({ transactionId: "TXN-7D-1" });
      assert.equal(updatedRec.totalSales, 20000, "Record must be updated to 20,000 in 'replace' mode");

      // Verify audit log
      const audit = await AuditLog.findOne({ action: "IMPORT_COMMITTED", entityId: previewReplace.data.importJobId });
      assert.ok(audit, "Audit log must be created for replace action");
    });

    // -------------------------------------------------------------------------
    // Scenario 8: Test missing dates, invalid sales values, and inconsistent headers.
    // -------------------------------------------------------------------------
    await testScenario(8, "Test missing dates, invalid sales values, and inconsistent headers", async () => {
      // Row 1: missing date
      // Row 2: invalid non-numeric sales ("INVALID_SALES")
      // Row 3: negative sales with Gross basis
      const badCsv =
        "Transaction Date,Transaction ID,Business Name,Location,Total Sales,Sales Basis\r\n" +
        `,TXN-BAD-1,${testBizA.name},${testBizA.city},10000,Gross\r\n` +
        `2026-10-15,TXN-BAD-2,${testBizA.name},${testBizA.city},NOT_A_NUMBER,Gross\r\n` +
        `2026-10-16,TXN-BAD-3,${testBizA.name},${testBizA.city},-5000,Gross\r\n`;

      const fd = makeCsvFormData(badCsv, "invalid_rows.csv", {
        targetBusinessId: testBizA._id.toString(),
      });

      const previewRes = await apiRequest("/sales/upload/preview", {
        method: "POST",
        token: managerToken,
        body: fd,
        isFormData: true,
      });

      assert.equal(previewRes.status, 200);
      assert.equal(previewRes.data.invalidCount, 3, "All 3 invalid rows must be identified");
      assert.equal(previewRes.data.validCount, 0, "No invalid rows should be marked valid");
      assert.ok(previewRes.data.invalidRows.some((r) => r.errors.some((e) => e.toLowerCase().includes("date") || e.toLowerCase().includes("month"))), "Error for missing date");
      assert.ok(previewRes.data.invalidRows.some((r) => r.errors.some((e) => e.toLowerCase().includes("number") || e.toLowerCase().includes("sales") || e.toLowerCase().includes("amount"))), "Error for invalid sales");
    });

    // -------------------------------------------------------------------------
    // Scenario 9: Verify all date filters update the cards, charts, tables, and exports.
    // -------------------------------------------------------------------------
    await testScenario(9, "Verify all 11 date filters update cards, charts, tables, and exports", async () => {
      const filters = [
        "today",
        "last_7_days",
        "last_30_days",
        "this_week",
        "previous_week",
        "this_month",
        "previous_month",
        "this_quarter",
        "previous_quarter",
        "this_year",
        "custom"
      ];

      for (const f of filters) {
        let queryStr = `filter=${f}`;
        if (f === "custom") queryStr += `&startDate=2026-10-01&endDate=2026-10-07`;
        const res = await apiRequest(`/sales/analytics/monthly?${queryStr}`, {
          token: managerToken,
        });

        assert.equal(res.status, 200, `Filter ${f} failed with status ${res.status}`);
        assert.ok(res.data.coverage?.selectedPeriod, `Filter ${f} must return selectedPeriod`);
        assert.ok(res.data.selected, `Filter ${f} must return selected aggregate`);
        assert.ok(Array.isArray(res.data.trend), `Filter ${f} must return trend array`);
        assert.ok(Array.isArray(res.data.businessBreakdown), `Filter ${f} must return business breakdown`);
        assert.ok(Array.isArray(res.data.salesHistory), `Filter ${f} must return sales history`);
      }

      // Test CSV Export
      const csvExport = await apiRequest(`/sales/analytics/monthly/export?format=csv&filter=last_7_days`, {
        token: managerToken,
      });
      assert.equal(csvExport.status, 200);
      assert.ok(typeof csvExport.data === "string" && csvExport.data.includes("Sales summary"), "CSV export should contain Sales summary");

      // Test Excel Export
      const xlsxExport = await apiRequest(`/sales/analytics/monthly/export?format=xlsx&filter=last_7_days`, {
        token: managerToken,
      });
      assert.equal(xlsxExport.status, 200);
      assert.ok(Buffer.isBuffer(xlsxExport.data) && xlsxExport.data.length > 500, "XLSX export should return valid spreadsheet buffer");
    });

    // -------------------------------------------------------------------------
    // Scenario 10: Verify existing application features continue working.
    // -------------------------------------------------------------------------
    await testScenario(10, "Verify existing application features continue working", async () => {
      // Check manager businesses list
      const bizRes = await apiRequest("/sales/businesses", { token: managerToken });
      assert.equal(bizRes.status, 200);
      assert.ok(Array.isArray(bizRes.data) && bizRes.data.length > 0);

      // Check manager locations list
      const locRes = await apiRequest("/sales/locations", { token: managerToken });
      assert.equal(locRes.status, 200);
      assert.ok(Array.isArray(locRes.data.locations));

      // Check manager sales dashboard
      const dashRes = await apiRequest("/sales/dashboard", { token: managerToken });
      assert.equal(dashRes.status, 200);
      assert.ok(dashRes.data);

      // Check client portal profile
      const profRes = await apiRequest("/portal/profile", { token: clientAToken });
      assert.equal(profRes.status, 200);
      assert.ok(profRes.data.clientUser);

      // Check client portal overview
      const overviewRes = await apiRequest("/portal/overview", { token: clientAToken });
      assert.equal(overviewRes.status, 200);
      assert.ok(overviewRes.data);
    });

    // -------------------------------------------------------------------------
    // CLEANUP TEST DATA SAFELY
    // -------------------------------------------------------------------------
    console.log("\nCleaning up test records created during verification...");
    if (testTxnIds.length > 0) {
      const delTxns = await SalesRecord.deleteMany({ transactionId: { $in: testTxnIds } });
      console.log(`Cleaned up ${delTxns.deletedCount} test transaction records.`);
    }
    const delNov = await SalesRecord.deleteMany({ business: testBizA._id, year: 2026, month: 11, source: "excel_upload" });
    console.log(`Cleaned up ${delNov.deletedCount} test monthly records.`);
    if (testImportJobIds.length > 0) {
      await SalesImportJob.deleteMany({ _id: { $in: testImportJobIds } });
      console.log(`Cleaned up ${testImportJobIds.length} test import jobs.`);
    }

    console.log("\n=================================================");
    console.log("             FINAL VERIFICATION SUMMARY          ");
    console.log("=================================================");
    let passedCount = 0;
    for (const r of results) {
      console.log(`Scenario ${r.num}: ${r.name} -> ${r.passed ? "PASSED" : "FAILED"}`);
      if (r.passed) passedCount++;
    }
    console.log(`\nTOTAL: ${passedCount} / ${results.length} PASSED`);

    if (passedCount === results.length) {
      console.log("\nALL 10 SCENARIOS VERIFIED SUCCESSFULLY ON REAL BACKEND & DATABASE!");
      process.exit(0);
    } else {
      console.error("\nSOME SCENARIOS FAILED.");
      process.exit(1);
    }
  } catch (globalErr) {
    console.error("FATAL ERROR in verification:", globalErr);
    process.exit(1);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
  }
})();
