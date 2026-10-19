const test = require("node:test");
const assert = require("node:assert/strict");
const ci = require("../../services/portal/customerInsights");
const { mapRows } = require("../../services/portal/leadImport");

const D = (s) => new Date(s);
const lead = (o) => ({ statuses: [o.status || "New"], enquiries: 1, enquiriesInRange: 1, converted: 0, convertedInRange: 0, lost: 0, maxEstimate: 0, lastEnquiry: D("2026-10-01"), statsVisits: null, statsSpent: null, statsLastVisit: null, source: "Walk-in", status: "New", ...o });
const txn = (o) => ({ name: "", phone: "", email: "", days: new Set(), daysInRange: new Set(), spent: 0, spentInRange: 0, bills: 0, last: null, ...o });

test("customer identity: phone (last 10 digits) first, then email, never name", () => {
  assert.equal(ci.customerKey({ phone: "+91 98765-43210" }), "p:9876543210");
  assert.equal(ci.customerKey({ phone: "09876543210", email: "x@y.com" }), "p:9876543210");
  assert.equal(ci.customerKey({ phone: "12", email: " A@B.com " }), "e:a@b.com");
  assert.equal(ci.customerKey({ id: "L1" }), "l:L1");
});

test("visits come from distinct sale days; enquiries are counted separately; estimates are not spending", () => {
  const rows = ci.mergeCustomers(
    [lead({ _id: "p:9876543210", leadId: "L1", name: "Asha", enquiries: 3, enquiriesInRange: 3, maxEstimate: 90000 })],
    [txn({ key: "p:9876543210", days: new Set(["2026-10-01", "2026-10-05"]), spent: 1500, bills: 3, last: D("2026-10-05T10:00:00Z") })],
    null
  );
  assert.equal(rows.length, 1);
  const c = rows[0];
  assert.deepEqual([c.visits, c.enquiries, c.spent, c.type, c.dataSource], [2, 3, 1500, "Returning", "POS sales"]);
});

test("customer-list figures are used when there are no POS sales; missing data stays null", () => {
  const rows = ci.mergeCustomers(
    [
      lead({ _id: "p:1111111111", leadId: "L1", name: "Ravi", statsVisits: 1, statsSpent: 400, statsLastVisit: D("2026-09-01") }),
      lead({ _id: "p:2222222222", leadId: "L2", name: "Meera", maxEstimate: 5000 }),
    ],
    [],
    null
  );
  const ravi = rows.find((r) => r.name === "Ravi");
  const meera = rows.find((r) => r.name === "Meera");
  assert.deepEqual([ravi.visits, ravi.spent, ravi.type, ravi.scope], [1, 400, "New", "lifetime"]);
  assert.deepEqual([meera.visits, meera.spent, meera.type, meera.lastVisit], [null, null, null, null]);
});

test("date range: visits/spend inside the range; customers with no activity in range are left out", () => {
  const range = { from: D("2026-10-01T00:00:00+05:30"), to: D("2026-10-31T23:59:59+05:30") };
  const rows = ci.mergeCustomers(
    [lead({ _id: "p:1", leadId: "L1", name: "Old", enquiriesInRange: 0 }), lead({ _id: "p:2", leadId: "L2", name: "Now" })],
    [txn({ key: "p:3", name: "Buyer", days: new Set(["2026-09-01", "2026-10-02"]), daysInRange: new Set(["2026-10-02"]), spent: 900, spentInRange: 300, last: D("2026-10-02") })],
    range
  );
  assert.deepEqual(rows.map((r) => r.name).sort(), ["Buyer", "Now"]);
  const b = rows.find((r) => r.name === "Buyer");
  assert.deepEqual([b.visits, b.lifetimeVisits, b.spent, b.type, b.leadId], [1, 2, 300, "Returning", null]);
});

const sample = () =>
  ci.mergeCustomers(
    [
      lead({ _id: "p:1", leadId: "1", name: "A", statsVisits: 12, statsSpent: 9000, statsLastVisit: D("2026-10-10"), status: "Converted", statuses: ["Converted"], converted: 2, convertedInRange: 2 }),
      lead({ _id: "p:2", leadId: "2", name: "B", statsVisits: 1, statsSpent: 300, statsLastVisit: D("2026-05-01"), enquiries: 4, enquiriesInRange: 4, lastEnquiry: D("2026-05-01") }),
      lead({ _id: "p:3", leadId: "3", name: "C", statsVisits: 4, statsSpent: 2500, statsLastVisit: D("2026-10-15"), status: "Lost", statuses: ["Lost"], lost: 1, source: "Meta Ads" }),
      lead({ _id: "p:4", leadId: "4", name: "D", maxEstimate: 70000, lastEnquiry: D("2026-10-16") }),
    ],
    [],
    null
  );
const names = (r) => r.list.map((c) => c.name);
const NOW = D("2026-10-18T06:30:00Z");

test("insights rank customers correctly", () => {
  const s = sample();
  assert.deepEqual(names(ci.filterCustomers(s, { insight: "topSpending" }, NOW)), ["A", "C", "B"]);
  assert.deepEqual(names(ci.filterCustomers(s, { insight: "frequentVisitors" }, NOW)), ["A", "C", "B"]);
  assert.deepEqual(names(ci.filterCustomers(s, { insight: "frequentEnquirers" }, NOW))[0], "B");
  assert.deepEqual(names(ci.filterCustomers(s, { insight: "recentVisitors" }, NOW)), ["C", "A", "B"]);
  assert.deepEqual(names(ci.filterCustomers(s, { insight: "inactive", inactiveDays: "60" }, NOW)), ["B"]);
  assert.deepEqual(names(ci.filterCustomers(s, { insight: "topConverted" }, NOW)), ["A"]);
  assert.deepEqual(names(ci.filterCustomers(s, { insight: "lostLeads" }, NOW)), ["C"]);
  assert.deepEqual(names(ci.filterCustomers(s, { insight: "highValueLeads" }, NOW)), ["D"]);
  assert.deepEqual(names(ci.filterCustomers(s, { insight: "newVsReturning" }, NOW)), ["A", "C", "B"]);
});

test("filters combine: visits band, spend range, type, status, source, search", () => {
  const s = sample();
  assert.deepEqual(names(ci.filterCustomers(s, { visits: "2-5" }, NOW)), ["C"]);
  assert.deepEqual(names(ci.filterCustomers(s, { visits: "10+" }, NOW)), ["A"]);
  assert.deepEqual(names(ci.filterCustomers(s, { visits: "one" }, NOW)), ["B"]);
  assert.deepEqual(names(ci.filterCustomers(s, { spendMin: "1000", spendMax: "5000" }, NOW)), ["C"]);
  assert.deepEqual(names(ci.filterCustomers(s, { type: "returning", sort: "spend_desc" }, NOW)), ["A", "C"]);
  assert.deepEqual(names(ci.filterCustomers(s, { type: "new" }, NOW)), ["B"]);
  assert.deepEqual(names(ci.filterCustomers(s, { status: "Lost", source: "Meta Ads" }, NOW)), ["C"]);
  assert.deepEqual(names(ci.filterCustomers(s, { customer: "d" }, NOW)), ["D"]);
});

test("summary cards use actual values only", () => {
  const sum = ci.summarize(ci.filterCustomers(sample(), {}, NOW).list);
  assert.equal(sum.uniqueCustomers, 4);
  assert.equal(sum.totalVisits, 17);
  assert.equal(sum.returningCustomers, 2);
  assert.deepEqual(sum.highestSpender, { name: "A", spent: 9000 });
  assert.deepEqual(sum.mostFrequentVisitor, { name: "A", visits: 12 });
  assert.equal(sum.avgSpending, 3933.33, "average over customers with recorded spending (D excluded)");
  assert.equal(sum.convertedEnquiries, 2);
  assert.equal(sum.coverage.withSpendData, 3);
  const none = ci.summarize(ci.mergeCustomers([lead({ _id: "p:9", leadId: "9", name: "X" })], [], null));
  assert.deepEqual([none.totalVisits, none.returningCustomers, none.avgSpending, none.highestSpender], [null, null, null, null]);
});

test("import: actual spend/visits stored only from columns that record them", () => {
  const sheet = (headers, cells) => ({ headers, rows: [{ rowNumber: 2, cells }] });
  const pos = mapRows(sheet(["name", "phone", "last_visited_at", "total_spent", "total_visits"], ["Asha", "9876543210", "2026-10-01 20:00:00", "₹2,500", "7"]), { sources: ["Walk-in"] });
  assert.deepEqual([pos.leads[0].stats.visits, pos.leads[0].stats.totalSpent], [7, 2500]);
  assert.ok(pos.leads[0].stats.lastVisitAt instanceof Date);
  const enq = mapRows(sheet(["Name", "Phone", "Date", "Estimated Value"], ["Ravi", "9876500000", "2026-10-01", "50000"]), { sources: ["Walk-in"] });
  assert.equal(enq.leads[0].stats, null, "an enquiry estimate is never stored as spending");
});

test("older import notes are parsed for the backfill", () => {
  assert.deepEqual(ci.parseImportNote("Imported from customer list: 3 visits · total spent ₹1,250 · RFM segment: Loyal"), { visits: 3, totalSpent: 1250, avgSpend: null });
  assert.equal(ci.parseImportNote("Imported from customer list: total spent ₹1,250"), null);
});

test("leaderboard: ranks by each metric, sequential ranks, missing metrics excluded not zeroed", () => {
  const rows = ci.mergeCustomers(
    [
      lead({ _id: "p:1", leadId: "1", name: "A", statsVisits: 12, statsSpent: 9000, statsAvg: 750, statsLastVisit: D("2026-10-10"), status: "Converted", statuses: ["Converted"], converted: 1, convertedInRange: 1, enquiries: 2, enquiriesInRange: 2 }),
      lead({ _id: "p:2", leadId: "2", name: "B", statsVisits: 1, statsSpent: 300, statsAvg: 300, statsLastVisit: D("2026-10-16"), enquiries: 5, enquiriesInRange: 5 }),
      lead({ _id: "p:3", leadId: "3", name: "C", statsVisits: 4, statsSpent: 2500, statsAvg: 900, statsLastVisit: D("2026-10-12"), status: "Converted", statuses: ["Converted"], converted: 2, convertedInRange: 2, maxEstimate: 99999 }),
      lead({ _id: "p:4", leadId: "4", name: "D", maxEstimate: 70000 }),
    ],
    [],
    null
  );
  const names = (r) => r.list.map((c) => `#${c.rank} ${c.name}`);
  assert.deepEqual(names(ci.rankCustomers(rows, { rankBy: "spending" })), ["#1 A", "#2 C", "#3 B"]);
  assert.equal(ci.rankCustomers(rows, { rankBy: "spending" }).excluded, 1, "D has no spending and is not ranked as ₹0");
  assert.deepEqual(names(ci.rankCustomers(rows, { rankBy: "visits" })), ["#1 A", "#2 C", "#3 B"]);
  assert.deepEqual(names(ci.rankCustomers(rows, { rankBy: "enquiries" })), ["#1 B", "#2 A", "#3 C", "#4 D"]);
  assert.deepEqual(names(ci.rankCustomers(rows, { rankBy: "avg" })), ["#1 C", "#2 A", "#3 B"]);
  assert.deepEqual(names(ci.rankCustomers(rows, { rankBy: "recent" })), ["#1 B", "#2 C", "#3 A"]);
  assert.deepEqual(names(ci.rankCustomers(rows, { rankBy: "converted" })), ["#1 A", "#2 C"], "actual spending of converted customers, not the ₹99,999 estimate");
  assert.deepEqual(names(ci.rankCustomers(rows, { rankBy: "spending", dir: "asc" })), ["#1 B", "#2 C", "#3 A"]);
  assert.deepEqual(names(ci.rankCustomers(rows, { rankBy: "spending", top: 2 })), ["#1 A", "#2 C"]);
  const filtered = ci.filterCustomers(rows, { type: "returning" }).list;
  assert.deepEqual(names(ci.rankCustomers(filtered, { rankBy: "spending" })), ["#1 A", "#2 C"], "ranks restart at #1 after filtering");
});

test("customer base is computed once per client and range, shared, and cleared by writes", async () => {
  let calls = 0;
  const ClientLead = { aggregate: async () => (calls++, [lead({ _id: "p:1", leadId: "1", name: "A", statsVisits: 2, statsSpent: 100 })]) };
  const salesModels = { Business: { find: () => ({ select: () => ({ lean: async () => [] }) }) } };
  const [a, b] = await Promise.all([ci.customerBase({ ClientLead, salesModels, clientObjectId: "CX" }), ci.customerBase({ ClientLead, salesModels, clientObjectId: "CX" })]);
  assert.equal(calls, 1, "concurrent requests share one computation");
  assert.equal(a, b);
  await ci.customerBase({ ClientLead, salesModels, clientObjectId: "CY" });
  assert.equal(calls, 2, "another client is computed separately");
  ci.invalidateCustomerBase("CX");
  await ci.customerBase({ ClientLead, salesModels, clientObjectId: "CX" });
  assert.equal(calls, 3);
  assert.equal(a.all[0].visits, 2);
});
