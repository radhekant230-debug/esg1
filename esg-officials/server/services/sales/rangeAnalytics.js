/**
 * Date-range sales analytics (pure — the controller loads the data).
 *
 * Inputs are two kinds of stored sales data for the businesses in scope:
 *   - monthly summaries (SalesRecord, excluding derived "daily_rollup" records)
 *   - date-level entries (SalesEntry: txn / day / period)
 *
 * Rules that prevent double counting (applied per business):
 *   1. A day that has itemised transactions ignores a day-total for that same day.
 *   2. Within the selected period, a monthly/period summary is replaced by daily
 *      data only when daily data exists for EVERY day of the summary's span;
 *      otherwise the summary is used and the incomplete daily rows inside it are
 *      left out. A summary only partly inside the period is not counted, so the
 *      daily rows inside the period are.
 *   3. Two overlapping summaries: the longer one is used.
 *   4. A range includes an item only when the item lies completely inside it.
 *      Items that only partly overlap (e.g. a monthly total vs "last 7 days")
 *      are listed as excluded — values are never pro-rated or invented.
 *
 * Every superseded or excluded item is reported with the reason.
 */
const P = require("./periods");
const { aggregate, growth } = require("./financials");

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const toPaise = (v) => (isNum(v) ? Math.round(v * 100) : null);
const PAYMENT_KEYS = ["cash", "card", "duePayment", "other", "wallet", "upi", "online"];
const METRIC_KEYS = ["grossAmount", "discount", "netSales", "deliveryCharge", "containerCharge", "serviceCharge", "tax", "waivedOff", "roundOff", "totalSales", "notPaid"];
const COUNT_KEYS = ["bills", "pax"];

/** Normalises stored documents to one item shape. */
function toItems({ monthlyRecords = [], entries = [] }) {
  const items = [];
  monthlyRecords.forEach((r) => {
    if (r.source === "daily_rollup") return;
    // Dated SalesRecords (daily/transaction rows saved by the generic importer)
    const dated = r.recordType === "transaction" || r.date || r.startDate;
    if (dated) {
      const s = P.dateToKey(r.startDate || r.date);
      const e = P.dateToKey(r.endDate || r.date || r.startDate);
      return items.push({
        id: String(r._id),
        kind: s === e ? (r.recordType === "transaction" ? "txn" : "day") : "period",
        business: String(r.business),
        businessName: r.businessName,
        city: r.city,
        start: s,
        end: e,
        totalSales: r.totalSales,
        salesBasis: r.salesBasis || "gross",
        orders: isNum(r.orders) ? r.orders : null,
        target: null, // monthly targets are applied per month, never per row
        discount: r.discount ?? null,
        cost: r.cost ?? null,
        expenses: r.expenses ?? null,
        reportedProfit: r.reportedProfit ?? null,
        metrics: null,
        transactionId: r.transactionId || null,
        source: r.source,
        importJob: r.importJob ? String(r.importJob) : null,
        label: s === e ? P.formatKey(s) + (r.transactionId ? ` · ${r.transactionId}` : "") : P.rangeLabel(s, e),
      });
    }
    items.push({
      id: String(r._id),
      kind: "month",
      business: String(r.business),
      businessName: r.businessName,
      city: r.city,
      start: P.monthStart(r.year, r.month),
      end: P.monthEnd(r.year, r.month),
      totalSales: r.totalSales,
      salesBasis: r.salesBasis || "gross",
      orders: isNum(r.orders) ? r.orders : null,
      monthTarget: isNum(r.target) && r.target > 0 ? r.target : null,
      target: null,
      discount: r.discount ?? null,
      cost: r.cost ?? null,
      expenses: r.expenses ?? null,
      reportedProfit: r.reportedProfit ?? null,
      metrics: null,
      source: r.source,
      importJob: r.importJob ? String(r.importJob) : null,
      label: r.monthName,
    });
  });
  entries.forEach((e) => {
    items.push({
      id: String(e._id),
      kind: e.kind,
      business: String(e.business),
      businessName: e.businessName,
      city: e.city,
      start: e.startKey,
      end: e.endKey,
      totalSales: e.totalSales,
      salesBasis: e.salesBasis || "gross",
      orders: isNum(e.orders) ? e.orders : null,
      target: isNum(e.target) && e.target > 0 ? e.target : null,
      discount: e.discount ?? null,
      cost: e.cost ?? null,
      expenses: e.expenses ?? null,
      reportedProfit: e.reportedProfit ?? null,
      metrics: e.metrics || null,
      transactionId: e.transactionId || null,
      invoiceRange: e.invoiceRange || "",
      source: e.source,
      sourceFormat: e.sourceFormat || "generic",
      importJob: e.importJob ? String(e.importJob) : null,
      label: e.kind === "period" ? P.rangeLabel(e.startKey, e.endKey) : P.formatKey(e.startKey) + (e.transactionId ? ` · ${e.transactionId}` : ""),
    });
  });
  return items;
}

/** Applies rules 1–3. Marks item.superseded = reason. */
function applyPrecedence(items) {
  const byBiz = new Map();
  items.forEach((it) => {
    if (!byBiz.has(it.business)) byBiz.set(it.business, []);
    byBiz.get(it.business).push(it);
  });
  byBiz.forEach((list) => {
    // 1. txn vs day totals
    const txnDays = new Set(list.filter((i) => i.kind === "txn").map((i) => i.start));
    list.forEach((i) => {
      if (i.kind === "day" && txnDays.has(i.start)) i.superseded = "Itemised transactions exist for this day";
    });
    // 3. overlapping summaries: keep the longer one
    const broad = list.filter((i) => i.kind === "month" || i.kind === "period").sort((a, b) => P.spanDays(b.start, b.end) - P.spanDays(a.start, a.end));
    broad.forEach((b, idx) => {
      if (b.superseded) return;
      broad.slice(idx + 1).forEach((o) => {
        if (!o.superseded && o.start <= b.end && o.end >= b.start) o.superseded = `Overlaps the longer summary ${b.label}`;
      });
    });
    // Rule 2 (summary vs daily data) depends on the selected period: see select().
  });
  return items;
}

function sumField(items, get) {
  const vals = items.map(get).filter(isNum);
  const total = items.length;
  const status = total === 0 ? "no_records" : !vals.length ? "unavailable" : vals.length < total ? "partial" : "complete";
  return { value: vals.length ? vals.reduce((s, v) => s + toPaise(v), 0) / 100 : null, covered: vals.length, total, status };
}

/** Source-report metrics (restaurant POS reports): exact sums + coverage. */
function sourceMetrics(items) {
  const withM = items.filter((i) => i.metrics);
  if (!withM.length) return null;
  const out = { records: withM.length };
  METRIC_KEYS.forEach((k) => (out[k] = sumField(withM, (i) => i.metrics[k])));
  COUNT_KEYS.forEach((k) => (out[k] = sumField(withM, (i) => i.metrics[k])));
  out.payments = Object.fromEntries(PAYMENT_KEYS.map((k) => [k, sumField(withM, (i) => i.metrics.payments && i.metrics.payments[k])]));
  const pay = PAYMENT_KEYS.map((k) => out.payments[k].value).filter(isNum);
  out.paymentsTotal = pay.length ? Math.round(pay.reduce((s, v) => s + v * 100, 0)) / 100 : null;
  // Reported Net Sales vs My Amount − Discount (both from the report)
  if (isNum(out.grossAmount.value) && isNum(out.discount.value) && isNum(out.netSales.value)) {
    const diff = Math.round((out.netSales.value - (out.grossAmount.value - out.discount.value)) * 100) / 100;
    out.netSalesCheck = { computed: Math.round((out.grossAmount.value - out.discount.value) * 100) / 100, reported: out.netSales.value, difference: diff };
  }
  return out;
}

/**
 * Target vs actual:
 *  - ranges made of whole calendar months use monthly targets (the monthly
 *    record's target, else the business's monthly target) for each
 *    business-month that has data;
 *  - otherwise only targets recorded on the included rows themselves are used.
 */
function targetFor(items, range, bizById) {
  const n = items.length;
  if (P.isWholeMonths(range.start, range.end)) {
    const byBm = new Map();
    items.forEach((i) => {
      const k = `${i.business}:${i.start.slice(0, 7)}`;
      if (!byBm.has(k)) byBm.set(k, []);
      byBm.get(k).push(i);
    });
    let t = 0;
    let a = 0;
    let covered = 0;
    byBm.forEach((list, k) => {
      const [biz] = k.split(":");
      const rec = list.find((i) => i.kind === "month" && i.monthTarget);
      const b = bizById.get(biz);
      const target = rec ? rec.monthTarget : b && b.monthlyTarget > 0 ? b.monthlyTarget : null;
      if (target) {
        t += target;
        a += list.reduce((s, i) => s + (isNum(i.totalSales) ? i.totalSales : 0), 0);
        covered += list.length;
      }
    });
    if (!covered) return { value: null, actual: null, achievement: null, covered: 0, total: n, status: n ? "unavailable" : "no_records", basis: "monthly" };
    return { value: t, actual: Math.round(a * 100) / 100, achievement: t > 0 ? Math.round((a / t) * 10000) / 100 : null, covered, total: n, status: covered < n ? "partial" : "complete", basis: "monthly" };
  }
  const withT = items.filter((i) => isNum(i.target) && i.target > 0);
  if (!withT.length) {
    return { value: null, actual: null, achievement: null, covered: 0, total: n, status: n ? "unavailable" : "no_records", basis: null, note: "Targets are monthly. Choose whole calendar months to compare sales with the target." };
  }
  const t = withT.reduce((s, i) => s + i.target, 0);
  const a = withT.reduce((s, i) => s + (i.totalSales || 0), 0);
  return { value: t, actual: a, achievement: t > 0 ? Math.round((a / t) * 10000) / 100 : null, covered: withT.length, total: n, status: withT.length < n ? "partial" : "complete", basis: "rows" };
}

function summarize(items, range, bizById) {
  const agg = aggregate(items, { targetFor: () => null });
  agg.target = targetFor(items, range, bizById);
  agg.source = sourceMetrics(items);
  return agg;
}

/**
 * Items completely inside the range, the ones that only partly overlap, and
 * the ones left out to avoid double counting. Rule 2 is applied here, relative
 * to the range: a summary that lies inside the range is replaced by daily data
 * only when daily data covers every one of its days; a summary that only partly
 * overlaps the range is not counted, so the daily rows inside the range are.
 */
function select(items, range) {
  const live = items.filter((i) => !i.superseded);
  const reasons = new Map();
  const inside = (i) => i.start >= range.start && i.end <= range.end;
  const dayLevel = live.filter((i) => i.kind === "day" || i.kind === "txn");
  live
    .filter((i) => (i.kind === "month" || i.kind === "period") && inside(i))
    .forEach((b) => {
      const within = dayLevel.filter((d) => d.business === b.business && d.start >= b.start && d.start <= b.end);
      if (!within.length) return;
      const have = new Set(within.map((d) => d.start));
      let complete = true;
      for (let k = b.start; k <= b.end; k = P.addDays(k, 1)) {
        if (!have.has(k)) {
          complete = false;
          break;
        }
      }
      if (complete) reasons.set(b.id, "Daily data covers every day of this period, so the daily rows are used");
      else within.forEach((d) => reasons.set(d.id, `Summary ${b.label} is used because daily data for it is incomplete`));
    });
  const usable = live.filter((i) => !reasons.has(i.id));
  const included = usable.filter(inside);
  const partial = usable.filter((i) => i.start <= range.end && i.end >= range.start && !inside(i));
  const superseded = [
    ...items.filter((i) => i.superseded && i.start <= range.end && i.end >= range.start),
    ...live.filter((i) => reasons.has(i.id)).map((i) => ({ ...i, superseded: reasons.get(i.id) })),
  ];
  return { included, partial, superseded };
}

/**
 * Main entry.
 * args: { businesses, monthlyRecords, entries, range:{start,end,label,preset}, granularity ("auto"|day|week|month|quarter|year), availableRange }
 */
function computeRangeAnalytics({ businesses = [], monthlyRecords = [], entries = [], range, granularity = "auto", availableRange = null }) {
  const bizById = new Map(businesses.map((b) => [String(b._id), b]));
  const items = applyPrecedence(toItems({ monthlyRecords, entries }).filter((i) => bizById.has(i.business)));
  const prevRange = P.previousRange(range);
  const cur = select(items, range);
  const prev = select(items, prevRange);

  const totals = summarize(cur.included, range, bizById);
  const prevTotals = summarize(prev.included, prevRange, bizById);
  const comparable = prev.included.length > 0 && isNum(prevTotals.recordedSales.value) && prevTotals.recordedSales.value > 0;
  totals.growth = {
    recordedSales: comparable && cur.included.length ? growth(totals.recordedSales.value, prevTotals.recordedSales.value) : null,
    net: comparable && cur.included.length ? growth(totals.net.value, prevTotals.net.value) : null,
    reason: !cur.included.length ? "No data in the selected period" : !comparable ? `No sales recorded for the comparison period (${prevRange.label})` : null,
  };

  // ---- granularity & buckets ------------------------------------------------
  const requested = P.GRANULARITIES.includes(granularity) ? granularity : "auto";
  let g = requested === "auto" ? P.defaultGranularity(P.spanDays(range.start, range.end)) : requested;
  if (requested === "auto") {
    let idx = P.GRANULARITIES.indexOf(g);
    while (idx < P.GRANULARITIES.length - 1 && cur.included.some((i) => !P.fitsBucket(i.start, i.end, P.GRANULARITIES[idx]))) idx++;
    g = P.GRANULARITIES[idx];
  }
  const buckets = P.bucketsFor(range.start, range.end, g);
  const notPlotted = [];
  const bucketItems = new Map(buckets.map((b) => [b.key, []]));
  cur.included.forEach((i) => {
    if (!P.fitsBucket(i.start, i.end, g)) return notPlotted.push(i);
    const b = P.bucketOf(i.start, g);
    if (bucketItems.has(b.key)) bucketItems.get(b.key).push(i);
  });
  const trend = buckets.map((b) => {
    const list = bucketItems.get(b.key);
    const a = aggregate(list, { targetFor: () => null });
    const monthlyTargets = g === "month" || g === "quarter" || g === "year" ? targetFor(list, { start: b.start, end: b.end }, bizById) : null;
    const src = sourceMetrics(list);
    return {
      key: b.key,
      label: b.label,
      start: b.start,
      end: b.end,
      records: list.length,
      recordedSales: a.recordedSales.value,
      gross: a.gross.value,
      discount: a.discount.value,
      net: a.net.value,
      netProfit: a.netProfit.value,
      orders: list.length ? a.orders : null,
      target: monthlyTargets ? monthlyTargets.value : null,
      targetActual: monthlyTargets ? monthlyTargets.actual : null,
      reportedTotalSales: src ? src.totalSales.value : null,
      tax: src ? src.tax.value : null,
      bills: src ? src.bills.value : null,
      pax: src ? src.pax.value : null,
    };
  });

  // ---- per business ---------------------------------------------------------
  const businessBreakdown = businesses
    .map((b) => {
      const id = String(b._id);
      const mine = cur.included.filter((i) => i.business === id);
      const theirsPrev = prev.included.filter((i) => i.business === id);
      const a = summarize(mine, range, bizById);
      const pa = aggregate(theirsPrev, { targetFor: () => null });
      return {
        _id: b._id,
        name: b.name,
        city: b.city,
        state: b.state,
        category: b.category,
        records: mine.length,
        hasRecord: mine.length > 0,
        ...a,
        growth: theirsPrev.length && pa.recordedSales.value > 0 && mine.length ? growth(a.recordedSales.value, pa.recordedSales.value) : null,
      };
    })
    .sort((x, y) => (y.recordedSales.value || 0) - (x.recordedSales.value || 0));

  // business × bucket rows (profitability table)
  const profitabilityRows = [];
  buckets.forEach((bk) => {
    const list = bucketItems.get(bk.key);
    const byB = new Map();
    list.forEach((i) => {
      if (!byB.has(i.business)) byB.set(i.business, []);
      byB.get(i.business).push(i);
    });
    byB.forEach((l, id) => {
      const b = bizById.get(id);
      profitabilityRows.push({
        key: `${bk.key}:${id}`,
        period: bk.label,
        start: bk.start,
        end: bk.end,
        businessId: id,
        business: b ? b.name : l[0].businessName,
        city: b ? b.city : l[0].city,
        ...summarize(l, { start: bk.start, end: bk.end }, bizById),
      });
    });
  });
  profitabilityRows.sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : a.business.localeCompare(b.business)));

  // ---- record history & notes -----------------------------------------------
  const hist = (i, status, reason) => ({
    id: i.id,
    status,
    reason: reason || null,
    kind: i.kind,
    business: (bizById.get(i.business) || {}).name || i.businessName,
    city: (bizById.get(i.business) || {}).city || i.city,
    start: i.start,
    end: i.end,
    label: i.label,
    totalSales: i.totalSales,
    discount: i.discount,
    orders: i.orders,
    reportedTotalSales: i.metrics ? i.metrics.totalSales : null,
    invoiceRange: i.invoiceRange || "",
    importJob: i.importJob,
    source: i.source,
  });
  const history = [
    ...cur.included.map((i) => hist(i, "included")),
    ...cur.partial.map((i) => hist(i, "excluded", `Covers ${P.rangeLabel(i.start, i.end)}, which is only partly inside the selected period — not pro-rated`)),
    ...cur.superseded.map((i) => hist(i, "superseded", i.superseded)),
  ].sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0));

  const days = new Set(cur.included.filter((i) => i.kind !== "month" && i.kind !== "period").map((i) => i.start));
  const starts = cur.included.map((i) => i.start).sort();
  const ends = cur.included.map((i) => i.end).sort();
  const notes = [];
  if (cur.partial.length) {
    notes.push({
      type: "excluded",
      text: `${cur.partial.length} summary record(s) only partly overlap this period and are not included (they are never split into days): ${[...new Set(cur.partial.map((i) => i.label))].slice(0, 4).join(", ")}${cur.partial.length > 4 ? "…" : ""}. Choose a period that contains them completely to include them.`,
    });
  }
  if (cur.superseded.length) notes.push({ type: "superseded", text: `${cur.superseded.length} record(s) were not counted to avoid double counting (see Sales record history for the reason).` });
  if (notPlotted.length) {
    notes.push({ type: "granularity", text: `${notPlotted.length} summary record(s) span more than one ${g} and are included in the totals but not in the ${g}ly chart. Choose a coarser view to plot them.` });
  }

  return {
    period: { ...range, previous: prevRange },
    granularity: { used: g, requested },
    coverage: {
      firstDate: starts[0] || null,
      lastDate: ends[ends.length - 1] || null,
      label: starts.length ? P.rangeLabel(starts[0], ends[ends.length - 1]) : null,
      daysWithDailyData: days.size,
      daysInPeriod: P.spanDays(range.start, range.end),
      kinds: cur.included.reduce((m, i) => ((m[i.kind] = (m[i.kind] || 0) + 1), m), {}),
      available: availableRange,
    },
    scope: { businesses: businesses.length },
    totals,
    previousTotals: { recordedSales: prevTotals.recordedSales, net: prevTotals.net, netProfit: prevTotals.netProfit, records: prev.included.length, source: prevTotals.source },
    trend,
    businessBreakdown,
    profitabilityRows,
    history: history.slice(0, 500),
    historyTruncated: history.length > 500,
    notes,
  };
}

module.exports = { computeRangeAnalytics, toItems, applyPrecedence, select, sourceMetrics, targetFor };
