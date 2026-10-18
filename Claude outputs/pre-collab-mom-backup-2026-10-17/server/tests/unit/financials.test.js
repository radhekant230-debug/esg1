const test = require("node:test");
const assert = require("node:assert/strict");
const { aggregate, recordFinancials, growth } = require("../../services/sales/financials");

// Scenario 8 — known test data
const A = { business: "a", totalSales: 100000, salesBasis: "gross", discount: 10000, cost: 50000, expenses: 20000, orders: 50, target: 120000 };
const B = { business: "b", totalSales: 45000, salesBasis: "net", discount: 5000, cost: 30000, expenses: 20000, orders: 20, target: 0 };
const C = { business: "c", totalSales: 80000, salesBasis: "gross", discount: null, cost: null, expenses: null, orders: 30, target: 70000 };

test("per-record rules: gross basis subtracts discount, net basis does not subtract again", () => {
  const a = recordFinancials(A);
  assert.deepEqual([a.gross, a.net, a.grossProfit, a.netProfit], [100000, 90000, 40000, 20000]);
  const b = recordFinancials(B);
  assert.deepEqual([b.gross, b.net, b.grossProfit, b.netProfit], [50000, 45000, 15000, -5000]); // a loss
  const c = recordFinancials(C);
  assert.deepEqual([c.gross, c.discount, c.net, c.grossProfit, c.netProfit], [80000, null, null, null, null]);
});

test("Scenario 8: monthly aggregates with coverage (missing data is never treated as zero)", () => {
  const m = aggregate([A, B, C]);
  assert.equal(m.recordCount, 3);
  assert.equal(m.orders, 100);
  assert.equal(m.recordedSales.value, 225000);
  assert.deepEqual([m.gross.value, m.gross.status], [230000, "complete"]);
  assert.deepEqual([m.discount.value, m.discount.status, m.discount.covered], [15000, "partial", 2]);
  assert.deepEqual([m.net.value, m.net.status], [135000, "partial"]);
  assert.equal(m.grossProfit.value, 55000);
  assert.equal(m.netProfit.value, 15000);
  assert.equal(m.profitMargin.value, 11.11); // 15000 / 135000
  // target: A (120000) + C (70000); B has no target -> not counted
  assert.deepEqual([m.target.value, m.target.actual, m.target.achievement, m.target.status], [190000, 180000, 94.74, "partial"]);
});

test("all costs missing -> profit Data unavailable, not 0", () => {
  const m = aggregate([C, { ...C, business: "d" }]);
  assert.equal(m.discount.value, null);
  assert.equal(m.discount.status, "unavailable");
  assert.equal(m.net.status, "unavailable");
  assert.equal(m.grossProfit.value, null);
  assert.equal(m.profitMargin.value, null);
});

test("no records", () => {
  const m = aggregate([]);
  assert.equal(m.recordedSales.status, "no_records");
  assert.equal(m.recordedSales.value, null);
});

test("explicit zero discount is a known value", () => {
  const m = aggregate([{ totalSales: 1000, salesBasis: "gross", discount: 0, cost: 400, expenses: 100 }]);
  assert.deepEqual([m.net.value, m.grossProfit.value, m.netProfit.value, m.profitMargin.value], [1000, 600, 500, 50]);
});

test("month-over-month growth", () => {
  assert.equal(growth(110, 100), 10);
  assert.equal(growth(100, 0), null);
  assert.equal(growth(null, 100), null);
});

test("reported Profit/Loss is used only when profit cannot be calculated", () => {
  const m = aggregate([{ totalSales: 1000, salesBasis: "gross", discount: 0, cost: null, reportedProfit: -200 }]);
  assert.equal(m.netProfit.value, -200);
  const calc = recordFinancials({ totalSales: 1000, salesBasis: "gross", discount: 0, cost: 400, expenses: 100, reportedProfit: 999 });
  assert.equal(calc.netProfit, 500);
  assert.equal(calc.netProfitSource, "calculated");
});
