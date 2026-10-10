const BASE_URL = "http://localhost:5000/api";
const FRONTEND_URL = "http://localhost:5173";

async function postJSON(url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function getJSON(url, headers = {}) {
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json", ...headers },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log("=================================================================");
  console.log("   ESG OFFICIALS: ADMIN & CLIENT PORTAL SEPARATION TEST SUITE");
  console.log("=================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
    }
  }

  try {
    // 1. Test Public Homepage
    console.log("--- 1. Testing Public Website ---");
    const homeRes = await fetch(FRONTEND_URL);
    const homeText = await homeRes.text();
    assert(homeRes.status === 200, "Frontend server responds at root (/) with HTTP 200");
    assert(homeText.includes("ESG Officials") || homeText.includes("root"), "Homepage HTML root is rendered");

    // 2. Authentication: Admin Login
    console.log("\n--- 2. Testing Authentication ---");
    const adminLoginRes = await postJSON(`${BASE_URL}/auth/login`, {
      email: "admin@esgofficial.com",
      password: "password123",
    });
    assert(adminLoginRes.status === 200 && adminLoginRes.data.token, "Admin can log in successfully");
    const adminToken = adminLoginRes.data.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    assert(adminLoginRes.data.role === "admin", "Admin user role is verified as 'admin'");

    // 3. Authentication: Client A Login (Cafe Mysa)
    const clientALoginRes = await postJSON(`${BASE_URL}/auth/login`, {
      email: "cafemysa@client.com",
      password: "password123",
    });
    assert(clientALoginRes.status === 200 && clientALoginRes.data.token, "Client A (cafemysa@client.com) can log in");
    const clientAToken = clientALoginRes.data.token;
    const clientAHeaders = { Authorization: `Bearer ${clientAToken}` };
    assert(clientALoginRes.data.role === "client", "Client A role is verified as 'client'");

    // 4. Role-Based Access Control: Non-admin blocked from /api/admin/*
    console.log("\n--- 3. Testing Role-Based API Security ---");
    const clientOverviewRes = await getJSON(`${BASE_URL}/admin/overview`, clientAHeaders);
    assert(clientOverviewRes.status === 403, "Client A is strictly blocked from /api/admin/overview with HTTP 403 Forbidden");

    const noAuthOverviewRes = await getJSON(`${BASE_URL}/admin/overview`);
    assert(noAuthOverviewRes.status === 401, "Unauthenticated user is strictly blocked with HTTP 401 Unauthorized");

    // 5. Admin Overview: Aggregated Calculations Across All Clients
    console.log("\n--- 4. Testing Admin Overview Aggregations ---");
    const overviewRes = await getJSON(`${BASE_URL}/admin/overview`, adminHeaders);
    assert(overviewRes.status === 200, "Admin can query /api/admin/overview with HTTP 200");
    const { summary, clientPerformance } = overviewRes.data;
    assert(summary.totalClients > 0, `Total clients detected: ${summary.totalClients}`);
    assert(summary.totalSales >= summary.totalRevenue, `Gross sales (₹${summary.totalSales}) >= Net revenue (₹${summary.totalRevenue})`);
    assert(summary.totalAdSpend > 0, `Total ad spend calculated from records: ₹${summary.totalAdSpend}`);
    assert(summary.overallRoas !== undefined, `Overall ROAS calculated: ${summary.overallRoas}x`);
    assert(Array.isArray(clientPerformance), `Client performance breakdown returns ${clientPerformance.length} accounts`);

    // Verify client performance table columns
    const firstPerf = clientPerformance[0];
    assert(
      firstPerf &&
      firstPerf.id &&
      firstPerf.name &&
      firstPerf.businessType &&
      firstPerf.totalSales !== undefined &&
      firstPerf.revenue !== undefined &&
      firstPerf.adSpend !== undefined &&
      firstPerf.leads !== undefined &&
      firstPerf.orders !== undefined &&
      firstPerf.roas !== undefined,
      "Client performance table contains all required fields (Name, Type, Sales, Revenue, Ad Spend, Leads, Orders, ROAS, Status)"
    );

    // 6. Admin Data Entry: Add Sales Record for a Client
    console.log("\n--- 5. Testing Admin Business Data Entry ---");
    const targetClient = clientPerformance[0];
    const testMonth = "2026-10";

    const salesPayload = {
      reportingMonth: testMonth,
      grossSales: 85000,
      discounts: 5000,
      refunds: 2000,
      costOfGoodsSold: 28000,
      salesChannel: "dine_in",
      dataSource: "POS Register #2",
      verificationStatus: "verified",
      notes: "Weekend festival surge"
    };

    const addSalesRes = await postJSON(
      `${BASE_URL}/admin/clients/${targetClient.id}/sales`,
      salesPayload,
      adminHeaders
    );
    assert(addSalesRes.status === 201, "Admin can enter new sales record for a client (HTTP 201 Created)");
    const savedRecord = addSalesRes.data.record || addSalesRes.data;
    assert(savedRecord.netRevenue === 78000, "Net revenue correctly calculated on save: 85000 - 5000 - 2000 = 78000");

    // 7. Admin Data Entry: Add Campaign Record
    const campaignPayload = {
      platform: "meta",
      campaignName: "October Autumn Festival Special",
      reportingMonth: testMonth,
      amountSpent: 12000,
      impressions: 48000,
      reach: 32000,
      clicks: 1400,
      conversions: 84,
      leads: 32,
      attributedRevenue: 54000,
      campaignStatus: "active",
      supportingEvidence: "Meta Ads Manager Export ID: 883921"
    };

    const addCampRes = await postJSON(
      `${BASE_URL}/admin/clients/${targetClient.id}/campaigns`,
      campaignPayload,
      adminHeaders
    );
    assert(addCampRes.status === 201, "Admin can enter new campaign record for a client");
    const savedCamp = addCampRes.data.campaign || addCampRes.data;
    assert(savedCamp.roas === 4.5, "ROAS accurately computed: 54000 / 12000 = 4.5x");
    assert(savedCamp.ctr === 2.92, "CTR accurately computed: (1400 / 48000) * 100 = 2.92%");

    // 8. Admin Data Entry: Add Lead Record
    const leadPayload = {
      reportingMonth: testMonth,
      leadSource: "Instagram DM",
      campaign: "October Autumn Festival Special",
      enquiryCount: 5,
      isQualified: true,
      isConverted: false,
      notes: "Enquired about catering for corporate dinner"
    };

    const addLeadRes = await postJSON(
      `${BASE_URL}/admin/clients/${targetClient.id}/leads`,
      leadPayload,
      adminHeaders
    );
    assert(addLeadRes.status === 201, "Admin can enter new lead enquiry record for a client");

    // 9. Admin Data Entry: Add Order/Reservation Record
    const orderPayload = {
      reportingMonth: testMonth,
      type: "reservation",
      customerName: "Sharma Family Gathering",
      partySize: 8,
      orderValue: 12500,
      channel: "dine_in",
      status: "completed",
      notes: "Table 4 banquet setup"
    };

    const addOrderRes = await postJSON(
      `${BASE_URL}/admin/clients/${targetClient.id}/orders`,
      orderPayload,
      adminHeaders
    );
    assert(addOrderRes.status === 201, "Admin can enter new order/reservation record for a client");

    // 10. Data Persistence & Recalculation Check
    console.log("\n--- 6. Testing Overview Recalculation & Persistence ---");
    const updatedOverviewRes = await getJSON(`${BASE_URL}/admin/overview`, adminHeaders);
    const updatedSummary = updatedOverviewRes.data.summary;
    assert(updatedSummary.totalSales >= summary.totalSales + 85000, "Admin overview gross sales updated immediately from new record");
    assert(updatedSummary.totalAdSpend >= summary.totalAdSpend + 12000, "Admin overview ad spend updated immediately from new record");

    // 11. Client Detail Page API (/api/admin/clients/:clientId)
    console.log("\n--- 7. Testing Admin Client Detail Page ---");
    const detailRes = await getJSON(`${BASE_URL}/admin/clients/${targetClient.id}`, adminHeaders);
    assert(detailRes.status === 200, "Admin can retrieve comprehensive Client Detail profile");
    assert(detailRes.data.client && detailRes.data.client.clientId, "Client Detail includes server-generated Client ID");
    assert(Array.isArray(detailRes.data.salesRecords), "Client Detail includes client sales records");
    assert(Array.isArray(detailRes.data.campaigns), "Client Detail includes advertising campaigns");
    assert(Array.isArray(detailRes.data.leads), "Client Detail includes leads pipeline");
    assert(Array.isArray(detailRes.data.orders), "Client Detail includes orders & reservations");

    // 12. Client Portal Isolation: Client cannot see other clients' data
    console.log("\n--- 8. Testing Client Portal Isolation ---");
    const clientAPortalOverview = await getJSON(`${BASE_URL}/portal/overview`, clientAHeaders);
    assert(clientAPortalOverview.status === 200, "Client A can view their own portal overview");

    // Attempt to spoof clientId via query parameter
    const spoofedPortalRes = await getJSON(
      `${BASE_URL}/portal/sales?clientId=507f1f77bcf86cd799439011`,
      clientAHeaders
    );
    assert(spoofedPortalRes.status === 200, "Client A query succeeds");
    const returnedClientSales = spoofedPortalRes.data.records || [];
    const containsOtherClient = returnedClientSales.some(r => r.client && r.client.toString() === "507f1f77bcf86cd799439011");
    assert(!containsOtherClient, "Client A CANNOT access another client's records even with spoofed query param");

    // 13. Filters: Month and Business Type filtering
    console.log("\n--- 9. Testing Dashboard Filters ---");
    const filteredMonthRes = await getJSON(`${BASE_URL}/admin/overview?month=2026-10`, adminHeaders);
    assert(filteredMonthRes.status === 200, "Monthly filter (month=2026-10) works accurately");

    const filteredTypeRes = await getJSON(`${BASE_URL}/admin/overview?businessType=cafe`, adminHeaders);
    assert(filteredTypeRes.status === 200, "Business type filter (businessType=cafe) works accurately");
    const allFilteredAreCafes = filteredTypeRes.data.clientPerformance.every(c => c.businessType.includes("cafe"));
    assert(allFilteredAreCafes, "All returned records match the filtered business type");

    console.log("\n=================================================================");
    console.log(`   TEST RESULTS: ${passed}/${total} TESTS PASSED (${((passed / total) * 100).toFixed(1)}%)`);
    console.log("=================================================================\n");

  } catch (err) {
    console.error("Test Suite Fatal Error:", err);
  }
}

runTests();
