const test = require("node:test");
const assert = require("node:assert/strict");
const parser = require("../../services/sales/importParser");

// Authorized business records in manager's scope
const MANAGER_AUTHORIZED_BUSINESSES = [
  {
    _id: "6acd94b71ae1fc30270f9e28",
    name: "Maya Multicuisine Restaurant",
    code: "BIZ-JH-RAN-003",
    city: "Ranchi",
    state: "Jharkhand",
    category: "Restaurant",
    monthlyTarget: 200000,
    clientAccount: "6ac9dbc35904d74a118e4699", // Linked Client Portal Account
  },
  {
    _id: "6acd94b71ae1fc30270f9e11",
    name: "Hotel Green Horizon",
    code: "BIZ-JH-RAN-001",
    city: "Ranchi",
    state: "Jharkhand",
    category: "Hotel",
    monthlyTarget: 350000,
    clientAccount: "6ac9dbc35904d74a118e4698",
  },
  {
    _id: "6acd94b71ae1fc30270f9e12",
    name: "Spice Route",
    code: "BIZ-JH-RAN-002",
    city: "Ranchi",
    state: "Jharkhand",
    category: "Restaurant",
    monthlyTarget: 150000,
    clientAccount: "6ac9dbc35904d74a118e4697",
  },
];

// Business outside the manager's authorized scope (e.g. Delhi manager's business)
const UNAUTHORIZED_BUSINESS = {
  _id: "6acd94b71ae1fc30270f9e99",
  name: "Imperial Delhi Palace",
  code: "BIZ-DL-DEL-009",
  city: "Delhi",
  state: "Delhi",
  category: "Hotel",
  monthlyTarget: 500000,
  clientAccount: "6ac9dbc35904d74a118e4691",
};

const ALL_SYSTEM_BUSINESSES = [...MANAGER_AUTHORIZED_BUSINESSES, UNAUTHORIZED_BUSINESS];
const AUTHORIZED_IDS = new Set(MANAGER_AUTHORIZED_BUSINESSES.map((b) => String(b._id)));
const TARGET_MAYA = MANAGER_AUTHORIZED_BUSINESSES[0];

const csvBuffer = (text) => Buffer.from(text, "utf8");

function runValidation(csvText, opts = {}) {
  return parser.parseAndValidate(csvBuffer(csvText), {
    filename: "sales_import.csv",
    businesses: ALL_SYSTEM_BUSINESSES,
    authorizedIds: AUTHORIZED_IDS,
    targetBusiness: TARGET_MAYA,
    existingKeys: new Map(),
    ...opts,
  });
}

test("Scenario 1: Bug Reproduction & Fix — 'Maya Multicuisine Restaurant, Ranchi' with target selected", () => {
  // Exact user case:
  // "Row is for 'Maya Multicuisine Restaurant, Ranchi' but the upload target is 'Maya Multicuisine Restaurant, Ranchi'."
  // Valid rows must be 1, Invalid rows must be 0, Reporting period: September 2026
  const csvContent =
    "Month,Business Name,Location,Total Sales\n" +
    "September 2026,\"Maya Multicuisine Restaurant, Ranchi\",Ranchi,180000\n";

  const res = runValidation(csvContent);

  assert.equal(res.rows.length, 1, "Exactly one row should be present");
  assert.equal(res.rows[0].status, "valid", `Expected row to be valid but got errors: ${res.rows[0].errors.join(", ")}`);
  assert.equal(res.rows.filter((r) => r.status === "valid").length, 1, "Valid rows count must be 1");
  assert.equal(res.rows.filter((r) => r.status === "invalid").length, 0, "Invalid rows count must be 0");

  const data = res.rows[0].data;
  assert.equal(data.businessId, TARGET_MAYA._id, "Business ID must match Maya stable ID");
  assert.equal(data.businessName, "Maya Multicuisine Restaurant", "Business Name must be canonical name");
  assert.equal(data.city, "Ranchi", "City must be canonical Ranchi");
  assert.equal(data.state, "Jharkhand", "State must be canonical Jharkhand");
  assert.equal(data.monthName, "September 2026", "Reporting period must be September 2026");
  assert.equal(data.totalSales, 180000);
});

test("Scenario 2: Exact business-name match with the correct business ID", () => {
  const csvContent =
    "Month,Business ID,Business Name,Location,Total Sales\n" +
    `September 2026,${TARGET_MAYA._id},Maya Multicuisine Restaurant,Ranchi,180000\n`;

  const res = runValidation(csvContent);

  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].status, "valid", `Row should be valid: ${res.rows[0].errors.join(", ")}`);
  assert.equal(res.rows[0].data.businessId, TARGET_MAYA._id);
  assert.equal(res.rows[0].data.totalSales, 180000);
});

test("Scenario 3: Differences in capitalization and extra whitespace", () => {
  const csvContent =
    "Month,Business Name,Location,Total Sales\n" +
    "September 2026,\"   mAyA   MultiCuisine   Restaurant   \",   raNchi   ,180000\n";

  const res = runValidation(csvContent);

  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].status, "valid", `Row should be valid: ${res.rows[0].errors.join(", ")}`);
  assert.equal(res.rows[0].data.businessId, TARGET_MAYA._id);
  assert.equal(res.rows[0].data.businessName, "Maya Multicuisine Restaurant");
  assert.equal(res.rows[0].data.city, "Ranchi");
});

test("Scenario 4: Genuinely different business name is rejected with clear mismatch details", () => {
  const csvContent =
    "Month,Business Name,Location,Total Sales\n" +
    "September 2026,Hotel Green Horizon,Ranchi,180000\n";

  const res = runValidation(csvContent);

  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].status, "invalid", "Row for different business must be rejected");
  assert.equal(res.rows.filter((r) => r.status === "valid").length, 0, "Valid rows count must be 0");
  assert.equal(res.rows.filter((r) => r.status === "invalid").length, 1, "Invalid rows count must be 1");

  const errMsg = res.rows[0].errors[0];
  assert.match(errMsg, /Row is for "Hotel Green Horizon, Ranchi"/);
  assert.match(errMsg, /upload target is "Maya Multicuisine Restaurant, Ranchi"/);
  // Ensure sensitive internals are not exposed
  assert.ok(!errMsg.includes("password") && !errMsg.includes("jwt") && !errMsg.includes("token"));
});

test("Scenario 5: Business ID that does not belong to the manager's authorized scope is rejected", () => {
  const csvContent =
    "Month,Business ID,Business Name,Location,Total Sales\n" +
    `September 2026,${UNAUTHORIZED_BUSINESS._id},${UNAUTHORIZED_BUSINESS.name},Delhi,180000\n`;

  const res = runValidation(csvContent);

  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].status, "invalid", "Row with unauthorized business ID must be rejected");
  assert.match(res.rows[0].errors[0], /outside your authorized scope/i);
});

test("Scenario 6: Business ID belonging to manager's scope but for another business is rejected as mismatch", () => {
  const otherBiz = MANAGER_AUTHORIZED_BUSINESSES[1]; // Hotel Green Horizon
  const csvContent =
    "Month,Business ID,Business Name,Location,Total Sales\n" +
    `September 2026,${otherBiz._id},${otherBiz.name},Ranchi,180000\n`;

  const res = runValidation(csvContent);

  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].status, "invalid");
  assert.match(res.rows[0].errors[0], new RegExp(`Row Business ID "${otherBiz._id}" is for "${otherBiz.name}, ${otherBiz.city}"`));
});

test("Scenario 7: Ensure Maya Multicuisine Restaurant, Ranchi is not duplicated into both Business Name and Location", () => {
  // Testing accidental duplication where full text is in both columns or mapped together
  const csvContent =
    "Month,Business Name,Location,Total Sales\n" +
    "September 2026,\"Maya Multicuisine Restaurant, Ranchi\",\"Maya Multicuisine Restaurant, Ranchi\",180000\n";

  const res = runValidation(csvContent);

  assert.equal(res.rows[0].status, "valid");
  const data = res.rows[0].data;
  assert.equal(data.businessName, "Maya Multicuisine Restaurant", "Business Name must be stripped of city");
  assert.equal(data.city, "Ranchi", "City must be Ranchi");
  assert.notEqual(data.businessName, data.city, "Business Name and City must never be identical");
});

test("Scenario 8: Corresponding Client Portal receives the record and client isolation is preserved", () => {
  const csvContent =
    "Month,Business Name,Total Sales\n" +
    "September 2026,\"Maya Multicuisine Restaurant, Ranchi\",180000\n";

  const res = runValidation(csvContent);
  assert.equal(res.rows[0].status, "valid");

  const validRows = res.rows.filter((r) => r.status === "valid");
  assert.equal(validRows.length, 1);

  // Trace portal client targets as done in salesImportController.js
  const bizById = new Map(ALL_SYSTEM_BUSINESSES.map((b) => [String(b._id), b]));
  const biz = bizById.get(validRows[0].data.businessId);

  assert.ok(biz, "Business must exist");
  assert.equal(biz.clientAccount, TARGET_MAYA.clientAccount, "Must link to Maya's client portal account");
  assert.notEqual(biz.clientAccount, MANAGER_AUTHORIZED_BUSINESSES[1].clientAccount, "Must NOT link to other client");
  assert.notEqual(biz.clientAccount, UNAUTHORIZED_BUSINESS.clientAccount, "Must NOT leak to unauthorized client");
});
