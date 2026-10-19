import React, { useEffect, useMemo, useRef, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { FaFilter, FaChevronDown, FaChevronUp, FaTrophy } from "react-icons/fa";
import api from "../../utils/axios";

/**
 * Manager Portal → Leads & Enquiries: Advanced Filters, KPI cards, Top
 * Performers and charts. Every figure comes from GET /portal/leads/analytics
 * (real enquiries and recorded sales); product rankings are shown only when
 * the client has product-level sales data.
 */
const inr = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const int = (v) => Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const short = (s, n = 16) => (String(s || "").length > n ? `${String(s).slice(0, n - 1)}…` : s);

export const EMPTY_FILTERS = { status: "", source: "", segment: "", valueBand: "", valueMin: "", valueMax: "", range: "", from: "", to: "", location: "", sort: "newest" };

const RANGES = [
  ["", "All dates"],
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["last7", "Last 7 days"],
  ["last30", "Last 30 days"],
  ["thisMonth", "This month"],
  ["lastMonth", "Last month"],
  ["custom", "Custom range"],
];
const BANDS = [
  ["", "Any value"],
  ["low", "Low (under ₹5,000)"],
  ["medium", "Medium (₹5,000–₹25,000)"],
  ["high", "High (₹25,000+)"],
  ["custom", "Custom range"],
];
const SORTS = [
  ["sales_desc", "Highest sales"],
  ["sales_asc", "Lowest sales"],
  ["revenue_desc", "Highest revenue"],
  ["revenue_asc", "Lowest revenue"],
  ["newest", "Newest first"],
  ["oldest", "Oldest first"],
];
const PERFORMERS = [
  ["products", "Best-selling products"],
  ["revenueProducts", "Highest revenue products"],
  ["customers", "Top customers"],
  ["sources", "Best acquisition sources"],
  ["enquiries", "Highest-value enquiries"],
];

const field = "w-full px-2.5 py-2 text-xs rounded-lg border border-[#E0D8CE] bg-white focus:outline-hidden focus:border-[#9C7A42]";
const card = "bg-white border border-[#E7DFD5] rounded-xl";

function Kpi({ label, value, sub }) {
  return (
    <div className={`${card} p-3.5`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">{label}</p>
      <p className="text-base font-bold font-mono text-stone-900 mt-1 truncate" title={String(value)}>{value}</p>
      {sub && <p className="text-[11px] text-stone-500 mt-0.5 truncate" title={sub}>{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children, empty }) {
  return (
    <div className={`${card} p-4`}>
      <p className="text-xs font-bold text-stone-800 mb-2">{title}</p>
      {empty ? <p className="h-[200px] flex items-center justify-center text-xs text-stone-500 text-center px-4">{empty}</p> : <div className="h-[200px]">{children}</div>}
    </div>
  );
}

export default function EnquiryAnalyticsPanel({ clientId, filters, onApply, segments = [], sources = [], statuses = [], refreshKey = 0 }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [performer, setPerformer] = useState("products");
  const reqId = useRef(0);

  useEffect(() => setDraft(filters), [filters]);

  // Selects apply immediately; custom ranges (typed) apply with "Apply Filters"
  const setNow = (k, v) => {
    const next = { ...draft, [k]: v };
    setDraft(next);
    const typed = (k === "range" && v === "custom") || (k === "valueBand" && v === "custom");
    if (!typed) onApply(next);
  };

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (clientId) p.set("clientId", clientId);
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== "" && v != null && k !== "sort") p.set(k, String(v));
    });
    return p.toString();
  }, [clientId, filters]);

  useEffect(() => {
    if (!clientId) return;
    const id = ++reqId.current;
    setLoading(true);
    api
      .get(`/portal/leads/analytics?${query}`)
      .then(({ data: d }) => {
        if (id === reqId.current) {
          setData(d);
          setError("");
        }
      })
      .catch((err) => {
        if (id === reqId.current) setError(err.response?.data?.message || "Could not load analytics.");
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  }, [query, clientId, refreshKey]);

  const activeCount = Object.entries(filters).filter(([k, v]) => v && !(k === "sort" && v === "newest")).length;
  const k = data?.kpis;
  const s = data?.sales;
  const salesOk = s?.available;
  const totals = s?.totals;
  const locations = s?.locations || [];

  const performerRows = useMemo(() => {
    if (!data) return { rows: [], note: "" };
    const unavailable = "Sales data unavailable — no product-level sales are recorded for this client.";
    switch (performer) {
      case "products":
        return salesOk ? { rows: s.products.slice(0, 10).map((p) => [p.name, `${int(p.units)} units`, inr(p.revenue)]) } : { rows: [], note: unavailable };
      case "revenueProducts":
        return salesOk ? { rows: [...s.products].sort((a, b) => b.revenue - a.revenue).slice(0, 10).map((p) => [p.name, inr(p.revenue), `${int(p.units)} units`]) } : { rows: [], note: unavailable };
      case "customers":
        if (s?.customers?.length) return { rows: s.customers.map((c) => [c.name, inr(c.total), `${c.sales} sale${c.sales === 1 ? "" : "s"}`]) };
        return data.topConvertedCustomers.length
          ? { rows: data.topConvertedCustomers.map((c) => [c.name, inr(c.value), "converted enquiry value"]), note: "Ranked by the value recorded on converted enquiries (no customer-level sales recorded)." }
          : { rows: [], note: "No converted customers with a recorded value in this selection." };
      case "sources":
        return { rows: data.bySource.map((x) => [x.source, `${x.converted}/${x.total} converted`, `${x.conversionRate}% · ${inr(x.convertedValue)}`]) };
      default:
        return { rows: data.topEnquiries.map((e) => [e.name, inr(e.estimatedValue), `${e.status} · ${e.source}`]) };
    }
  }, [data, performer, s, salesOk]);

  const salesTrend = salesOk || totals ? s.trend : [];
  const trend = salesTrend.length ? salesTrend.map((t) => ({ period: t.period, value: t.revenue })) : (data?.trend.points || []).map((t) => ({ period: t.period, value: t.enquiries }));
  const trendIsSales = salesTrend.length > 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className={`${card} p-3 sm:p-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#1A1A1A] text-white cursor-pointer"
          >
            <FaFilter className="w-3 h-3" /> Advanced Filters{activeCount ? ` (${activeCount})` : ""}
            {open ? <FaChevronUp className="w-2.5 h-2.5" /> : <FaChevronDown className="w-2.5 h-2.5" />}
          </button>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600">
            Sort
            <select value={draft.sort} onChange={(e) => setNow("sort", e.target.value)} className="px-2.5 py-2 text-xs rounded-lg border border-[#E0D8CE] bg-white">
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600">
            <FaTrophy className="w-3 h-3 text-[#9C7A42]" /> Top Performers
            <select value={performer} onChange={(e) => setPerformer(e.target.value)} className="px-2.5 py-2 text-xs rounded-lg border border-[#E0D8CE] bg-white">
              {PERFORMERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {loading && <span className="text-[11px] text-stone-500">Updating…</span>}
        </div>

        {open && (
          <div className="mt-3 pt-3 border-t border-[#EFE8DF] grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <label className="text-[11px] font-semibold text-stone-600 space-y-1">
              <span>Status</span>
              <select className={field} value={draft.status} onChange={(e) => setNow("status", e.target.value)}>
                <option value="">All</option>
                {statuses.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-stone-600 space-y-1">
              <span>Acquisition source</span>
              <select className={field} value={draft.source} onChange={(e) => setNow("source", e.target.value)}>
                <option value="">All sources</option>
                {sources.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-stone-600 space-y-1">
              <span>Customer segment</span>
              <select className={field} value={draft.segment} onChange={(e) => setNow("segment", e.target.value)} disabled={!segments.length}>
                <option value="">{segments.length ? "All segments" : "No segments recorded"}</option>
                {segments.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-stone-600 space-y-1">
              <span>Estimated value</span>
              <select className={field} value={draft.valueBand} onChange={(e) => setNow("valueBand", e.target.value)}>
                {BANDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-stone-600 space-y-1">
              <span>Date</span>
              <select className={field} value={draft.range} onChange={(e) => setNow("range", e.target.value)}>
                {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-stone-600 space-y-1">
              <span>Location (sales)</span>
              <select className={field} value={draft.location} onChange={(e) => setNow("location", e.target.value)} disabled={locations.length < 2}>
                <option value="">{locations.length ? "All locations" : "Single location"}</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.city ? `, ${l.city}` : ""}</option>)}
              </select>
            </label>

            {draft.valueBand === "custom" && (
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <label className="text-[11px] font-semibold text-stone-600 space-y-1"><span>Min ₹</span><input type="number" min="0" className={field} value={draft.valueMin} onChange={(e) => setDraft({ ...draft, valueMin: e.target.value })} /></label>
                <label className="text-[11px] font-semibold text-stone-600 space-y-1"><span>Max ₹</span><input type="number" min="0" className={field} value={draft.valueMax} onChange={(e) => setDraft({ ...draft, valueMax: e.target.value })} /></label>
              </div>
            )}
            {draft.range === "custom" && (
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <label className="text-[11px] font-semibold text-stone-600 space-y-1"><span>From</span><input type="date" className={field} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></label>
                <label className="text-[11px] font-semibold text-stone-600 space-y-1"><span>To</span><input type="date" className={field} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></label>
              </div>
            )}

            <div className="col-span-2 md:col-span-3 lg:col-span-6 flex justify-end gap-2">
              <button type="button" onClick={() => onApply({ ...EMPTY_FILTERS })} className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-[#E0D8CE] bg-white text-stone-700 hover:bg-stone-50 cursor-pointer">
                Reset Filters
              </button>
              <button type="button" onClick={() => onApply(draft)} className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#9C7A42] text-white hover:bg-[#86683a] cursor-pointer">
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">{error}</div>}

      {k && (
        <>
          {/* Revenue & conversion */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Total enquiries" value={int(k.totalEnquiries)} sub="in this selection" />
            <Kpi label="Converted enquiries" value={int(k.converted)} sub={`${k.conversionRate}% of enquiries`} />
            <Kpi label="Revenue from converted" value={inr(k.convertedValue)} sub="value recorded on converted enquiries" />
            <Kpi label="Open pipeline value" value={inr(k.pipelineValue)} sub="estimated · new, contacted, qualified" />
            <Kpi label="Lost value" value={inr(k.lostValue)} sub="estimated value of lost enquiries" />
            <Kpi label="Conversion rate" value={`${k.conversionRate}%`} sub={`${k.converted} of ${k.totalEnquiries}`} />
            <Kpi
              label="Average sale value"
              value={totals?.avgSale != null ? inr(totals.avgSale) : k.converted ? inr(k.avgConvertedValue) : "—"}
              sub={totals?.avgSale != null ? `recorded sales (${s.revenueSource})` : "per converted enquiry"}
            />
            <Kpi label="Best acquisition source" value={k.bestSource ? k.bestSource.source : "—"} sub={k.bestSource ? `${k.bestSource.converted} converted · ${inr(k.bestSource.convertedValue)}` : "no conversions yet"} />
          </div>

          {/* Sales performance (recorded sales only) */}
          <div className={`${card} p-4`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <p className="text-xs font-bold text-stone-800">Sales performance</p>
              <p className="text-[11px] text-stone-500">
                {s.productSource || s.revenueSource ? `Source: ${[s.productSource, s.revenueSource].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(" · ")}` : "No recorded sales for this selection"}
              </p>
            </div>
            {!salesOk && <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">Sales data unavailable: product/service-level sales (names and quantities) are not recorded for this client, so product rankings are not shown.</p>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Best-selling item" value={salesOk ? s.products[0].name : "—"} sub={salesOk ? `${int(s.products[0].units)} units` : "by quantity sold"} />
              <Kpi label="Highest revenue item" value={salesOk ? [...s.products].sort((a, b) => b.revenue - a.revenue)[0].name : "—"} sub={salesOk ? inr(Math.max(...s.products.map((p) => p.revenue))) : "by revenue"} />
              <Kpi label="Top-selling category" value={s.categories?.length ? s.categories[0].category : "—"} sub={s.categories?.length ? inr(s.categories[0].revenue) : "by sales"} />
              <Kpi label="Highest-value sale" value={totals?.highestSale ? inr(totals.highestSale.amount) : "—"} sub={totals?.highestSale ? [totals.highestSale.invoice, totals.highestSale.customer].filter(Boolean).join(" · ") || "single sale" : "individual sales not recorded"} />
              <Kpi label="Recorded sales revenue" value={totals ? inr(totals.revenue) : "—"} sub={totals ? `${totals.transactions != null ? `${int(totals.transactions)} sales` : "sales count not recorded"}` : "no recorded sales"} />
              <Kpi label="Average order value" value={totals?.avgSale != null ? inr(totals.avgSale) : "—"} sub="recorded revenue ÷ sales" />
              <Kpi label="Total units sold" value={totals?.unitsSold != null ? int(totals.unitsSold) : "—"} sub={totals?.unitsSold != null ? "from item-level data" : "quantities not recorded"} />
              <Kpi label="Top customer" value={s.customers?.length ? s.customers[0].name : "—"} sub={s.customers?.length ? inr(s.customers[0].total) : "customer sales not recorded"} />
            </div>
          </div>

          {/* Top performers + ranking */}
          <div className="grid lg:grid-cols-2 gap-3">
            <div className={`${card} p-4`}>
              <p className="text-xs font-bold text-stone-800 mb-2">{PERFORMERS.find(([v]) => v === performer)[1]}</p>
              {performerRows.note && <p className="text-[11px] text-stone-500 mb-2">{performerRows.note}</p>}
              {performerRows.rows.length ? (
                <ol className="divide-y divide-[#EFE8DF]">
                  {performerRows.rows.map(([a, b, c], i) => (
                    <li key={`${a}-${i}`} className="flex items-center gap-3 py-1.5 text-xs">
                      <span className="w-5 text-right font-mono text-stone-400">{i + 1}</span>
                      <span className="flex-1 truncate font-semibold text-stone-800" title={a}>{a}</span>
                      <span className="font-mono text-stone-900">{b}</span>
                      <span className="hidden sm:inline w-40 text-right text-stone-500 truncate">{c}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                !performerRows.note && <p className="text-xs text-stone-500">Nothing to rank in this selection.</p>
              )}
            </div>
            <div className={`${card} p-4`}>
              <p className="text-xs font-bold text-stone-800 mb-2">Sales performance ranking</p>
              {salesOk ? (
                <div className="max-h-[260px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-stone-500 text-left">
                      <tr><th className="py-1">#</th><th>Product / service</th><th>Category</th><th className="text-right">Units</th><th className="text-right">Revenue</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFE8DF]">
                      {s.products.map((p, i) => (
                        <tr key={`${p.name}-${i}`}>
                          <td className="py-1 font-mono text-stone-400">{i + 1}</td>
                          <td className="font-semibold text-stone-800 truncate max-w-[160px]" title={p.name}>{p.name}</td>
                          <td className="text-stone-500">{p.category}</td>
                          <td className="text-right font-mono">{int(p.units)}</td>
                          <td className="text-right font-mono">{inr(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-stone-500">Sales data unavailable.</p>
              )}
            </div>
          </div>

          {/* Charts */}
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            <ChartCard title="Top 10 best-selling products/services (units)" empty={!salesOk && "Sales data unavailable"}>
              <ResponsiveContainer>
                <BarChart data={(s.products || []).slice(0, 10).map((p) => ({ name: short(p.name), units: p.units }))} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EFE8DF" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [int(v), "Units"]} />
                  <Bar dataKey="units" fill="#9C7A42" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Revenue by product/service" empty={!salesOk && "Sales data unavailable"}>
              <ResponsiveContainer>
                <BarChart data={[...(s.products || [])].sort((a, b) => b.revenue - a.revenue).slice(0, 10).map((p) => ({ name: short(p.name), revenue: p.revenue }))} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EFE8DF" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [inr(v), "Revenue"]} />
                  <Bar dataKey="revenue" fill="#1A1A1A" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Sales by acquisition source (converted enquiries)" empty={!data.bySource.length && "No enquiries in this selection"}>
              <ResponsiveContainer>
                <BarChart data={data.bySource.map((x) => ({ name: short(x.source, 12), converted: x.converted, enquiries: x.total }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EFE8DF" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="enquiries" fill="#D9CBB6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="converted" fill="#047857" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title={trendIsSales ? `Sales trend (recorded revenue, ${s.revenueSource})` : `Enquiry trend (${data.trend.granularity === "month" ? "monthly" : "daily"})`} empty={!trend.length && "No data in this selection"}>
              <ResponsiveContainer>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EFE8DF" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [trendIsSales ? inr(v) : int(v), trendIsSales ? "Revenue" : "Enquiries"]} />
                  <Line type="monotone" dataKey="value" stroke="#9C7A42" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Enquiry conversion by status" empty={!k.totalEnquiries && "No enquiries in this selection"}>
              <ResponsiveContainer>
                <BarChart data={data.byStatus}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EFE8DF" />
                  <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [int(v), "Enquiries"]} />
                  <Bar dataKey="count" fill="#1A1A1A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
