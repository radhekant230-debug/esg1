/**
 * Monthly sales / discount / profit & loss calculations (pure).
 *
 * Rules (applied per record, then summed):
 *  - Gross sales  = recorded sales before discounts. Records stored as "net"
 *                   only have a gross figure when their discount is known.
 *  - Discount     = recorded discount (null = not recorded, never assumed 0).
 *  - Net sales    = gross − discount for "gross" records; the recorded value for
 *                   "net" records (no double subtraction).
 *  - Gross profit = net sales − cost (only when cost is recorded).
 *  - Net profit   = gross profit − operating expenses (only when recorded);
 *                   otherwise the Profit/Loss value reported in the uploaded file.
 *  - Margin %     = net profit ÷ net sales × 100 (only when net sales > 0).
 *
 * Every aggregate carries coverage: how many records contributed, so the UI can
 * show "Data unavailable" (0 records) or "Partial (x of n records)".
 */

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const round2 = (n) => Math.round(n * 100) / 100;

function recordFinancials(r) {
  const basis = r.salesBasis === "net" ? "net" : "gross";
  const sales = isNum(r.totalSales) ? r.totalSales : null;
  const discount = isNum(r.discount) ? r.discount : null;
  const cost = isNum(r.cost) ? r.cost : null;
  const expenses = isNum(r.expenses) ? r.expenses : null;

  let gross = null;
  let net = null;
  if (sales !== null) {
    if (basis === "gross") {
      gross = sales;
      net = discount !== null ? sales - discount : null;
    } else {
      net = sales;
      gross = discount !== null ? sales + discount : null;
    }
  }
  const grossProfit = net !== null && cost !== null ? net - cost : null;
  let netProfit = grossProfit !== null && expenses !== null ? grossProfit - expenses : null;
  let netProfitSource = netProfit !== null ? "calculated" : null;
  // Fall back to the Profit/Loss figure reported in the uploaded file
  if (netProfit === null && isNum(r.reportedProfit)) {
    netProfit = r.reportedProfit;
    netProfitSource = "reported";
  }

  return { basis, recordedSales: sales, gross, discount, net, cost, grossProfit, expenses, netProfit, netProfitSource };
}

function metric(values, total) {
  const present = values.filter((v) => v !== null);
  const value = present.length ? round2(present.reduce((s, v) => s + v, 0)) : null;
  return {
    value,
    covered: present.length,
    total,
    status: total === 0 ? "no_records" : present.length === 0 ? "unavailable" : present.length < total ? "partial" : "complete",
  };
}

/**
 * Aggregates records for one period.
 * targetFor(record) -> target number or null (not configured)
 */
function aggregate(records, { targetFor = (r) => (isNum(r.target) && r.target > 0 ? r.target : null) } = {}) {
  const n = records.length;
  const fins = records.map(recordFinancials);

  const recordedSales = metric(fins.map((f) => f.recordedSales), n);
  const gross = metric(fins.map((f) => f.gross), n);
  const discount = metric(fins.map((f) => f.discount), n);
  const net = metric(fins.map((f) => f.net), n);
  const cost = metric(fins.map((f) => f.cost), n);
  const grossProfit = metric(fins.map((f) => f.grossProfit), n);
  const expenses = metric(fins.map((f) => f.expenses), n);
  const netProfit = metric(fins.map((f) => f.netProfit), n);

  // Margin only over records where both net sales and net profit exist.
  const marginPairs = fins.filter((f) => f.net !== null && f.netProfit !== null);
  const marginNet = marginPairs.reduce((s, f) => s + f.net, 0);
  const marginProfit = marginPairs.reduce((s, f) => s + f.netProfit, 0);
  const profitMargin = {
    value: marginPairs.length && marginNet > 0 ? round2((marginProfit / marginNet) * 100) : null,
    covered: marginPairs.length,
    total: n,
    status:
      n === 0 ? "no_records" : !marginPairs.length || marginNet <= 0 ? "unavailable" : marginPairs.length < n ? "partial" : "complete",
  };

  const orders = records.reduce((s, r) => s + (isNum(r.orders) ? r.orders : 0), 0);

  const targets = records.map((r) => targetFor(r));
  const withTarget = records.filter((_, i) => targets[i] !== null);
  const targetTotal = targets.filter((t) => t !== null).reduce((s, t) => s + t, 0);
  const salesAgainstTarget = withTarget.reduce((s, r) => s + (isNum(r.totalSales) ? r.totalSales : 0), 0);
  const target = {
    value: withTarget.length ? round2(targetTotal) : null,
    actual: withTarget.length ? round2(salesAgainstTarget) : null,
    achievement: withTarget.length && targetTotal > 0 ? round2((salesAgainstTarget / targetTotal) * 100) : null,
    covered: withTarget.length,
    total: n,
    status: n === 0 ? "no_records" : !withTarget.length ? "unavailable" : withTarget.length < n ? "partial" : "complete",
  };

  return {
    recordCount: n,
    orders,
    recordedSales,
    gross,
    discount,
    net,
    cost,
    grossProfit,
    expenses,
    netProfit,
    profitMargin,
    target,
  };
}

/** Month-over-month growth on a metric value; null when not computable. */
function growth(current, previous) {
  if (!isNum(current) || !isNum(previous) || previous <= 0) return null;
  return round2(((current - previous) / previous) * 100);
}

module.exports = { recordFinancials, aggregate, growth, round2 };
