import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaUsers, FaChevronDown, FaChevronUp } from "react-icons/fa";
import api from "../../utils/axios";

/**
 * Manager Portal → Leads & Enquiries: Customer Insights (customers, not products).
 * Summary cards come from GET /portal/leads/customers; choosing an insight,
 * a customer filter or a customer sort switches the enquiry table below to one
 * row per customer (same endpoint). Visits and spending are actual records only;
 * missing data shows "Data unavailable".
 */
const inr = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const int = (v) => Number(v || 0).toLocaleString("en-IN");
const NA = "Data unavailable";

export const EMPTY_CUSTOMER_FILTERS = { insight: "", range: "", from: "", to: "", customer: "", visits: "", spendMin: "", spendMax: "", status: "", type: "", source: "", inactiveDays: "60", sort: "" };

const INSIGHTS = [
  ["", "All customers (enquiry view)"],
  ["topSpending", "Top Spending Customers"],
  ["frequentVisitors", "Most Frequent Visitors"],
  ["frequentEnquirers", "Most Frequent Enquirers"],
  ["highestValue", "Highest Value Customers"],
  ["recentVisitors", "Recent Visitors"],
  ["inactive", "Inactive Customers"],
  ["newVsReturning", "New vs Returning Customers"],
  ["topConverted", "Top Converted Customers"],
  ["lostLeads", "Lost Leads"],
  ["highValueLeads", "High-Value Leads (estimated)"],
];
const RANGES = [["", "All dates"], ["today", "Today"], ["last7", "Last 7 days"], ["last30", "Last 30 days"], ["thisMonth", "This month"], ["lastMonth", "Last month"], ["custom", "Custom range"]];
const VISITS = [["", "Any"], ["most", "Most frequent"], ["one", "1 visit"], ["2-5", "2–5 visits"], ["6-10", "6–10 visits"], ["10+", "More than 10"]];
const SORTS = [["", "Default"], ["spend_desc", "Highest spending"], ["visits_desc", "Most visits"], ["enquiries_desc", "Most enquiries"], ["recent_visit", "Recently visited"], ["newest_lead", "Newest leads"]];

const field = "w-full px-2.5 py-2 text-xs rounded-lg border border-[#E0D8CE] bg-white focus:outline-hidden focus:border-[#9C7A42]";
const label = "text-[11px] font-semibold text-stone-600 space-y-1";

/** Filters that turn the table into the customer view. */
export const isCustomerView = (f) => Boolean(f.insight || f.customer || f.visits || f.spendMin || f.spendMax || f.type || f.sort || f.range || f.status || f.source);

function Card({ title, value, sub }) {
  return (
    <div className="bg-white border border-[#E7DFD5] rounded-xl p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">{title}</p>
      <p className={`mt-1 font-bold truncate ${value === NA ? "text-xs text-stone-400" : "text-base font-mono text-stone-900"}`} title={String(value)}>{value}</p>
      {sub && <p className="text-[11px] text-stone-500 mt-0.5 truncate" title={sub}>{sub}</p>}
    </div>
  );
}

export default function CustomerInsightsPanel({ clientId, filters, onApply, sources = [], statuses = [], refreshKey = 0 }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");
  const reqId = useRef(0);
  useEffect(() => setDraft(filters), [filters]);

  const query = useMemo(() => {
    const p = new URLSearchParams({ limit: "1" });
    if (clientId) p.set("clientId", clientId);
    Object.entries(filters).forEach(([k, v]) => v !== "" && v != null && p.set(k, String(v)));
    return p.toString();
  }, [clientId, filters]);

  useEffect(() => {
    if (!clientId) return;
    const id = ++reqId.current;
    api
      .get(`/portal/leads/customers?${query}`)
      .then(({ data }) => id === reqId.current && (setRes(data), setError("")))
      .catch((err) => id === reqId.current && setError(err.response?.data?.message || "Could not load customer insights."));
  }, [query, clientId, refreshKey]);

  // dropdowns apply at once; typed values (search, amounts, dates) with Apply
  const pick = (k, v) => {
    const next = { ...draft, [k]: v };
    setDraft(next);
    if (!(k === "range" && v === "custom")) onApply(next);
  };

  const s = res?.summary;
  const scopeNote = res
    ? [
        res.data?.posSales ? "Visits = distinct days with a POS bill" : null,
        s && s.coverage.withVisitData < s.uniqueCustomers ? `${int(s.uniqueCustomers - s.coverage.withVisitData)} customer(s) have no visit records` : null,
        res.data?.unidentifiedBills ? `${int(res.data.unidentifiedBills)} POS bill(s) had no customer phone/ID and are not counted per customer` : null,
      ].filter(Boolean).join(" · ")
    : "";

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#E7DFD5] rounded-xl p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600">
            <FaUsers className="w-3 h-3 text-[#9C7A42]" /> Customer Insights
            <select value={draft.insight} onChange={(e) => pick("insight", e.target.value)} className="px-2.5 py-2 text-xs rounded-lg border border-[#E0D8CE] bg-white">
              {INSIGHTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {draft.insight === "inactive" && (
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600">
              No visit or enquiry for
              <input type="number" min="1" max="3650" value={draft.inactiveDays} onChange={(e) => setDraft({ ...draft, inactiveDays: e.target.value })} className="w-16 px-2 py-2 text-xs rounded-lg border border-[#E0D8CE]" />
              days
            </label>
          )}
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-600">
            Sort customers
            <select value={draft.sort} onChange={(e) => pick("sort", e.target.value)} className="px-2.5 py-2 text-xs rounded-lg border border-[#E0D8CE] bg-white">
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[#E0D8CE] bg-white text-stone-700 cursor-pointer">
            Customer filters {open ? <FaChevronUp className="w-2.5 h-2.5" /> : <FaChevronDown className="w-2.5 h-2.5" />}
          </button>
          {isCustomerView(filters) && <span className="text-[11px] text-[#7a5f33] font-semibold">Table shows one row per customer</span>}
        </div>

        {open && (
          <div className="mt-3 pt-3 border-t border-[#EFE8DF] grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <label className={label}><span>Date</span>
              <select className={field} value={draft.range} onChange={(e) => pick("range", e.target.value)}>{RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <label className={label}><span>Customer name, phone or email</span>
              <input className={field} value={draft.customer} onChange={(e) => setDraft({ ...draft, customer: e.target.value })} onKeyDown={(e) => e.key === "Enter" && onApply(draft)} placeholder="e.g. Asha or 98765" />
            </label>
            <label className={label}><span>Number of visits</span>
              <select className={field} value={draft.visits} onChange={(e) => pick("visits", e.target.value)}>{VISITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className={label}><span>Spend min ₹</span><input type="number" min="0" className={field} value={draft.spendMin} onChange={(e) => setDraft({ ...draft, spendMin: e.target.value })} /></label>
              <label className={label}><span>Spend max ₹</span><input type="number" min="0" className={field} value={draft.spendMax} onChange={(e) => setDraft({ ...draft, spendMax: e.target.value })} /></label>
            </div>
            <label className={label}><span>Enquiry status</span>
              <select className={field} value={draft.status} onChange={(e) => pick("status", e.target.value)}><option value="">All</option>{statuses.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <label className={label}><span>Customer type</span>
              <select className={field} value={draft.type} onChange={(e) => pick("type", e.target.value)}><option value="">New &amp; returning</option><option value="new">New (1 visit)</option><option value="returning">Returning (2+ visits)</option></select>
            </label>
            <label className={label}><span>Acquisition source</span>
              <select className={field} value={draft.source} onChange={(e) => pick("source", e.target.value)}><option value="">All sources</option>{sources.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            {draft.range === "custom" ? (
              <div className="grid grid-cols-2 gap-2">
                <label className={label}><span>From</span><input type="date" className={field} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></label>
                <label className={label}><span>To</span><input type="date" className={field} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></label>
              </div>
            ) : (
              <div />
            )}
            <div className="col-span-2 md:col-span-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-stone-500">Location and manager access follow the client selected above (managers see only their assigned clients).</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => onApply({ ...EMPTY_CUSTOMER_FILTERS })} className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-[#E0D8CE] bg-white text-stone-700 hover:bg-stone-50 cursor-pointer">Reset Filters</button>
                <button type="button" onClick={() => onApply(draft)} className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#9C7A42] text-white hover:bg-[#86683a] cursor-pointer">Apply Filters</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">{error}</div>}

      {s && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card title="Total unique customers" value={int(s.uniqueCustomers)} sub="deduplicated by phone / email" />
            <Card title="Total customer visits" value={s.totalVisits == null ? NA : int(s.totalVisits)} sub={s.totalVisits == null ? "no visit records" : `${int(s.coverage.withVisitData)} customers with visit records`} />
            <Card title="Total enquiries" value={int(s.totalEnquiries)} sub="counted separately from visits" />
            <Card title="Returning customers" value={s.returningCustomers == null ? NA : int(s.returningCustomers)} sub={s.returningCustomers == null ? "needs visit records" : `${int(s.newCustomers)} new (1 visit)`} />
            <Card title="Highest spending customer" value={s.highestSpender ? s.highestSpender.name : NA} sub={s.highestSpender ? inr(s.highestSpender.spent) : "no spending records"} />
            <Card title="Most frequent visitor" value={s.mostFrequentVisitor ? s.mostFrequentVisitor.name : NA} sub={s.mostFrequentVisitor ? `${int(s.mostFrequentVisitor.visits)} visits` : "no visit records"} />
            <Card title="Average customer spending" value={s.avgSpending == null ? NA : inr(s.avgSpending)} sub={s.avgSpending == null ? "no spending records" : `across ${int(s.coverage.withSpendData)} customers with spending`} />
            <Card title="Total converted enquiries" value={int(s.convertedEnquiries)} sub="status Converted" />
          </div>
          {scopeNote && <p className="text-[11px] text-stone-500">{scopeNote}</p>}
        </>
      )}
    </div>
  );
}
