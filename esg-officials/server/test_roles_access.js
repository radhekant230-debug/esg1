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

  return { status: res.status, data };
}

async function runRoleAccessTests() {
  console.log("==================================================");
  console.log("   ESG OFFICIALS: ROLE ACCESS & PERMISSIONS TEST   ");
  console.log("==================================================");

  // ----------------------------------------------------------------
  // 1. ADMIN ROLE VERIFICATION
  // ----------------------------------------------------------------
  console.log("\n[1] TEST: Administrator Account Authentication & Permissions");
  const adminLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@esgofficial.com", password: "password123" }),
  });

  if (adminLogin.status !== 200 || adminLogin.data.role !== "admin") {
    throw new Error(`Admin login failed: status ${adminLogin.status}, role: ${adminLogin.data?.role}`);
  }
  console.log(`✓ Admin logged in successfully.`);
  console.log(`✓ Authenticated User Name: "${adminLogin.data.name}"`);
  console.log(`✓ Authenticated Role: "${adminLogin.data.role}" (Expected: admin)`);

  const adminHeaders = { Authorization: `Bearer ${adminLogin.data.token}` };

  // Admin access to clients list
  const adminClients = await request("/clients", { headers: adminHeaders });
  if (adminClients.status !== 200) {
    throw new Error(`Admin should access /clients, but got ${adminClients.status}`);
  }
  console.log(`✓ Admin successfully queried /clients (returned ${adminClients.data.length} records).`);

  // Admin access to managers list
  const adminManagers = await request("/clients/managers/all", { headers: adminHeaders });
  if (adminManagers.status !== 200) {
    throw new Error(`Admin should access /clients/managers/all, but got ${adminManagers.status}`);
  }
  console.log(`✓ Admin successfully queried /clients/managers/all (returned ${adminManagers.data.length} managers).`);

  // ----------------------------------------------------------------
  // 2. MANAGER ROLE VERIFICATION & RESTRICTIONS
  // ----------------------------------------------------------------
  console.log("\n[2] TEST: Manager Account Authentication & Permissions");
  const managerLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "rahul.manager@esgofficial.com", password: "password123" }),
  });

  if (managerLogin.status !== 200 || managerLogin.data.role !== "manager") {
    throw new Error(`Manager login failed: status ${managerLogin.status}, role: ${managerLogin.data?.role}`);
  }
  console.log(`✓ Manager logged in successfully.`);
  console.log(`✓ Authenticated User Name: "${managerLogin.data.name}"`);
  console.log(`✓ Authenticated Role: "${managerLogin.data.role}" (Expected: manager)`);

  const managerHeaders = { Authorization: `Bearer ${managerLogin.data.token}` };

  // Manager should NOT be allowed to access Admin /clients endpoint
  const managerClientsAttempt = await request("/clients", { headers: managerHeaders });
  if (managerClientsAttempt.status === 403) {
    console.log(`✓ Manager access to /clients strictly BLOCKED (Status 403: "${managerClientsAttempt.data.message}").`);
  } else {
    throw new Error(`Security breach: Manager accessed /clients with status ${managerClientsAttempt.status}`);
  }

  // Manager should NOT be allowed to create a client
  const managerCreateAttempt = await request("/clients", {
    method: "POST",
    headers: managerHeaders,
    body: JSON.stringify({ name: "Unauthorized", email: "unauth@test.com", companyName: "Test" }),
  });
  if (managerCreateAttempt.status === 403) {
    console.log(`✓ Manager client creation strictly BLOCKED (Status 403: "${managerCreateAttempt.data.message}").`);
  } else {
    throw new Error(`Security breach: Manager created a client with status ${managerCreateAttempt.status}`);
  }

  // ----------------------------------------------------------------
  // 3. CLIENT ROLE VERIFICATION & RESTRICTIONS
  // ----------------------------------------------------------------
  console.log("\n[3] TEST: Client Account Authentication & Permissions");
  const clientLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "cafemysa@client.com", password: "password123" }),
  });

  if (clientLogin.status !== 200 || clientLogin.data.role !== "client") {
    throw new Error(`Client login failed: status ${clientLogin.status}, role: ${clientLogin.data?.role}`);
  }
  console.log(`✓ Client logged in successfully.`);
  console.log(`✓ Authenticated User Name: "${clientLogin.data.name}"`);
  console.log(`✓ Authenticated Role: "${clientLogin.data.role}" (Expected: client)`);
  console.log(`✓ Client ID: "${clientLogin.data.clientId}"`);

  const clientHeaders = { Authorization: `Bearer ${clientLogin.data.token}` };

  // Client should NOT be allowed to access /clients
  const clientListAttempt = await request("/clients", { headers: clientHeaders });
  if (clientListAttempt.status === 403) {
    console.log(`✓ Client access to /clients strictly BLOCKED (Status 403: "${clientListAttempt.data.message}").`);
  } else {
    throw new Error(`Security breach: Client accessed /clients with status ${clientListAttempt.status}`);
  }

  // Client should NOT be allowed to toggle client status
  const clientToggleAttempt = await request("/clients/600000000000000000000001/toggle-status", {
    method: "PUT",
    headers: clientHeaders,
  });
  if (clientToggleAttempt.status === 403) {
    console.log(`✓ Client mutation of client status strictly BLOCKED (Status 403: "${clientToggleAttempt.data.message}").`);
  } else {
    throw new Error(`Security breach: Client modified status with status ${clientToggleAttempt.status}`);
  }

  // Client CAN access own portal profile
  const clientPortalProfile = await request("/portal/profile", { headers: clientHeaders });
  if (clientPortalProfile.status === 200) {
    console.log(`✓ Client authorized to view own portal profile: "${clientPortalProfile.data.profile.businessName}".`);
  } else {
    throw new Error(`Client failed to access own portal profile: status ${clientPortalProfile.status}`);
  }

  console.log("\n==================================================");
  console.log("   ALL ROLE PERMISSIONS & ACCESS CHECKS PASSED!   ");
  console.log("==================================================");
}

runRoleAccessTests().catch((err) => {
  console.error("Test error:", err.message);
  process.exit(1);
});
