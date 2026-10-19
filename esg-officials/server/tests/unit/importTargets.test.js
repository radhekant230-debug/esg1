const test = require("node:test");
const assert = require("node:assert/strict");
const { buildImportTargets, checkTargetForClient } = require("../../services/sales/importTargets");

const clients = [
  { _id: "cMysa", companyName: "Café Mysa", clientId: "CLI-2026-0009" },
  { _id: "cRoyal", companyName: "Hotel Royal", clientId: "CLI-2026-0001" },
  { _id: "cNew", companyName: "Green Leaf", clientId: "CLI-2026-0010" },
];
const businesses = [
  { _id: "bRoyal", name: "Hotel Royal", code: "BIZ-1", city: "Ranchi", state: "Jharkhand", clientAccount: "cMysa" }, // mis-linked
  { _id: "bMysa", name: "CAFE MYSA", code: "BIZ-2", city: "Ranchi", state: "Jharkhand", clientAccount: null },
  { _id: "bOther", name: "Spice Hub", code: "BIZ-3", city: "Ranchi", state: "Jharkhand", clientAccount: "cGone" },
];

test("lists every visible client by its own ID, including new ones without a business", () => {
  const t = buildImportTargets({ clients, businesses });
  assert.deepEqual(t.clients.map((c) => c.name), ["Café Mysa", "Green Leaf", "Hotel Royal"]);
  const green = t.clients.find((c) => c._id === "cNew");
  assert.deepEqual(green.businesses, [], "selectable without any business");
  assert.deepEqual(green.warnings, []);
});

test("a business linked to a differently named client is flagged, never silently trusted", () => {
  const mysa = buildImportTargets({ clients, businesses }).clients.find((c) => c._id === "cMysa");
  assert.deepEqual(mysa.businesses.map((b) => [b._id, b.nameMatchesClient]), [["bRoyal", false]]);
  assert.match(mysa.warnings[0], /"Hotel Royal" \(Ranchi\) is linked to Café Mysa's client portal/);
});

test("clients without a business stay selectable; unlinked businesses are listed separately", () => {
  const t = buildImportTargets({ clients, businesses: businesses.filter((b) => b._id !== "bRoyal") });
  const mysa = t.clients.find((c) => c._id === "cMysa");
  assert.deepEqual([mysa.businesses.length, mysa.warnings.length], [0, 0]);
  assert.equal(mysa.needsBusiness, undefined);
  assert.deepEqual(t.unlinkedBusinesses.map((b) => b._id), ["bMysa"]);
  assert.match(t.unlinkedBusinesses[0].note, /No client portal/);
  assert.deepEqual(t.otherLinkedBusinesses.map((b) => b._id), ["bOther"]);
});

test("target check uses client IDs, not names", () => {
  assert.equal(checkTargetForClient({ name: "CAFE MYSA", city: "Ranchi", clientAccount: "cMysa" }, "cMysa"), null);
  assert.match(checkTargetForClient({ name: "Hotel Royal", city: "Ranchi", clientAccount: "cRoyal" }, "cMysa"), /not linked to the selected client/);
  assert.match(checkTargetForClient({ name: "X", city: "Y", clientAccount: null }, "cMysa"), /not linked/);
});

test("a client's automatic sales ledger is never flagged as a wrong link", () => {
  const t = buildImportTargets({ clients, businesses: [{ _id: "led", name: "Café Mysa", city: "Ranchi", clientAccount: "cMysa", isClientLedger: true }] });
  const mysa = t.clients.find((c) => c._id === "cMysa");
  assert.deepEqual([mysa.businesses[0].isClientLedger, mysa.warnings.length], [true, 0]);
});
