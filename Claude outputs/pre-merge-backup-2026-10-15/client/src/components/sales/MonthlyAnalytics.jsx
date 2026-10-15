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
import { nowIST, MONTH_NAMES } from "../../utils/istDate";
import { Card, Alert, Spinner, EmptyState, btn, inputCls, labelCls, errorMessage, downloadBlob, formatINR } from "../planner/plannerUi";
import { metricDisplay, growthText } from "./metricFormat";
import ExcelUploadModal from "./ExcelUploadModal";

// Validated categorical slots (light surface) — fixed order, never cycled.
const C = { sales: "#2a78d6", target: "#eb6834", net: "#1baf7a", profit: "#6250d6", loss: "#e34948", grid: "#e7e5e4", axis: "#78716c" };

const axisTick = { fontSize: 11, fill: C.axis };
const yFmt = (v) => (Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(1)}L` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : v);
const tooltipFmt = (v) => (v === null || v === undefined ? "Data unavailable" : formatINR(v));

const DATE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "last_7_days", label: "Last 7 days" },
  { id: "last_30_days", label: "Last 30 days" },
  { id: "this_week", label: "This week" },
  { id: "previous_week", label: "Previous week" },
  { id: "this_month", label: "This month" },
  { id: "previous_month", label: "Previous month" },
  { id: "this_quarter", label: "This quarter" },
  { id: "previous_quarter", label: "Previous quarter" },
  { id: "this_year", label: "This year" },
  { id: "custom", label: "Custom date range" },
];

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

function MetricCell({ m, pct }) {
  const d = metricDisplay(m, { pct });
  return <span className={d.muted ? "text-gray-400" : d.negative ? "text-red-600 font-semibold" : ""} title={d.note || undefined}>{d.text}</span>;
}

/**
 * Monthly & Time-Period Sales, Discount, Profit & Loss dashboard.
 *
 * Shared by the Manager Portal (audience="manager", /api/sales/analytics/monthly)
 * and the Client Portal (audience="client", /api/portal/analytics/monthly).
 * Both endpoints run the same single-source-of-truth server calculation.
 */
export default function MonthlyAnalytics({
  refreshKey = 0,
  audience = "manager",
  endpoint = audience === "client" ? "/portal/analytics/monthly" : "/sales/analytics/monthly",
  extraParams = null,
}) {
  const isClient = audience === "client";
  const now = nowIST();
  const [filterPreset, setFilterPreset] = useState("this_month");
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [granularity, setGranularity] = useState("auto"); // auto | daily | weekly | monthly
  const [businessId, setBusinessId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTable, setShowTable] = useState(false);
  const [tableMode, setTableMode] = useState("month"); // month | range
  const [showHistory, setShowHistory] = useState(true);
  const [historySearch, setHistorySearch] = useState("");
  const [autoJumped, setAutoJumped] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const extraKey = JSON.stringify(extraParams || {});

  // Business filter options come from the analytics response (server-scoped).
  const businesses = data?.scope?.available || [];

  const params = useMemo(() => {
    const p = { ...JSON.parse(extraKey) };
    p.filter = filterPreset;
    p.periodPreset = filterPreset;

    if (filterPreset === "this_month") {
      p.year = year;
      p.month = month;
    } else if (filterPreset === "custom") {
      if (customStart) p.startDate = customStart;
      if (customEnd) p.endDate = customEnd;
    }

    if (granularity !== "auto") p.granularity = granularity;
    if (businessId) p.businessId = businessId;
    return p;
  }, [filterPreset, year, month, customStart, customEnd, granularity, businessId, extraKey]);

  const load = useCallback(async () => {
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
  }, [params, endpoint]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Client view: the first time, open on the latest month that has data if this month is empty
  useEffect(() => {
    if (!isClient || autoJumped || !data) return;
    setAutoJumped(true);
    const latest = data.latestDataPeriod;
    if (latest && data.selected?.recordCount === 0 && (latest.year !== year || latest.month !== month)) {
      setYear(latest.year);
      setMonth(latest.month);
    }
  }, [data, isClient, autoJumped, year, month]);

  // Reset an invalid business filter (e.g. a business unlinked from the account)
  useEffect(() => {
    if (businessId && data?.scope?.available && !data.scope.available.some((b) => String(b._id) === String(businessId))) setBusinessId("");
  }, [data, businessId]);

  const exportReport = async (format) => {
    try {
      const res = await api.get(`${endpoint}/export`, { params: { ...params, format }, responseType: "blob" });
      const label = data?.coverage?.selectedPeriod?.replace(/[^a-zA-Z0-9_-]/g, "_") || `${year}-${String(month).padStart(2, "0")}`;
      downloadBlob(res, `${isClient ? "Sales_Report" : "ESG_Sales_Report"}_${label}.${format}`);
    } catch (err) {
      setError(errorMessage(err, "Export failed."));
    }
  };

  const whole = (m) => (m?.status === "complete" ? m.value : null);
  const trend = (data?.trend || []).map((t) => ({
    label: t.label,
    sales: t.recordedSales?.value ?? null,
    net: whole(t.net),
    netProfit: whole(t.netProfit),
    target: t.target?.value ?? null,
    actualVsTarget: t.target?.actual ?? null,
  }));
  const s = data?.selected;

  const breakdown = s
    ? [
        { name: "Gross sales", value: s.gross?.value ?? null },
        { name: "Discounts", value: s.discount?.value === null || s.discount?.value === undefined ? null : -s.discount.value },
        { name: "Net sales", value: s.net?.value ?? null },
        { name: "Cost of goods/services", value: s.cost?.value === null || s.cost?.value === undefined ? null : -s.cost.value },
        { name: "Gross profit", value: s.grossProfit?.value ?? null },
        { name: "Operating expenses", value: s.expenses?.value === null || s.expenses?.value === undefined ? null : -s.expenses.value },
        { name: "Net profit / loss", value: s.netProfit?.value ?? null },
      ]
    : [];
  const unavailable = breakdown.filter((b) => b.value === null).map((b) => b.name);

  const singleBusiness = data?.scope?.businesses === 1;
  const bizChart = (data?.businessBreakdown || [])
    .filter((b) => b.hasRecord)
    .slice(0, 15)
    .map((b) => ({ name: b.name.length > 22 ? `${b.name.slice(0, 21)}…` : b.name, sales: b.recordedSales?.value ?? 0, target: b.target?.value ?? null }));

  const yearSet = new Set(Array.from({ length: 6 }, (_, i) => now.year - 4 + i));
  yearSet.add(year);
  if (data?.latestDataPeriod) yearSet.add(data.latestDataPeriod.year);
  const years = [...yearSet].sort((a, b) => a - b);
  const latest = data?.latestDataPeriod;
  const onLatest = latest && latest.year === year && latest.month === month;

  return (
    <div className="space-y-4">
      {/* Filters: Full time-period presets + custom range */}
      <Card bodyClassName="p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 flex-1">
            {/* Period Preset */}
            <div>
              <label className={labelCls} htmlFor="ma-preset">Reporting Period</label>
              <select
                id="ma-preset"
                className={inputCls}
                value={filterPreset}
                onChange={(e) => setFilterPreset(e.target.value)}
              >
                {DATE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Custom Range or Month/Year */}
            {filterPreset === "custom" ? (
              <>
                <div>
                  <label className={labelCls} htmlFor="ma-start">Start Date</label>
                  <input
                    id="ma-start"
                    type="date"
                    className={inputCls}
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="ma-end">End Date</label>
                  <input
                    id="ma-end"
                    type="date"
                    className={inputCls}
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </div>
              </>
            ) : filterPreset === "this_month" ? (
              <>
                <div>
                  <label className={labelCls} htmlFor="ma-month">Month</label>
                  <select id="ma-month" className={inputCls} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                    {MONTH_NAMES.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="ma-year">Year</label>
                  <select id="ma-year" className={inputCls} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className={labelCls} htmlFor="ma-gran">Granularity</label>
                <select
                  id="ma-gran"
                  className={inputCls}
                  value={granularity}
                  onChange={(e) => setGranularity(e.target.value)}
                >
                  <option value="auto">Auto-detect ({data?.trendGranularity || "standard"})</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}

            {/* Business / Location */}
            <div>
              <label className={labelCls} htmlFor="ma-biz">{isClient ? "Location" : "Business / Location"}</label>
              <select id="ma-biz" className={inputCls} value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
                <option value="">{isClient ? "All my locations" : "All my businesses"}</option>
                {businesses.map((b) => (
                  <option key={b._id} value={b._id}>{b.name} · {b.city}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {latest && !onLatest && filterPreset === "this_month" && (
              <button
                type="button"
                className={btn.ghost}
                onClick={() => { setYear(latest.year); setMonth(latest.month); }}
                title="Jump to the latest month with sales data"
              >
                Latest data: {latest.label}
              </button>
            )}
            {!isClient && (
              <button
                type="button"
                id="analytics-import-sales-btn"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow transition cursor-pointer whitespace-nowrap"
                onClick={() => setIsUploadOpen(true)}
                title="Upload sales data for any date range (CSV, Excel)"
              >
                <FaCloudUploadAlt className="text-sm" />
                Import Sales CSV / Excel
              </button>
            )}
            <button type="button" className={btn.secondary} onClick={() => exportReport("csv")}><FaFileCsv /> CSV</button>
            <button type="button" className={btn.secondary} onClick={() => exportReport("xlsx")}><FaFileExcel /> Excel</button>
          </div>
        </div>

        {/* Selected Period & Available Coverage Badges */}
        {data?.coverage && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-gray-800">
                Selected Period: <span className="text-blue-700">{data.coverage.selectedPeriod || "All Time"}</span>
              </span>
              <span className="text-gray-300">·</span>
              <span className="text-gray-600">
                Data Range in DB: <span className="font-medium text-gray-800">{data.coverage.availableDataRange}</span>
              </span>
              <span className="text-gray-300">·</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700">
                {data.trendGranularity || "standard"} trend
              </span>
            </div>
            <div className="text-[11px] text-gray-500">
              Single source of truth · Auto-synchronized with {isClient ? "Manager uploads" : "Client portals"}
            </div>
          </div>
        )}
      </Card>

      {error && (
        <Alert tone="error">
          {error}{" "}
          <button type="button" className="underline font-semibold" onClick={load}>Retry</button>
        </Alert>
      )}
      {loading && !data ? (
        <Spinner label="Calculating monthly analytics..." />
      ) : !s ? null : data.scope.businesses === 0 ? (
        <EmptyState title={isClient ? "No business is linked to this account yet." : "No businesses in your scope."}>
          {isClient ? "Your account manager links your business(es) once; after that every sales upload appears here automatically." : null}
        </EmptyState>
      ) : (
        <>
          {loading && <p className="text-[11px] text-gray-500 -mb-2">Updating…</p>}

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-extrabold text-gray-900">
                {data.coverage?.selectedPeriod || data.period.monthName} · {data.scope.businesses} {isClient ? `location${data.scope.businesses === 1 ? "" : "s"}` : `business${data.scope.businesses === 1 ? "" : "es"}`} · {s.recordCount} record{s.recordCount === 1 ? "" : "s"}
              </h3>
              {data.trendGranularity && (
                <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md capitalize">
                  {data.trendGranularity} aggregation
                </span>
              )}
            </div>

            {/* 12 Required KPI Values */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
              <MetricTile label="Total sales (recorded)" m={s.recordedSales} sub={`Growth: ${growthText(s.growth?.recordedSales)}`} />
              <MetricTile label="Gross sales" m={s.gross} />
              <MetricTile label="Total orders" count m={{ value: s.orders, status: s.recordCount ? "complete" : "no_records" }} />
              <MetricTile label="Discounts" m={s.discount} />
              <MetricTile label="Net sales" m={s.net} sub={`Growth: ${growthText(s.growth?.net)}`} />
              <MetricTile label="Cost of goods/services" m={s.cost} />
              <MetricTile label="Gross profit" m={s.grossProfit} />
              <MetricTile label="Operating expenses" m={s.expenses} />
              <MetricTile label="Net profit / loss" m={s.netProfit} />
              <MetricTile label="Profit margin" m={s.profitMargin} pct />
              <MetricTile
                label="Sales Target vs actual"
                m={{ value: s.target?.achievement, status: s.target?.status, covered: s.target?.covered, total: s.target?.total }}
                pct
                sub={s.target?.value ? `${formatINR(s.target.actual, { compact: true })} of ${formatINR(s.target.value, { compact: true })}` : "Target not configured"}
              />
              <MetricTile
                label="Period-over-period growth"
                m={{ value: s.growth?.recordedSales ?? null, status: s.recordCount ? "complete" : "no_records", growth: true }}
                pct
                sub={s.growth?.recordedSales == null ? "Needs prior period" : ""}
              />
            </div>
          </div>

          {/* Empty state when no data for the selected period */}
          {s.recordCount === 0 || data.isEmpty ? (
            <Card bodyClassName="p-8 text-center">
              <EmptyState
                title={data.emptyMessage || `No sales records found for ${data.coverage?.selectedPeriod || "the selected period"}.`}
              >
                <div className="max-w-md mx-auto text-xs text-gray-500 mt-2 space-y-1">
                  <p>Date range covered by available database records: <strong>{data.coverage?.availableDataRange || "None"}</strong>.</p>
                  <p>Upload a file for this time period or select a different date filter above.</p>
                </div>
              </EmptyState>
            </Card>
          ) : (
            <>
              {/* Interactive Visual Charts */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card
                  title={`${data.trendGranularity === "daily" ? "Daily" : data.trendGranularity === "weekly" ? "Weekly" : "Monthly"} sales trend`}
                  subtitle="Recorded sales, net sales and net profit. Gaps mean the value was not recorded for that date/period."
                >
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke={C.grid} vertical={false} />
                        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: C.grid }} />
                        <YAxis tick={axisTick} tickFormatter={yFmt} tickLine={false} axisLine={false} width={48} />
                        <Tooltip formatter={tooltipFmt} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="sales" name="Total sales" stroke={C.sales} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} />
                        <Line type="monotone" dataKey="net" name="Net sales" stroke={C.net} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                        <Line type="monotone" dataKey="netProfit" name="Net profit" stroke={C.profit} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card title="Sales vs target" subtitle="Only dates/businesses with a configured target are compared.">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={2}>
                        <CartesianGrid stroke={C.grid} vertical={false} />
                        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: C.grid }} />
                        <YAxis tick={axisTick} tickFormatter={yFmt} tickLine={false} axisLine={false} width={48} />
                        <Tooltip formatter={tooltipFmt} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="actualVsTarget" name="Actual (targeted businesses)" fill={C.sales} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="target" name="Target" fill={C.target} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card title={`Discount and profit/loss breakdown — ${data.coverage?.selectedPeriod || data.period.monthName}`} subtitle="Deductions are shown as negative bars.">
                  {unavailable.length > 0 && (
                    <Alert tone="warn" className="mb-3">
                      Data unavailable: {unavailable.join(", ")}. Add Discount / Cost / Expenses columns to your imports to complete the P&amp;L.
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

                {singleBusiness ? (
                  <Card
                    title={`${data.businessBreakdown[0]?.name || "Business"} — sales vs target`}
                    subtitle={`${data.businessBreakdown[0]?.city || ""} · ${data.coverage?.selectedPeriod || data.period.monthName}`}
                  >
                    {trend.every((t) => t.sales === null) ? (
                      <EmptyState title="No sales records in this range." />
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={2}>
                            <CartesianGrid stroke={C.grid} vertical={false} />
                            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: C.grid }} />
                            <YAxis tick={axisTick} tickFormatter={yFmt} tickLine={false} axisLine={false} width={48} />
                            <Tooltip formatter={tooltipFmt} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="sales" name="Sales" fill={C.sales} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="target" name="Target" fill={C.target} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </Card>
                ) : (
                  <Card
                    title={`${isClient ? "Location" : "Business"}-wise comparison — ${data.coverage?.selectedPeriod || data.period.monthName}`}
                    subtitle={`Recorded sales vs target, top 15 ${isClient ? "locations" : "businesses"} with a record.`}
                  >
                    {bizChart.length === 0 ? (
                      <EmptyState title="No sales records for this period." />
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
                )}
              </div>

              {/* Business profitability table */}
              <Card
                title="Business profitability table"
                subtitle={tableMode === "month" ? `Every ${isClient ? "location" : "business"} in scope for ${data.coverage?.selectedPeriod || data.period.monthName}.` : `Every recorded row in scope.`}
                actions={
                  <div className="flex gap-1">
                    {showTable && (
                      <select className={`${inputCls} !py-1 !text-xs`} value={tableMode} onChange={(e) => setTableMode(e.target.value)} aria-label="Table period">
                        <option value="month">Current selection</option>
                        <option value="range">All records in scope</option>
                      </select>
                    )}
                    <button type="button" className={btn.ghost} onClick={() => setShowTable((v) => !v)}>{showTable ? "Hide" : "Show"} table</button>
                  </div>
                }
              >
                {showTable && (() => {
                  const rows =
                    tableMode === "month"
                      ? data.businessBreakdown.map((b) => ({ key: b._id, monthName: data.coverage?.selectedPeriod || data.period.monthName, business: b.name, city: b.city, status: b.hasRecord ? (b.source === "excel_upload" ? "Imported" : "Manual") : "No record", growth: b.growth, ...b }))
                      : (data.profitabilityRows || []).map((r) => ({ key: r._id, status: r.source === "excel_upload" ? "Imported" : "Manual", growth: undefined, ...r }));
                  if (!rows.length) return <EmptyState title="No sales records in this period." />;
                  const heads = ["Reporting Period", isClient ? "Location" : "Business", "Sales", "Discount", "Net sales", "Cost", "Expenses", "Net profit / loss", "Margin", "Target %"];
                  if (tableMode === "month") heads.push("Period Growth");
                  return (
                    <div className="overflow-x-auto border border-gray-200 rounded-xl">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wider text-gray-600">
                          <tr>
                            {heads.map((h) => (
                              <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rows.map((b) => (
                            <tr key={b.key}>
                              <td className="px-3 py-2 whitespace-nowrap">{b.dateStr || b.monthName}</td>
                              <td className="px-3 py-2 font-semibold whitespace-nowrap">{b.business}<span className="block text-gray-500 font-normal">{b.city} · {b.status}</span></td>
                              <td className="px-3 py-2"><MetricCell m={b.recordedSales} /></td>
                              <td className="px-3 py-2"><MetricCell m={b.discount} /></td>
                              <td className="px-3 py-2"><MetricCell m={b.net} /></td>
                              <td className="px-3 py-2"><MetricCell m={b.cost} /></td>
                              <td className="px-3 py-2"><MetricCell m={b.expenses} /></td>
                              <td className="px-3 py-2"><MetricCell m={b.netProfit} /></td>
                              <td className="px-3 py-2"><MetricCell m={b.profitMargin} pct /></td>
                              <td className="px-3 py-2">{b.target?.achievement === null || b.target?.achievement === undefined ? <span className="text-gray-400">{b.recordCount ? "Not configured" : "—"}</span> : `${b.target.achievement}%`}</td>
                              {tableMode === "month" && <td className="px-3 py-2">{growthText(b.growth)}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </Card>

              {/* Sales Record History */}
              <Card
                title="Sales record history"
                subtitle={`Underlying individual records for ${data.coverage?.selectedPeriod || data.period.monthName}. Both Manager and Client Portals read from this single source of truth.`}
                actions={
                  <div className="flex items-center gap-2">
                    {showHistory && (
                      <input
                        type="text"
                        placeholder="Search business / ID / date..."
                        className={`${inputCls} !py-1 !text-xs !w-44`}
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                      />
                    )}
                    <button type="button" className={btn.ghost} onClick={() => setShowHistory((v) => !v)}>
                      {showHistory ? "Hide" : "Show"} history ({data.salesHistory?.length || 0})
                    </button>
                  </div>
                }
              >
                {showHistory && (() => {
                  const query = historySearch.toLowerCase().trim();
                  const list = (data.salesHistory || []).filter((r) => {
                    if (!query) return true;
                    return (
                      r.businessName?.toLowerCase().includes(query) ||
                      r.city?.toLowerCase().includes(query) ||
                      r.transactionId?.toLowerCase().includes(query) ||
                      r.dateStr?.toLowerCase().includes(query) ||
                      r.remarks?.toLowerCase().includes(query)
                    );
                  });
                  if (!list.length) {
                    return <EmptyState title={historySearch ? "No matching records found." : "No records for this period."} />;
                  }
                  return (
                    <div className="overflow-x-auto border border-gray-200 rounded-xl max-h-96">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wider text-gray-600 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 whitespace-nowrap">Date / Period</th>
                            <th className="px-3 py-2 whitespace-nowrap">Transaction ID</th>
                            <th className="px-3 py-2 whitespace-nowrap">{isClient ? "Location" : "Business"}</th>
                            <th className="px-3 py-2 text-right">Sales</th>
                            <th className="px-3 py-2 text-right">Orders</th>
                            <th className="px-3 py-2 text-right">Discount</th>
                            <th className="px-3 py-2 text-right">Net Sales</th>
                            <th className="px-3 py-2 text-right">Cost</th>
                            <th className="px-3 py-2 text-right">Gross Profit</th>
                            <th className="px-3 py-2 text-right">Expenses</th>
                            <th className="px-3 py-2 text-right">Net Profit</th>
                            <th className="px-3 py-2 text-right">Margin</th>
                            <th className="px-3 py-2 text-right">Target</th>
                            <th className="px-3 py-2">Remarks / Source</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {list.map((r) => (
                            <tr key={r._id}>
                              <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">{r.dateStr}</td>
                              <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px] text-gray-500">{r.transactionId || "—"}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <span className="font-semibold">{r.businessName}</span>
                                <span className="block text-[10px] text-gray-500">{r.city}</span>
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-semibold">{formatINR(r.totalSales)}</td>
                              <td className="px-3 py-2 text-right">{r.orders ?? "—"}</td>
                              <td className="px-3 py-2 text-right">{r.discount !== null ? formatINR(r.discount) : <span className="text-gray-400">—</span>}</td>
                              <td className="px-3 py-2 text-right font-mono">{r.netSales !== null ? formatINR(r.netSales) : <span className="text-gray-400">—</span>}</td>
                              <td className="px-3 py-2 text-right">{r.cost !== null ? formatINR(r.cost) : <span className="text-gray-400">—</span>}</td>
                              <td className="px-3 py-2 text-right font-mono">{r.grossProfit !== null ? formatINR(r.grossProfit) : <span className="text-gray-400">—</span>}</td>
                              <td className="px-3 py-2 text-right">{r.expenses !== null ? formatINR(r.expenses) : <span className="text-gray-400">—</span>}</td>
                              <td className={`px-3 py-2 text-right font-mono font-semibold ${r.netProfit !== null && r.netProfit < 0 ? "text-red-600" : ""}`}>
                                {r.netProfit !== null ? formatINR(r.netProfit) : <span className="text-gray-400">—</span>}
                              </td>
                              <td className="px-3 py-2 text-right">{r.marginPct !== null ? `${r.marginPct}%` : <span className="text-gray-400">—</span>}</td>
                              <td className="px-3 py-2 text-right">{r.target ? `${formatINR(r.target)} (${r.achievementPct ?? 0}%)` : <span className="text-gray-400">—</span>}</td>
                              <td className="px-3 py-2 text-[11px] text-gray-600 max-w-[180px] truncate" title={r.remarks}>
                                {r.remarks ? <span>{r.remarks} · </span> : null}
                                <span className="text-gray-400 capitalize">{r.source === "excel_upload" ? "Imported" : r.source}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </Card>

              {/* Import pipeline tracking */}
              <Card title="Sales records pipeline" subtitle={`Records and imports for ${data.coverage?.selectedPeriod || data.period.monthName}`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {[
                    ["Reporting period", data.coverage?.selectedPeriod || data.period.monthName],
                    ["Imported records", data.imports?.importedRecords || 0],
                    ["Manual records", data.imports?.manualRecords || 0],
                    ...(isClient ? [["Manual portal entries", data.imports?.portalManualEntries ?? 0]] : []),
                    ["Pending (previewed, not confirmed)", `${data.imports?.pendingPreviews || 0} file(s) / ${data.imports?.pendingRows || 0} rows`],
                    ["Invalid / rejected rows", data.imports?.invalidRows || 0],
                    ["Skipped (already existed)", data.imports?.skippedRows || 0],
                    ["Completed imports", data.imports?.importsCompleted || 0],
                    ["Failed imports", data.imports?.importsFailed || 0],
                    [isClient ? "Locations without a record" : "Businesses without a record", data.imports?.businessesWithoutRecord || 0],
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
                    {!data.imports?.importHistory?.length ? (
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
                              const [label, cls] = IMPORT_STATUS[j.status] || [j.status, "bg-gray-100"];
                              return (
                                <tr key={j._id}>
                                  <td className="px-3 py-2 whitespace-nowrap">{j.uploadedAtLabel}<span className="block text-gray-500">{j.uploaderName}</span></td>
                                  <td className="px-3 py-2">{j.reportingPeriods?.length ? j.reportingPeriods.join(", ") : "—"}</td>
                                  <td className="px-3 py-2 max-w-[200px] truncate" title={j.filename || ""}>{j.sharedFile ? <span className="text-gray-500">Multi-business file</span> : j.filename}</td>
                                  <td className="px-3 py-2 font-mono">{j.recordsForYou}</td>
                                  <td className="px-3 py-2 font-mono">{j.sharedFile ? <span className="text-gray-400">—</span> : j.rejected}</td>
                                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap ${cls}`}>{label}</span></td>
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
