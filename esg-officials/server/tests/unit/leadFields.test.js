const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

// Load the controller with its models stubbed (no database)
const realLoad = Module._load;
Module._load = function (req, ...rest) {
  if (/models\/|services\/|utils\/istDate|^mongoose$/.test(req)) {
    if (req === "mongoose") return { Types: { ObjectId: { isValid: () => true } } };
    if (req.endsWith("istDate")) return { toISTParts: () => ({ year: 2026, month: 10 }) };
    return { findOne: () => ({ select: async () => null }), schema: { path: () => ({}) }, buildClientSalesFeed() {}, getClientSyncStamp() {} };
  }
  return realLoad.call(this, req, ...rest);
};
const { _leadInternals: L } = require("../../controllers/portalController");
Module._load = realLoad;

test("new enquiry: name required, value/charge must be a non-negative amount", () => {
  assert.match(L.readLeadFields({}, { partial: false }).error, /name is required/);
  assert.match(L.readLeadFields({ name: "A", estimatedValue: -5 }, { partial: false }).error, /positive amount/);
  assert.match(L.readLeadFields({ name: "A", estimatedValue: "abc" }, { partial: false }).error, /positive amount/);
  assert.equal(L.readLeadFields({ name: "A", estimatedValue: "" }, { partial: false }).values.estimatedValue, 0);
  assert.equal(L.readLeadFields({ name: "A", estimatedValue: "1499.999" }, { partial: false }).values.estimatedValue, 1500);
});

test("only whitelisted fields are accepted; enums and email are validated", () => {
  const r = L.readLeadFields({ name: " Ravi ", client: "someone-else", isConverted: true, source: "Referral", status: "Qualified", email: "RAVI@X.COM" }, { partial: false });
  assert.deepEqual(r.values, { name: "Ravi", source: "Referral", status: "Qualified", email: "ravi@x.com" });
  assert.match(L.readLeadFields({ name: "A", source: "Billboard" }, { partial: false }).error, /Source must be/);
  assert.match(L.readLeadFields({ name: "A", status: "Won" }, { partial: false }).error, /Stage must be/);
  assert.match(L.readLeadFields({ name: "A", email: "nope" }, { partial: false }).error, /valid email/);
});

test("partial edits: unchanged fields are left alone", () => {
  assert.deepEqual(L.readLeadFields({ status: "Converted" }, { partial: true }).values, { status: "Converted" });
  assert.deepEqual(L.readLeadFields({ estimatedValue: 2500 }, { partial: true }).values, { estimatedValue: 2500 });
});

test("qualified/converted flags follow the stage", () => {
  const lead = { status: "Converted" };
  L.syncLeadFlags(lead);
  assert.deepEqual([lead.isQualified, lead.isConverted], [true, true]);
  lead.status = "Lost";
  L.syncLeadFlags(lead);
  assert.deepEqual([lead.isQualified, lead.isConverted], [false, false]);
});

test("only the owning client, the assigned manager or an admin may change a lead", async () => {
  const lead = { client: "c1" };
  assert.equal(await L.canManageLead({ user: { role: "admin" } }, lead), true);
  assert.equal(await L.canManageLead({ user: { role: "client", _id: "c1" } }, lead), true);
  assert.equal(await L.canManageLead({ user: { role: "client", _id: "c2" } }, lead), false);
  assert.equal(await L.canManageLead({ user: { role: "manager", _id: "m9" } }, lead), false, "manager not assigned to c1 (stub finds no client)");
});
