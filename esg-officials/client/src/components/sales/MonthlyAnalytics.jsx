import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { FaFileCsv, FaFileExcel, FaCloudUploadAlt } from "react-icons/fa";
import api from "../../utils/axios";
import { Card, Alert, Spinner, EmptyState, btn, inputCls, labelCls, errorMessage, downloadBlob, formatINR } from "../planner/plannerUi";
import { metricDisplay, growthText } from "./metricFormat";
import ExcelUploadModal from "./ExcelUploadModal";

// Validated categorical slots (light surface) — fixed order, never cycled.
const C = { sales: "#2a78d6", target: "#eb6834", net: "#1baf7a", profit: "#6250d6", loss: "#e34948", report: "#0e8a9e", grid: "#e7e5e4", axis: "#78716c", prev: "#a8a29e" };
const axisTick = { fontSize: 11, fill: C.axis };
const yFmt = (v) => (Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(1)}L` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : v);
const tooltipFmt = (v) => (v === null || v === undefined ? "Data unavailable" : formatINR(v));

const PRESETS = [
  ["today", "Today"],
  ["last_7_days", "Last 7 days"],
  ["last_30_days", "Last 30 days"],
  ["this_week", "This week"],
  ["previous_week", "Previous week"],
  ["this_month", "This month"],
  ["previous_month", "Previous month"],
  ["this_quarter", "This quarter"],
  ["previous_quarter", "Previous quarter"],
  ["this_year", "This year"],
  ["custom", "Custom range"],
];
const VIEWS = [
  ["auto", "Auto"],
  ["day", "Daily"],
  ["week", "Weekly"],
  ["month", "Monthly"],
  ["quarter", "Quarterly"],
];
const PAYMENT_LABELS = { cash: "Cash", card: "Card", upi: "UPI", online: "Online", wallet: "Wallet", duePayment: "Due payment", other: "Other" };
const IMPORT_STATUS = {
  completed: ["Completed", "bg-emerald-100 text-emerald-800"],
  partial: ["Partial (rows rejected)", "bg-amber-100 text-amber-800"],
  rejected: ["All rows rejected", "bg-red-100 text-red-700"],
  failed: ["Failed — rolled back", "bg-red-100 text-red-700"],
  pending: ["Awaiting confirmation", "bg-slate-100 text-slate-700"],
  processing: ["Processing", "bg-blue-100 text-blue-700"],
  cancelled: ["Cancelled", "bg-gray-100 text-gray-500"],
  expired: ["Expired", "bg-gray-100 text-gray-500"],
};

function MetricTile({ label, m, pct = false, count = false, sub }) {
  const d = metricDisplay(m, { pct, count });
  return (
    <div className="rounded-xl border border-gray-200 p-3 bg-white">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 font-black ${d.muted ? "text-sm text-gray-400" : d.negative ? "text-lg text-red-600" : "text-lg text-gray-900"}`}>{d.text}</p>
      {(d.note || sub) && <p className="text-[10px] text-gray-500 mt-0.5">{d.note || sub}</p>}
    </div>
  );
}
function MetricCell({ m, pct }) {
  const d = metricDisplay(m, { pct });
  return <span className={d.muted ? "text-gray-400" : d.negative ? "text-red-600 font-semibold" : ""} title={d.note || undefined}>{d.text}</span>;
}
const monthOf = (key) => {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${key.slice(0, 7)}-01`, end: `${key.slice(0, 7)}-${String(last).padStart(2, "0")}` };
};

/**
 * Sales analytics for any date range (daily → yearly), shared by the Manager
 * Portal (audience="manager", /api/sales/analytics/range) and the Client Portal
 * (audience="client", /api/portal/analytics/range). Both endpoints run the
 * same server calculation on the same stored records; the server decides which
 * businesses are in scope.
 */
export default function MonthlyAnalytics({
  refreshKey = 0,
  audience = "manager",
  endpoint = audience === "client" ? "/portal/analytics/range" : "/sales/analytics/range",
  extraParams = null,
}) {
  const isClient = audience === "client";
  const [preset, setPreset] = useState("this_month");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [granularity, setGranularity] = useState("auto");
  const [businessId, setBusinessId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTable, setShowTable] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [autoJumped, setAutoJumped] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  // Manager Portal: month-over-month growth (replaces the profit/loss view there)
  const showProfit = isClient;
  const [mom, setMom] = useState(null);
  const extraKey = JSON.stringify(extraParams || {});
  const businesses = data?.scope?.available || [];

  const params = useMemo(() => {
    const p = { ...JSON.parse(extraKey), granularity };
    if (preset === "custom") {
      if (start) p.start = start;
      if (end) p.end = end;
    } else p.preset = preset;
    if (businessId) p.businessId = businessId;
    return p;
  }, [preset, start, end, granularity, businessId, extraKey]);
  const ready = preset !== "custom" || (start && end && end >= start);

  const load = useCallback(async () => {
    if (!ready) return;
    try {
      setLoading(true);
      const res = await api.get(endpoint, { params });
      setData(res.data);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Failed to load analytics."));
    } finally {
      setLoading(false);
    }
  }, [params, endpoint, ready]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Last 6 whole months up to the selected period, by month, for the manager's MoM view
  const momEnd = data?.period?.end || "";
  useEffect(() => {
    if (showProfit || !momEnd) return;
    const [y, m] = momEnd.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1 - 5, 1));
    const last = new Date(Date.UTC(y, m, 0));
    const key = (d) => d.toISOString().slice(0, 10);
    let cancelled = false;
    api
      .get(endpoint, { params: { ...JSON.parse(extraKey), start: key(first), end: key(last), granularity: "month", ...(businessId ? { businessId } : {}) } })
      .then((res) => {
        if (cancelled) return;
        const rows = (res.data.trend || []).map((b, i, arr) => {
          const prev = i > 0 ? arr[i - 1] : null;
          const pct = (cur, before) => (cur != null && before != null && before > 0 ? Math.round(((cur - before) / before) * 10000) / 100 : null);
          return {
            label: b.label,
            sales: b.recordedSales ?? null,
            net: b.net ?? null,
            orders: b.orders ?? null,
            salesGrowth: prev ? pct(b.recordedSales, prev.recordedSales) : null,
            netGrowth: prev ? pct(b.net, prev.net) : null,
          };
        });
        setMom({ rows, error: "" });
      })
      .catch((err) => !cancelled && setMom({ rows: [], error: errorMessage(err, "Month-over-month data unavailable.") }));
    return () => {
      cancelled = true;
    };
  }, [showProfit, momEnd, businessId, endpoint, extraKey, refreshKey]);
  const momLatest = mom?.rows?.length ? mom.rows[mom.rows.length - 1] : null;

  // Client view: open on the month of the latest data instead of an empty current month.
  useEffect(() => {
    if (!isClient || autoJumped || !data) return;
    setAutoJumped(true);
    const avail = data.coverage?.available;
    if (avail && !data.totals.recordCount) {
      const m = monthOf(avail.end);
      setPreset("custom");
      setStart(m.start);
      setEnd(m.end);
    }
  }, [data, isClient, autoJumped]);

  useEffect(() => {
    if (businessId && data?.scope?.available && !data.scope.available.some((b) => String(b._id) === String(businessId))) setBusinessId("");
  }, [data, businessId]);

  const exportReport = async (format) => {
    try {
      const res = await api.get(`${endpoint}/export`, { params: { ...params, format }, responseType: "blob" });
      downloadBlob(res, `Sales_${data?.period?.start || ""}_${data?.period?.end || ""}.${format}`);
    } catch (err) {
      setError(errorMessage(err, "Export failed."));
    }
  };
  const jumpTo = (s, e) => {
    setPreset("custom");
    setStart(s);
    setEnd(e);
  };

  const t = data?.totals;
  const src = t?.source;
  const g = data?.granularity?.used;
  const trend = (data?.trend || []).map((b) => ({ ...b, net: b.net, netProfit: b.netProfit }));
  const plotted = trend.some((b) => b.records > 0);
  const bucketWord = { day: "day", week: "week", month: "month", quarter: "quarter", year: "year" }[g] || "period";
  const targetChart = ["month", "quarter", "year"].includes(g) && trend.some((b) => b.target);
  const breakdown = t
    ? [
        { name: "Gross sales", value: t.gross.value },
        { name: "Discounts", value: t.discount.value === null ? null : -t.discount.value },
        { name: "Net sales", value: t.net.value },
        ...(showProfit
          ? [
              { name: "Cost of goods/services", value: t.cost.value === null ? null : -t.cost.value },
              { name: "Gross profit", value: t.grossProfit.value },
              { name: "Operating expenses", value: t.expenses.value === null ? null : -t.expenses.value },
              { name: "Net profit / loss", value: t.netProfit.value },
            ]
          : []),
      ]
    : [];
  const unavailable = breakdown.filter((b) => b.value === null).map((b) => b.name);
  const singleBusiness = data?.scope?.businesses === 1;
  const bizChart = (data?.businessBreakdown || [])
    .filter((b) => b.hasRecord)
    .slice(0, 15)
    .map((b) => ({ name: b.name.length > 22 ? `${b.name.slice(0, 21)}…` : b.name, sales: b.recordedSales.value, target: b.target.value }));
  const comparison = t
    ? [
        { name: "Total sales", current: t.recordedSales.value, previous: data.previousTotals.recordedSales.value },
        { name: "Net sales", current: t.net.value, previous: data.previousTotals.net.value },
        ...(showProfit && (t.netProfit.value !== null || data.previousTotals.netProfit.value !== null) ? [{ name: "Net profit", current: t.netProfit.value, previous: data.previousTotals.netProfit.value }] : []),
        ...(src ? [{ name: "Report Total Sales", current: src.totalSales.value, previous: data.previousTotals.source ? data.previousTotals.source.totalSales.value : null }] : []),
      ]
    : [];
  const payments = src
    ? Object.entries(src.payments)
        .filter(([, v]) => v.value !== null && v.value !== 0)
        .map(([k, v]) => ({ name: PAYMENT_LABELS[k] || k, value: v.value }))
    : [];
  const avail = data?.coverage?.available;
  const label = (x) => (isClient ? x.replace("business", "location").replace("Business", "Location") : x);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card bodyClassName="p-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
            <div>
              <label className={labelCls} htmlFor="ra-preset">Period</label>
              <select
                id="ra-preset"
                className={inputCls}
                value={preset}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "custom" && data?.period) {
                    setStart(data.period.start);
                    setEnd(data.period.end);
                  }
                  setPreset(v);
                }}
              >
                {PRESETS.map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </div>
            {preset === "custom" ? (
              <>
                <div>
                  <label className={labelCls} htmlFor="ra-start">From</label>
                  <input id="ra-start" type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="ra-end">To</label>
                  <input id="ra-end" type="date" className={inputCls} value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
                </div>
              </>
            ) : (
              <div className="col-span-2 flex items-end">
                <p className="text-xs text-gray-600 pb-2">{data?.period ? <><strong>{data.period.label}</strong> <span className="text-gray-400">(IST)</span></> : ""}</p>
              </div>
            )}
            <div>
              <label className={labelCls} htmlFor="ra-view">View</label>
              <select id="ra-view" className={inputCls} value={granularity} onChange={(e) => setGranularity(e.target.value)}>
                {VIEWS.map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 md:col-span-4 lg:col-span-1">
              <label className={labelCls} htmlFor="ra-biz">{isClient ? "Location" : "Business / location"}</label>
              <select id="ra-biz" className={inputCls} value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
                <option value="">{isClient ? "All my locations" : "All my businesses"}</option>
                {businesses.map((b) => (
                  <option key={b._id} value={b._id}>{b.name} · {b.city}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isClient && (
              <button
                type="button"
                id="analytics-import-sales-btn"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow transition cursor-pointer whitespace-nowrap"
                onClick={() => setIsUploadOpen(true)}
                title="Upload sales data for any date range (CSV, Excel, POS day-wise report)"
              >
                <FaCloudUploadAlt className="text-sm" />
                Import Sales CSV / Excel
              </button>
            )}
            <button type="button" className={btn.secondary} onClick={() => exportReport("csv")} disabled={!data}><FaFileCsv /> CSV</button>
            <button type="button" className={btn.secondary} onClick={() => exportReport("xlsx")} disabled={!data}><FaFileExcel /> Excel</button>
          </div>
        </div>
        {preset === "custom" && !ready && <p className="text-[11px] text-red-700 mt-2">Choose a start date and an end date on or after it.</p>}
      </Card>

      {error && (
        <Alert tone="error">
          {error}{" "}
          <button type="button" className="underline font-semibold" onClick={load}>Retry</button>
        </Alert>
      )}
      {loading && !data ? (
        <Spinner label="Calculating sales analytics..." />
      ) : !t ? null : data.scope.businesses === 0 ? (
        <EmptyState title={isClient ? "No business is linked to this account yet." : "No businesses in your scope."}>
          {isClient ? "Your account manager links your business(es) once; after that every sales upload appears here automatically." : null}
        </EmptyState>
      ) : (
        <>
          {loading && <p className="text-[11px] text-gray-500 -mb-2">Updating…</p>}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-1">
            <h3 className="text-sm font-extrabold text-gray-900">
              {data.period.label} · {data.scope.businesses} {isClient ? `location${data.scope.businesses === 1 ? "" : "s"}` : `business${data.scope.businesses === 1 ? "" : "es"}`} · {t.recordCount} record{t.recordCount === 1 ? "" : "s"}
            </h3>
            <p className="text-[11px] text-gray-600">
              Compared with {data.period.previous.label}
              {data.coverage.label ? <> · Data in period: <strong>{data.coverage.label}</strong>{data.coverage.daysWithDailyData ? ` (${data.coverage.daysWithDailyData} of ${data.coverage.daysInPeriod} days)` : ""}</> : null}
              {avail ? <> · Available: {avail.label}</> : null}
            </p>
          </div>

          {t.recordCount === 0 ? (
            <EmptyState title={`No sales records for ${data.period.label}.`}>
              {avail ? (
                <>
                  Data exists for {avail.label}.{" "}
                  <button type="button" className="underline font-semibold" onClick={() => jumpTo(monthOf(avail.end).start, monthOf(avail.end).end)}>Show the latest month</button>
                  {" · "}
                  <button type="button" className="underline font-semibold" onClick={() => jumpTo(avail.start, avail.end)}>Show all available data</button>
                </>
              ) : (
                "No sales data available."
              )}
            </EmptyState>
          ) : (
            <>
              {data.notes?.length > 0 && (
                <Alert tone="info">
                  <ul className="list-disc pl-4 space-y-0.5">
                    {data.notes.map((n) => (
                      <li key={n.type}>{n.text}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
                <MetricTile label="Total sales (recorded)" m={t.recordedSales} sub={src ? "My Amount, before discount" : `vs prev. ${growthText(t.growth?.recordedSales)}`} />
                <MetricTile label={src ? "Total bills" : "Total orders"} count m={{ value: t.orders, status: t.recordCount ? "complete" : "no_records" }} />
                <MetricTile label="Gross sales" m={t.gross} />
                <MetricTile label="Discounts given" m={t.discount} />
                <MetricTile label="Net sales" m={t.net} sub={src ? "Gross − discount" : `vs prev. ${growthText(t.growth?.net)}`} />
                {showProfit ? (
                  <>
                    <MetricTile label="Cost of goods/services" m={t.cost} />
                    <MetricTile label="Gross profit" m={t.grossProfit} />
                    <MetricTile label="Operating expenses" m={t.expenses} />
                    <MetricTile label="Net profit / loss" m={t.netProfit} sub={t.netProfit.value === null ? "Needs cost and expenses" : ""} />
                    <MetricTile
                      label="Net profit / loss margin"
                      m={t.profitMargin}
                      pct
                      sub={
                        t.profitMargin.value !== null && t.profitMargin.netSales != null
                          ? `${formatINR(t.profitMargin.netProfit)} ÷ ${formatINR(t.profitMargin.netSales)} net sales`
                          : t.profitMargin.status === "no_records"
                          ? ""
                          : "Needs net sales and net profit/loss"
                      }
                    />
                  </>
                ) : (
                  <>
                    <MetricTile
                      label="MoM sales growth"
                      m={{ value: momLatest ? momLatest.salesGrowth : null, status: t.recordCount || momLatest ? "complete" : "no_records", growth: true }}
                      pct
                      sub={momLatest ? `${momLatest.label} vs previous month` : "Loading…"}
                    />
                    <MetricTile
                      label="MoM net sales growth"
                      m={{ value: momLatest ? momLatest.netGrowth : null, status: t.recordCount || momLatest ? "complete" : "no_records", growth: true }}
                      pct
                      sub={momLatest ? `${momLatest.label} vs previous month` : "Loading…"}
                    />
                  </>
                )}
                <MetricTile
                  label="Target vs actual"
                  m={{ value: t.target.achievement, status: t.target.status, covered: t.target.covered, total: t.target.total }}
                  pct
                  sub={t.target.value ? `${formatINR(t.target.actual, { compact: true })} of ${formatINR(t.target.value, { compact: true })}` : t.target.note || "Target not configured"}
                />
                <MetricTile
                  label="Growth vs previous period"
                  m={{ value: t.growth?.recordedSales ?? null, status: t.recordCount ? "complete" : "no_records", growth: true }}
                  pct
                  sub={t.growth?.recordedSales == null ? t.growth?.reason || "Not comparable" : data.period.previous.label}
                />
              </div>

              {src && (
                <Card title="POS report figures" subtitle="Summed exactly as reported in the uploaded day-wise reports (Total Sales includes tax and charges).">
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-2">
                    <MetricTile label="Total Sales (report)" m={src.totalSales} sub="After discount, incl. tax & charges" />
                    <MetricTile label="Net Sales (report)" m={src.netSales} sub={src.netSalesCheck && Math.abs(src.netSalesCheck.difference) > 0.05 ? `Differs from My Amount − Discount by ${formatINR(src.netSalesCheck.difference)}` : "My Amount − Total Discount"} />
                    <MetricTile label="Total Tax" m={src.tax} />
                    <MetricTile label="Service charge" m={src.serviceCharge} />
                    <MetricTile label="Delivery charge" m={src.deliveryCharge} />
                    <MetricTile label="Container charge" m={src.containerCharge} />
                    <MetricTile label="Bills" count m={src.bills} />
                    <MetricTile label="Pax" count m={src.pax} />
                    <MetricTile label="Waived off" m={src.waivedOff} />
                    <MetricTile label="Round off" m={src.roundOff} />
                  </div>
                  {payments.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-bold text-gray-800 mb-1">
                        Payment methods {src.paymentsTotal !== null && <span className="font-normal text-gray-500">(total {formatINR(src.paymentsTotal)}{src.notPaid.value ? `, not paid ${formatINR(src.notPaid.value)}` : ""})</span>}
                      </p>
                      <div style={{ height: Math.max(140, payments.length * 30) }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={payments} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                            <CartesianGrid stroke={C.grid} horizontal={false} />
                            <XAxis type="number" tick={axisTick} tickFormatter={yFmt} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" tick={axisTick} width={90} tickLine={false} axisLine={false} />
                            <Tooltip formatter={tooltipFmt} />
                            <Bar dataKey="value" name="Amount" fill={C.report} radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </Card>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card title={`Sales trend — by ${bucketWord}`} subtitle="Gaps mean nothing was recorded for that period (no values are invented).">
                  {!plotted ? (
                    <EmptyState title={`Nothing to plot by ${bucketWord}.`}>Choose a coarser view.</EmptyState>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke={C.grid} vertical={false} />
                          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={12} />
                          <YAxis tick={axisTick} tickFormatter={yFmt} tickLine={false} axisLine={false} width={48} />
                          <Tooltip formatter={tooltipFmt} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="recordedSales" name="Total sales" stroke={C.sales} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
                          <Line type="monotone" dataKey="net" name="Net sales" stroke={C.net} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
                          {src && <Line type="monotone" dataKey="reportedTotalSales" name="Total Sales (report)" stroke={C.report} strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls={false} />}
                          {showProfit && trend.some((b) => b.netProfit !== null) && <Line type="monotone" dataKey="netProfit" name="Net profit" stroke={C.profit} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>

                <Card title="Sales vs target" subtitle="Targets are monthly, so they are compared by month, quarter or year.">
                  {!targetChart ? (
                    <EmptyState title={t.target.value ? `Target achievement: ${t.target.achievement}%` : "No target to compare."}>
                      {t.target.note || (["day", "week"].includes(g) ? "Switch the view to Monthly to see sales against monthly targets." : "No target is configured for these businesses.")}
                    </EmptyState>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={2}>
                          <CartesianGrid stroke={C.grid} vertical={false} />
                          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: C.grid }} />
                          <YAxis tick={axisTick} tickFormatter={yFmt} tickLine={false} axisLine={false} width={48} />
                          <Tooltip formatter={tooltipFmt} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="targetActual" name="Actual (with a target)" fill={C.sales} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="target" name="Target" fill={C.target} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>

                <Card title={showProfit ? `Discount and profit/loss breakdown — ${data.period.label}` : `Discount breakdown — ${data.period.label}`} subtitle="Deductions are shown as negative bars.">
                  {unavailable.length > 0 && (
                    <Alert tone="warn" className="mb-3">
                      Data unavailable: {unavailable.join(", ")}.{showProfit && t.netProfit.value === null ? " Profit is not shown because cost and expenses were not recorded." : ""}
                    </Alert>
                  )}
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={breakdown.filter((b) => b.value !== null)} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                        <CartesianGrid stroke={C.grid} horizontal={false} />
                        <XAxis type="number" tick={axisTick} tickFormatter={yFmt} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={axisTick} width={140} tickLine={false} axisLine={false} />
                        <Tooltip formatter={tooltipFmt} />
                        <Bar dataKey="value" name="Amount" radius={[0, 4, 4, 0]}>
                          {breakdown
                            .filter((b) => b.value !== null)
                            .map((b) => (
                              <Cell key={b.name} fill={b.value < 0 ? C.loss : b.name.startsWith("Net profit") ? C.profit : C.sales} />
                            ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card title={`Period comparison — ${data.period.label} vs ${data.period.previous.label}`} subtitle={t.growth?.reason || `Sales growth ${growthText(t.growth?.recordedSales)}`}>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparison} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={2}>
                        <CartesianGrid stroke={C.grid} vertical={false} />
                        <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: C.grid }} />
                        <YAxis tick={axisTick} tickFormatter={yFmt} tickLine={false} axisLine={false} width={48} />
                        <Tooltip formatter={tooltipFmt} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="previous" name={data.period.previous.label} fill={C.prev} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="current" name={data.period.label} fill={C.sales} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {!showProfit && (
                  <Card className="xl:col-span-2" title="Month-over-month growth" subtitle="Last 6 months up to the selected period. Growth is shown only when the previous month has sales.">
                    {!mom ? (
                      <p className="text-xs text-gray-500">Loading…</p>
                    ) : mom.error ? (
                      <Alert tone="warn">{mom.error}</Alert>
                    ) : !mom.rows.some((r) => r.sales !== null) ? (
                      <EmptyState title="No monthly sales recorded in the last 6 months." />
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mom.rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                              <CartesianGrid stroke={C.grid} vertical={false} />
                              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: C.grid }} />
                              <YAxis tick={axisTick} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={44} />
                              <Tooltip formatter={(v) => (v === null || v === undefined ? "n/a" : `${v > 0 ? "+" : ""}${v}%`)} />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              <Bar dataKey="salesGrowth" name="Sales MoM %" radius={[4, 4, 0, 0]}>
                                {mom.rows.map((r) => (
                                  <Cell key={r.label} fill={r.salesGrowth !== null && r.salesGrowth < 0 ? C.loss : C.sales} />
                                ))}
                              </Bar>
                              <Bar dataKey="netGrowth" name="Net sales MoM %" fill={C.net} radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="overflow-x-auto border border-gray-200 rounded-xl">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wider text-gray-600">
                              <tr>
                                {["Month", "Sales", "MoM", "Net sales", "MoM"].map((h, i) => (
                                  <th key={i} className="px-3 py-2 whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {mom.rows.map((r) => (
                                <tr key={r.label}>
                                  <td className="px-3 py-2 whitespace-nowrap font-semibold">{r.label}</td>
                                  <td className="px-3 py-2">{r.sales === null ? <span className="text-gray-400">No data</span> : formatINR(r.sales)}</td>
                                  <td className={`px-3 py-2 font-semibold ${r.salesGrowth < 0 ? "text-red-600" : r.salesGrowth > 0 ? "text-emerald-700" : "text-gray-500"}`}>{growthText(r.salesGrowth)}</td>
                                  <td className="px-3 py-2">{r.net === null ? <span className="text-gray-400">No data</span> : formatINR(r.net)}</td>
                                  <td className={`px-3 py-2 font-semibold ${r.netGrowth < 0 ? "text-red-600" : r.netGrowth > 0 ? "text-emerald-700" : "text-gray-500"}`}>{growthText(r.netGrowth)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </Card>
                )}

                <Card className="xl:col-span-2" title={singleBusiness ? `${data.businessBreakdown[0]?.name || ""} — sales by ${bucketWord}` : label(`Business-wise comparison — ${data.period.label}`)} subtitle={singleBusiness ? data.businessBreakdown[0]?.city : "Recorded sales vs target (monthly targets, whole months only)."}>
                  {singleBusiness ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke={C.grid} vertical={false} />
                          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={12} />
                          <YAxis tick={axisTick} tickFormatter={yFmt} tickLine={false} axisLine={false} width={48} />
                          <Tooltip formatter={tooltipFmt} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="recordedSales" name="Sales" fill={C.sales} radius={[4, 4, 0, 0]} />
                          {targetChart && <Bar dataKey="target" name="Target" fill={C.target} radius={[4, 4, 0, 0]} />}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : bizChart.length === 0 ? (
                    <EmptyState title="No sales records in this period." />
                  ) : (
                    <div style={{ height: Math.max(220, bizChart.length * 34) }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bizChart} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }} barGap={2}>
                          <CartesianGrid stroke={C.grid} horizontal={false} />
                          <XAxis type="number" tick={axisTick} tickFormatter={yFmt} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="name" tick={axisTick} width={150} tickLine={false} axisLine={false} />
                          <Tooltip formatter={tooltipFmt} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="sales" name="Sales" fill={C.sales} radius={[0, 4, 4, 0]} />
                          <Bar dataKey="target" name="Target" fill={C.target} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>
              </div>

              <Card
                title={label(showProfit ? "Business profitability table" : "Business sales table")}
                subtitle={`By ${bucketWord} and ${isClient ? "location" : "business"}, for ${data.period.label}.`}
                actions={<button type="button" className={btn.ghost} onClick={() => setShowTable((v) => !v)}>{showTable ? "Hide" : "Show"} table</button>}
              >
                {showTable &&
                  (data.profitabilityRows.length === 0 ? (
                    <EmptyState title="No rows to show." />
                  ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-xl">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wider text-gray-600">
                          <tr>
                            {["Period", isClient ? "Location" : "Business", "Sales", "Discount", "Net sales", ...(showProfit ? ["Cost", "Expenses", "Net profit / loss", "Margin"] : []), "Target %", ...(src ? ["Report Total Sales", "Bills"] : [])].map((h) => (
                              <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {data.profitabilityRows.map((r) => (
                            <tr key={r.key}>
                              <td className="px-3 py-2 whitespace-nowrap">{r.period}</td>
                              <td className="px-3 py-2 font-semibold whitespace-nowrap">{r.business}<span className="block text-gray-500 font-normal">{r.city}</span></td>
                              <td className="px-3 py-2"><MetricCell m={r.recordedSales} /></td>
                              <td className="px-3 py-2"><MetricCell m={r.discount} /></td>
                              <td className="px-3 py-2"><MetricCell m={r.net} /></td>
                              {showProfit && (
                                <>
                                  <td className="px-3 py-2"><MetricCell m={r.cost} /></td>
                                  <td className="px-3 py-2"><MetricCell m={r.expenses} /></td>
                                  <td className="px-3 py-2"><MetricCell m={r.netProfit} /></td>
                                  <td className="px-3 py-2"><MetricCell m={r.profitMargin} pct /></td>
                                </>
                              )}
                              <td className="px-3 py-2">{r.target.achievement === null ? <span className="text-gray-400">Not configured</span> : `${r.target.achievement}%`}</td>
                              {src && <td className="px-3 py-2">{r.source ? formatINR(r.source.totalSales.value) : "—"}</td>}
                              {src && <td className="px-3 py-2">{r.source ? r.source.bills.value ?? "—" : "—"}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
              </Card>

              <Card
                title="Sales record history"
                subtitle="Every stored record touching this period, and whether it is counted."
                actions={<button type="button" className={btn.ghost} onClick={() => setShowHistory((v) => !v)}>{showHistory ? "Hide" : "Show"} records ({data.history.length})</button>}
              >
                {showHistory && (
                  <div className="overflow-x-auto border border-gray-200 rounded-xl max-h-96">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wider text-gray-600 sticky top-0">
                        <tr>
                          {["Date / period", isClient ? "Location" : "Business", "Type", "Sales", "Discount", src ? "Report Total Sales" : null, "Invoice Nos.", "Counted"].filter(Boolean).map((h) => (
                            <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.history.map((h) => (
                          <tr key={`${h.id}-${h.status}`} className={h.status === "included" ? "" : "bg-gray-50 text-gray-500"}>
                            <td className="px-3 py-1.5 whitespace-nowrap">{h.label}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{h.business}</td>
                            <td className="px-3 py-1.5">{{ day: "Daily total", txn: "Transaction", period: "Period total", month: "Monthly total" }[h.kind] || h.kind}</td>
                            <td className="px-3 py-1.5 font-mono">{formatINR(h.totalSales)}</td>
                            <td className="px-3 py-1.5 font-mono">{h.discount === null || h.discount === undefined ? <span className="text-gray-400">Not recorded</span> : formatINR(h.discount)}</td>
                            {src && <td className="px-3 py-1.5 font-mono">{h.reportedTotalSales === null || h.reportedTotalSales === undefined ? "—" : formatINR(h.reportedTotalSales)}</td>}
                            <td className="px-3 py-1.5 font-mono">{h.invoiceRange || "—"}</td>
                            <td className="px-3 py-1.5">{h.status === "included" ? "Yes" : <span title={h.reason}>No — {h.reason}</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}

          <Card title="Sales records pipeline" subtitle={`Records and imports for ${data.period.label}`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {[
                ["Reporting period", data.period.label],
                ["Imported records", data.imports.importedRecords],
                ["Manual records", data.imports.manualRecords],
                ["Pending (previewed, not confirmed)", `${data.imports.pendingPreviews} file(s) / ${data.imports.pendingRows} rows`],
                ["Invalid / rejected rows", data.imports.invalidRows],
                ["Skipped (already existed)", data.imports.skippedRows],
                ["Completed imports", data.imports.importsCompleted],
                [isClient ? "Locations without a record" : "Businesses without a record", data.imports.businessesWithoutRecord],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-gray-200 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{k}</p>
                  <p className="text-base font-black text-gray-900 mt-0.5">{v}</p>
                </div>
              ))}
            </div>
            {isClient && (
              <div className="mt-4">
                <h4 className="text-xs font-extrabold text-gray-900 mb-2">Import history</h4>
                {!data.imports.importHistory?.length ? (
                  <EmptyState title="No sales files have been imported for your business yet." />
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wider text-gray-600">
                        <tr>
                          {["Upload date (IST)", "Reporting period", "File", "Records for you", "Rejected rows", "Status"].map((h) => (
                            <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.imports.importHistory.map((j) => {
                          const [lbl, cls] = IMPORT_STATUS[j.status] || [j.status, "bg-gray-100"];
                          return (
                            <tr key={j._id}>
                              <td className="px-3 py-2 whitespace-nowrap">{j.uploadedAtLabel}<span className="block text-gray-500">{j.uploaderName}</span></td>
                              <td className="px-3 py-2">{j.reportingPeriods?.length ? j.reportingPeriods.join(", ") : "—"}</td>
                              <td className="px-3 py-2 max-w-[200px] truncate" title={j.filename || ""}>{j.sharedFile ? <span className="text-gray-500">Multi-business file</span> : j.filename}</td>
                              <td className="px-3 py-2 font-mono">{j.recordsForYou}</td>
                              <td className="px-3 py-2 font-mono">{j.sharedFile ? <span className="text-gray-400">—</span> : j.rejected}</td>
                              <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap ${cls}`}>{lbl}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            <details className="mt-3 text-[11px] text-gray-600">
              <summary className="cursor-pointer font-semibold">How these numbers are calculated</summary>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {Object.entries(data.definitions || {}).map(([k, v]) => (
                  <li key={k}><strong>{k}:</strong> {v}</li>
                ))}
              </ul>
            </details>
          </Card>
        </>
      )}
      {!isClient && (
        <ExcelUploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onSuccess={() => {
            setIsUploadOpen(false);
            load();
          }}
          defaultBusinessId={businessId}
        />
      )}
    </div>
  );
}
