const test = require("node:test");
const assert = require("node:assert/strict");
const { importCustomerList } = require("../../services/portal/customerListImport");
const ci = require("../../services/portal/customerInsights");

// POS customer-list layout (same columns as the Petpooja export), synthetic rows
const CSV = Buffer.from(
  [
    "name,email,phone,gender,birthday,anniversary,address,last_visited_at,rfm_segment,total_spent,avg_spend,total_visits,points_balance,redemptions,customer_tags,average_tbo_in_days",
    "Asha,,9876500001,female,,,,2026-10-15 20:10:00,loyal,52000,520,100,0,0,,0",
    "Ravi,ravi@x.in,9876500002,male,,,,2026-02-21 22:56:59,lost,1772,886,2,0,0,,0",
    "Meera,,9876500003,,,,,2025-04-07 19:18:45,one-time-visitor,1124,1124,1,0,0,,0",
    "Never,,9876500004,,,,,1970-01-01 05:30:00,imported,0,0,0,0,0,,0",
    ",,,,,,,1970-01-01 05:30:00,imported,0,0,0,0,0,,0",
  ].join("\n")
);
const SOURCES = ["Walk-in", "Other"];

function fakeModel() {
  let seq = 0;
  const db = [];
  return {
    db,
    find(f) {
      const ph = new Set(f.$or[0].phone.$in);
      const em = new Set(f.$or[1].email.$in);
      const rows = db.filter((d) => String(d.client) === String(f.client) && ((d.phone && ph.has(d.phone)) || (d.email && em.has(d.email))));
      return { select: () => ({ lean: async () => rows.map((d) => ({ ...d })) }) };
    },
    async insertMany(docs) {
      docs.forEach((d) => db.push({ _id: `id${++seq}`, ...structuredClone(d) }));
      return docs;
    },
    async bulkWrite(ops) {
      let n = 0;
      ops.forEach(({ updateOne: { filter, update } }) => {
        const d = db.find((x) => x._id === filter._id && String(x.client) === String(filter.client));
        const before = JSON.stringify(d);
        Object.assign(d, structuredClone(update.$set));
        if (JSON.stringify(d) !== before) n++;
      });
      return { modifiedCount: n };
    },
  };
}
const run = (M, client, mode) => importCustomerList({ ClientLead: M, clientId: client, buffer: CSV, filename: "customers.csv", sources: SOURCES, mode });

test("maps total_spent, total_visits, last_visited_at, avg_spend and rfm_segment", async () => {
  const M = fakeModel();
  const out = await run(M, "A", "commit");
  assert.deepEqual(out.result, { created: 4, updated: 0, unchanged: 0, skipped: 1 });
  const asha = M.db.find((d) => d.name === "Asha");
  assert.deepEqual([asha.customerStats.visits, asha.customerStats.totalSpent, asha.customerStats.avgSpend], [100, 52000, 520]);
  assert.equal(asha.customerStats.lastVisitAt.toISOString(), "2026-10-15T14:40:00.000Z");
  assert.equal(asha.campaign, "RFM: loyal");
  const never = M.db.find((d) => d.name === "Never");
  assert.equal(never.customerStats.lastVisitAt, null, "1970 placeholder is not a visit");
  assert.equal(never.status, "New");
  assert.deepEqual(out.summary.customerData, { withVisits: 4, withSpend: 4, withLastVisit: 3, totalVisits: 103, totalSpent: 54896 });
});

test("preview writes nothing; re-import updates instead of duplicating; other clients untouched", async () => {
  const M = fakeModel();
  await run(M, "A", "preview");
  assert.equal(M.db.length, 0);
  await run(M, "A", "commit");
  const again = await run(M, "A", "commit");
  assert.deepEqual(again.result, { created: 0, updated: 0, unchanged: 4, skipped: 1 });
  assert.equal(M.db.length, 4);
  const b = await run(M, "B", "commit");
  assert.equal(b.result.created, 4, "same phones under another client are a separate customer base");
  assert.equal(M.db.filter((d) => d.client === "A").length, 4);
});

test("imported figures drive the Customer Insights cards", async () => {
  const M = fakeModel();
  await run(M, "A", "commit");
  const groups = M.db.map((d) => ({
    _id: ci.customerKey({ phone: d.phone, email: d.email, id: d._id }), leadId: d._id, name: d.name, phone: d.phone, email: d.email, source: d.source, campaign: d.campaign, status: d.status, statuses: [d.status],
    enquiries: 1, enquiriesInRange: 1, converted: d.status === "Converted" ? 1 : 0, convertedInRange: 0, lost: 0, maxEstimate: d.estimatedValue, lastEnquiry: d.enquiryDate,
    statsVisits: d.customerStats.visits, statsSpent: d.customerStats.totalSpent, statsLastVisit: d.customerStats.lastVisitAt,
  }));
  const rows = ci.mergeCustomers(groups, [], null);
  const s = ci.summarize(ci.filterCustomers(rows, {}).list);
  assert.deepEqual(
    [s.uniqueCustomers, s.totalVisits, s.returningCustomers, s.newCustomers, s.highestSpender.name, s.mostFrequentVisitor.visits, s.avgSpending, s.convertedEnquiries],
    [4, 103, 2, 1, "Asha", 100, 13724, 3]
  );
  assert.deepEqual(ci.filterCustomers(rows, { segment: "lost" }).list.map((c) => c.name), ["Ravi"]);
  assert.deepEqual(ci.filterCustomers(rows, { sort: "recent_visit" }).list.map((c) => c.name), ["Asha", "Ravi", "Meera", "Never"]);
  assert.equal(ci.filterCustomers(rows, { sort: "segment" }).list[0].segment, "imported");
});
