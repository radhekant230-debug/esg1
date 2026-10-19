const test = require("node:test");
const assert = require("node:assert/strict");
const { buildLeadFilter, dateRange, sortFor } = require("../../services/portal/leadAnalytics");

const NOW = new Date("2026-10-18T06:30:00Z"); // 18 Oct 2026, 12:00 IST
const opts = { statuses: ["New", "Contacted", "Qualified", "Converted", "Lost"], sources: ["Walk-in", "Meta Ads"], now: NOW };
const iso = (d) => d.toISOString();

test("date presets use IST calendar days", () => {
  assert.deepEqual([iso(dateRange({ range: "today" }, NOW).from), iso(dateRange({ range: "today" }, NOW).to)], ["2026-10-17T18:30:00.000Z", "2026-10-18T18:29:59.999Z"]);
  assert.equal(iso(dateRange({ range: "yesterday" }, NOW).from), "2026-10-16T18:30:00.000Z");
  assert.equal(iso(dateRange({ range: "last7" }, NOW).from), "2026-10-11T18:30:00.000Z");
  assert.equal(iso(dateRange({ range: "last30" }, NOW).from), "2026-09-18T18:30:00.000Z");
  assert.equal(iso(dateRange({ range: "thisMonth" }, NOW).from), "2026-09-30T18:30:00.000Z");
  const lm = dateRange({ range: "lastMonth" }, NOW);
  assert.deepEqual([iso(lm.from), iso(lm.to)], ["2026-08-31T18:30:00.000Z", "2026-09-30T18:29:59.999Z"]);
  const c = dateRange({ range: "custom", from: "2026-10-05", to: "2026-10-01" }, NOW);
  assert.ok(c.swapped && c.from < c.to);
  assert.equal(dateRange({ range: "custom", from: "bad" }, NOW), null);
  assert.equal(dateRange({}, NOW), null);
});

test("filters combine; unknown values are ignored", () => {
  const { filter } = buildLeadFilter("C", { status: "Converted", source: "Walk-in", segment: "Loyal", valueBand: "medium", range: "last7", q: "ra" }, opts);
  assert.equal(filter.client, "C");
  assert.equal(filter.status, "Converted");
  assert.equal(filter.source, "Walk-in");
  assert.ok(filter.campaign.test("RFM: Loyal") && !filter.campaign.test("RFM: Loyal Big"));
  assert.deepEqual(filter.estimatedValue, { $gte: 5000, $lt: 25000 });
  assert.ok(filter.enquiryDate.$gte && filter.enquiryDate.$lte);
  assert.equal(filter.$or.length, 4);

  const bad = buildLeadFilter("C", { status: "Hacked", source: "$where", valueBand: "nope", q: "a.*(" }, opts).filter;
  assert.equal(bad.status, undefined);
  assert.equal(bad.source, undefined);
  assert.equal(bad.estimatedValue, undefined);
  assert.ok(bad.$or[0].name.test("xa.*(y"), "search text is escaped");
});

test("custom value range is inclusive; high band has no upper bound", () => {
  assert.deepEqual(buildLeadFilter("C", { valueBand: "custom", valueMin: "100", valueMax: "900" }, opts).filter.estimatedValue, { $gte: 100, $lte: 900 });
  assert.deepEqual(buildLeadFilter("C", { valueBand: "high" }, opts).filter.estimatedValue, { $gte: 25000 });
  assert.equal(buildLeadFilter("C", { valueBand: "custom" }, opts).filter.estimatedValue, undefined);
});

test("sort options", () => {
  assert.deepEqual(sortFor("sales_desc"), { estimatedValue: -1, _id: -1 });
  assert.deepEqual(sortFor("oldest"), { enquiryDate: 1, _id: 1 });
  assert.deepEqual(sortFor("revenue_desc"), { isConverted: -1, estimatedValue: -1, _id: -1 });
  assert.deepEqual(sortFor("whatever"), { enquiryDate: -1, _id: -1 });
});

// ---- salesAnalytics source selection (aggregation results stubbed) ----
const { salesAnalytics } = require("../../services/portal/leadAnalytics");
const lean = (rows) => ({ select: () => ({ lean: async () => rows }) });
const models = ({ biz = [], bizAgg = null, locs = [], entryAgg = null, csrAgg = null }) => ({
  Business: { find: () => lean(biz) },
  BizSale: { aggregate: async () => [bizAgg] },
  SalesBusiness: { find: () => lean(locs) },
  SalesEntry: { aggregate: async () => [entryAgg] },
  ClientSalesRecord: { aggregate: async () => [csrAgg || { totals: [], products: [], categories: [], trend: [] }] },
});

test("no product-level data → available:false, nothing invented", async () => {
  const r = await salesAnalytics(models({}), "C", null);
  assert.equal(r.available, false);
  assert.deepEqual(r.products, []);
  assert.equal(r.totals, null);
});

test("POS line items give product, category, customer and highest-sale figures", async () => {
  const r = await salesAnalytics(
    models({
      biz: [{ _id: "b1" }],
      bizAgg: {
        totals: [{ revenue: 1500, sales: 3, max: 900 }],
        highest: [{ total: 900, invoiceNo: "INV-1", customerName: "Asha" }],
        products: [{ name: "Latte", units: 5, revenue: 750, category: "Coffee" }, { name: "Cake", units: 2, revenue: 750, category: "Bakery" }],
        customers: [{ name: "Asha", total: 900, sales: 1 }],
        trend: [{ _id: "2026-10-01", revenue: 1500, sales: 3 }],
      },
    }),
    "C",
    null
  );
  assert.equal(r.available, true);
  assert.equal(r.totals.unitsSold, 7);
  assert.equal(r.totals.avgSale, 500);
  assert.equal(r.totals.highestSale.amount, 900);
  assert.equal(r.products[0].name, "Latte");
  assert.equal(r.categories.length, 2);
});

test("POS imports give revenue only; products stay unavailable without item data", async () => {
  const r = await salesAnalytics(
    models({ locs: [{ _id: "s1", name: "Cafe", city: "Ranchi" }], entryAgg: { totals: [{ revenue: 10000, txns: 40, rows: 5 }], highest: [], trend: [] } }),
    "C",
    null
  );
  assert.equal(r.available, false);
  assert.equal(r.totals.revenue, 10000);
  assert.equal(r.totals.avgSale, 250);
  assert.equal(r.totals.highestSale, null);
  assert.equal(r.locations[0].city, "Ranchi");
});
