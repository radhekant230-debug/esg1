const BASE_URL = "http://localhost:5000/api";

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    const err = new Error(data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return { status: res.status, data };
}

async function runTests() {
  console.log("=== STARTING CLIENT API TESTS ===");

  // 1. Admin login
  console.log("\n[1] Admin Login...");
  const adminLoginRes = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "admin@esgofficial.com",
      password: "password123",
    }),
  });
  const adminToken = adminLoginRes.data.token;
  console.log("✓ Admin logged in successfully.");

  const adminAuthHeader = { Authorization: `Bearer ${adminToken}` };

  // 2. Fetch managers
  console.log("\n[2] Fetch Managers...");
  const managersRes = await request("/clients/managers/all", {
    headers: adminAuthHeader,
  });
  console.log(`✓ Found ${managersRes.data.length} managers.`);
  const managerId = managersRes.data[0]?._id;

  // 3. Fetch existing clients
  console.log("\n[3] Fetch Existing Clients...");
  const existingClientsRes = await request("/clients", {
    headers: adminAuthHeader,
  });
  console.log(`✓ Fetched ${existingClientsRes.data.length} existing clients.`);

  // 4. Test validation errors
  console.log("\n[4] Test Validation Errors...");
  try {
    await request("/clients", {
      method: "POST",
      headers: adminAuthHeader,
      body: JSON.stringify({ name: "" }),
    });
    console.error("✗ Should have failed on missing required fields");
  } catch (err) {
    console.log(`✓ Missing fields rejected: "${err.data?.message}"`);
  }

  try {
    await request("/clients", {
      method: "POST",
      headers: adminAuthHeader,
      body: JSON.stringify({
        name: "Test User",
        email: "invalid-email",
        companyName: "Test Co",
      }),
    });
    console.error("✗ Should have failed on invalid email");
  } catch (err) {
    console.log(`✓ Invalid email rejected: "${err.data?.message}"`);
  }

  // 5. Test duplicate email
  console.log("\n[5] Test Duplicate Email Rejection...");
  try {
    await request("/clients", {
      method: "POST",
      headers: adminAuthHeader,
      body: JSON.stringify({
        name: "Duplicate User",
        email: "cafemysa@client.com",
        companyName: "Mysa Duplicate",
        password: "password123",
      }),
    });
    console.error("✗ Should have failed on duplicate email");
  } catch (err) {
    console.log(`✓ Duplicate email rejected: "${err.data?.message}"`);
  }

  // 6. Create a brand new client
  console.log("\n[6] Create Brand New Client...");
  const testEmail = `artisan.${Date.now()}@example.com`;
  const newClientPayload = {
    name: "Chef Arjun Mehta",
    companyName: "The Artisan Bakery & Bistro",
    email: testEmail,
    password: "ArtisanPassword123!",
    phone: "+91 98111 22334",
    businessType: "Café",
    address: "14 Inner Circle, Connaught Place, New Delhi",
    website: "https://theartisanbakery.in",
    logo: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80",
    assignedManager: managerId || null,
    servicesPurchased: [
      "Brand Strategy",
      "Content",
      "Social Media",
      "Google Business Profile",
      "Reporting",
    ],
    startDate: "2026-10-01",
    reportingPeriod: "Monthly",
    retainerAmount: 48000,
    isActive: true,
  };

  const createRes = await request("/clients", {
    method: "POST",
    headers: adminAuthHeader,
    body: JSON.stringify(newClientPayload),
  });
  console.log("✓ Client creation status:", createRes.status);
  const createdClient = createRes.data.client;
  console.log("✓ Created Client ID:", createdClient.clientId);
  console.log("✓ Created Client Name:", createdClient.name);
  console.log("✓ Created Business Name:", createdClient.companyName);
  console.log("✓ Business Type:", createdClient.businessType);
  console.log("✓ Services Purchased:", createdClient.servicesPurchased);
  console.log("✓ Retainer Amount:", createdClient.retainerAmount);
  console.log("✓ Temporary Password:", createdClient.temporaryPassword);

  // 7. Verify Client appears in /api/clients list
  console.log("\n[7] Verify Client in Clients List...");
  const listAfterRes = await request("/clients", {
    headers: adminAuthHeader,
  });
  const foundInList = listAfterRes.data.find((c) => c.email === testEmail);
  if (!foundInList) {
    throw new Error("Created client not found in clients list!");
  }
  console.log(`✓ Client found in list with ID ${foundInList.clientId} and type ${foundInList.businessType}`);

  // 8. Test Login with new client credentials
  console.log("\n[8] Test Login with New Client Account...");
  const clientLoginRes = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: testEmail,
      password: "ArtisanPassword123!",
    }),
  });
  const clientToken = clientLoginRes.data.token;
  console.log("✓ New client logged in successfully. Role:", clientLoginRes.data.role);

  const clientAuthHeader = { Authorization: `Bearer ${clientToken}` };

  // 9. Verify New Client Portal Dashboard data & empty states
  console.log("\n[9] Verify New Client Portal Profile & Empty States...");
  const portalProfileRes = await request("/portal/profile", {
    headers: clientAuthHeader,
  });
  console.log("✓ Portal profile business name:", portalProfileRes.data.profile.businessName);
  console.log("✓ Portal services:", portalProfileRes.data.profile.servicesPurchased);

  const portalSalesRes = await request("/portal/sales", {
    headers: clientAuthHeader,
  });
  console.log("✓ Sales records count for new client:", portalSalesRes.data.salesRecords?.length || 0);

  const portalCampaignsRes = await request("/portal/campaigns", {
    headers: clientAuthHeader,
  });
  console.log("✓ Campaign records count for new client:", portalCampaignsRes.data.campaigns?.length || 0);

  const portalLeadsRes = await request("/portal/leads", {
    headers: clientAuthHeader,
  });
  console.log("✓ Leads records count for new client:", portalLeadsRes.data.leads?.length || 0);

  // 10. Test Isolation: Ensure Client cannot query another client's profile
  console.log("\n[10] Test Client Isolation...");
  const isolationRes = await request("/portal/profile?clientId=507f1f77bcf86cd799439011", {
    headers: clientAuthHeader,
  });
  if (isolationRes.data.profile.businessName !== "The Artisan Bakery & Bistro") {
    throw new Error("Client isolation violated! Should only return own profile.");
  }
  console.log("✓ Client isolation strictly enforced: client only sees their own profile.");

  // 11. Test Update Client by Admin
  console.log("\n[11] Test Update Client by Admin...");
  const updateRes = await request(`/clients/${createdClient._id}`, {
    method: "PUT",
    headers: adminAuthHeader,
    body: JSON.stringify({
      companyName: "The Artisan Bakery, Cafe & Roastery",
      retainerAmount: 55000,
      website: "https://artisan-roastery.in",
    }),
  });
  console.log("✓ Client updated. New company name:", updateRes.data.client.companyName);
  console.log("✓ New retainer:", updateRes.data.client.retainerAmount);
  console.log("✓ New website:", updateRes.data.client.website);

  // 12. Test Toggle Client Status (deactivate / activate)
  console.log("\n[12] Test Toggle Client Status...");
  const toggleRes1 = await request(`/clients/${createdClient._id}/toggle-status`, {
    method: "PUT",
    headers: adminAuthHeader,
  });
  console.log("✓ Toggle status result 1:", toggleRes1.data.message, "isActive:", toggleRes1.data.isActive);

  // Try logging in when deactivated
  try {
    await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: testEmail,
        password: "ArtisanPassword123!",
      }),
    });
    console.error("✗ Should have rejected login when deactivated");
  } catch (err) {
    console.log(`✓ Deactivated login blocked: "${err.data?.message}"`);
  }

  // Reactivate
  const toggleRes2 = await request(`/clients/${createdClient._id}/toggle-status`, {
    method: "PUT",
    headers: adminAuthHeader,
  });
  console.log("✓ Toggle status result 2:", toggleRes2.data.message, "isActive:", toggleRes2.data.isActive);

  console.log("\n=== ALL BACKEND CLIENT API TESTS PASSED SUCCESSFULLY! ===");
}

runTests().catch((err) => {
  console.error("Test error:", err.data || err.message);
  process.exit(1);
});
