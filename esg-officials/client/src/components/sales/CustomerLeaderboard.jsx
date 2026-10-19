import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaTrophy, FaSortAmountDown, FaSortAmountUp } from "react-icons/fa";
import api from "../../utils/axios";

/**
 * Manager Portal → Leads & Enquiries: Top Customers Leaderboard.
 * Rankings come from GET /portal/leads/leaderboard (the selected client's real
 * customer records, one row per customer). Customers without the chosen metric
 * are not ranked; the count and reason are shown instead.
 */
const inr = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const int = (v) => Number(v || 0).toLocaleString("en-IN");
const date = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const NA = <span className="font-sans text-[10px] text-stone-400">Not recorded</span>;

const RANK_BY = [
  ["spending", "Highest Total Spending"],
  ["visits", "Most Frequent Visitors"],
  ["enquiries", "Most Enquiries"],
  ["avg", "Highest Average Spending"],
  ["recent", "Most Recent Visitors"],
  ["converted", "Highest Value Converted Customers"],
];
const TOPS = [["10", "Top 10"], ["25", "Top 25"], ["50", "Top 50"], ["", "All customers"]];
const RANGES = [["", "All dates"], ["today", "Today"], ["last7", "Last 7 days"], ["last30", "Last 30 days"], ["thisMonth", "This month"], ["lastMonth", "Last month"], ["custom", "Custom range"]];
const PAGE_SIZE = 25;
const ctl = "px-2.5 py-2 text-xs rounded-lg border border-[#E0D8CE] bg-white focus:outline-hidden focus:border-[#9C7A42]";

export default function CustomerLeaderboard({ clientId, baseFilters = {}, refreshKey = 0, onSelect }) {
  const [rankBy, setRankBy] = useState("spending");
  const [dir, setDir] = useState("desc");
  const [top, setTop] = useState("10");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [segment, setSegment] = useState("");
  const [range, setRange] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const reqId = useRef(0);
  const lastClientRef = useRef(clientId);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // the leaderboard's own controls win; otherwise the Customer Insights filters apply
  const params = useMemo(() => {
    const p = new URLSearchParams({ rankBy, dir, page: String(page), limit: String(PAGE_SIZE) });
    if (clientId) p.set("clientId", clientId);
    if (top) p.set("top", top);
    const own = { customer: query, type, segment, range, from: range === "custom" ? from : "", to: range === "custom" ? to : "" };
    const base = { customer: baseFilters.customer, type: baseFilters.type, segment: baseFilters.segment, status: baseFilters.status, source: baseFilters.source, range: baseFilters.range, from: baseFilters.from, to: baseFilters.to };
    const useOwnRange = Boolean(range);
    Object.entries(base).forEach(([k, v]) => {
      if (["range", "from", "to"].includes(k) && useOwnRange) return;
      if (v && !own[k]) p.set(k, String(v));
    });
    Object.entries(own).forEach(([k, v]) => v && p.set(k, String(v)));
    return p.toString();
  }, [clientId, rankBy, dir, top, page, query, type, segment, range, from, to, baseFilters]);

  // any change other than the page starts again at page 1
  const resetKey = params.replace(/(^|&)page=\d+/, "");
  const lastReset = useRef(resetKey);
  useEffect(() => {
    if (lastReset.current !== resetKey) {
      lastReset.current = resetKey;
      if (page !== 1) setPage(1);
    }
  }, [resetKey, page]);

  useEffect(() => {
    if (!clientId) return;
    if (lastClientRef.current !== clientId) {
      // never show another client's rows while this client's load
      lastClientRef.current = clientId;
      setData(null);
      setError("");
    }
    const id = ++reqId.current;
    setLoading(true);
    api
      .get(`/portal/leads/leaderboard?${params}`, { timeout: 60000 })
      .then(({ data: d }) => id === reqId.current && (setData(d), setError("")))
      .catch((err) =>
        id === reqId.current &&
        setError(
          err.response?.data?.message ||
            (err.code === "ECONNABORTED" ? "The leaderboard took too long to load. The server may be starting up; try again." : err.response ? `Could not load the leaderboard (error ${err.response.status}).` : "Could not reach the server to load the leaderboard.")
        )
      )
      .finally(() => id === reqId.current && setLoading(false));
  }, [params, clientId, refreshKey, retry]);

  const rows = data?.rows || [];
  const pg = data?.page;
  const highlight = (k) => (k === rankBy ? "bg-[#FBF6EC] font-bold text-stone-900" : "");

  return (
    <section className="bg-white border border-[#E7DFD5] rounded-xl p-3 sm:p-4 space-y-3" aria-labelledby="leaderboard-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="leaderboard-title" className="flex items-center gap-2 text-sm font-bold text-stone-900">
          <FaTrophy className="w-3.5 h-3.5 text-[#9C7A42]" /> Top Customers Leaderboard
        </h3>
        <span className="text-[11px] text-stone-500">{loading ? "Updating…" : data ? `${int(data.ranked)} of ${int(data.customers)} customers ranked` : ""}</span>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[11px] font-semibold text-stone-600 space-y-1">
          <span className="block">Rank Customers By</span>
          <select value={rankBy} onChange={(e) => setRankBy(e.target.value)} className={ctl}>
            {RANK_BY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-[#E0D8CE] bg-white text-stone-700 cursor-pointer"
          title="Switch order"
        >
          {dir === "desc" ? <FaSortAmountDown className="w-3 h-3" /> : <FaSortAmountUp className="w-3 h-3" />}
          {dir === "desc" ? "Highest first" : "Lowest first"}
        </button>
        <label className="text-[11px] font-semibold text-stone-600 space-y-1">
          <span className="block">Show</span>
          <select value={top} onChange={(e) => setTop(e.target.value)} className={ctl}>
            {TOPS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-stone-600 space-y-1 grow sm:grow-0">
          <span className="block">Search</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone or email" className={`${ctl} w-full sm:w-52`} />
        </label>
        <label className="text-[11px] font-semibold text-stone-600 space-y-1">
          <span className="block">Customer type</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className={ctl}>
            <option value="">All</option>
            <option value="new">New</option>
            <option value="returning">Returning</option>
          </select>
        </label>
        <label className="text-[11px] font-semibold text-stone-600 space-y-1">
          <span className="block">RFM segment</span>
          <select value={segment} onChange={(e) => setSegment(e.target.value)} className={ctl} disabled={!data?.segments?.length}>
            <option value="">{data?.segments?.length ? "All segments" : "None recorded"}</option>
            {(data?.segments || []).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-stone-600 space-y-1">
          <span className="block">Date</span>
          <select value={range} onChange={(e) => setRange(e.target.value)} className={ctl}>
            {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {range === "custom" && (
          <>
            <input type="date" aria-label="From" value={from} onChange={(e) => setFrom(e.target.value)} className={ctl} />
            <input type="date" aria-label="To" value={to} onChange={(e) => setTo(e.target.value)} className={ctl} />
          </>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={() => setRetry((n) => n + 1)} className="shrink-0 font-semibold underline cursor-pointer">Try again</button>
        </div>
      )}
      {data && data.excluded > 0 && (
        <p className="text-[11px] text-stone-500">
          {int(data.excluded)} customer{data.excluded === 1 ? "" : "s"} not ranked: {data.excludedReason}.
          {data.rankBy === "converted" ? " Ranked by actual recorded spending of customers with a converted enquiry; estimated enquiry values are not used." : ""}
        </p>
      )}

      <div className="overflow-x-auto border border-[#EFE8DF] rounded-lg">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#FAF7F2] text-stone-600 uppercase tracking-wider text-[10px] border-b border-[#E7DFD5]">
              <th className="py-2.5 px-3">Rank</th>
              <th className="py-2.5 px-3">Customer Name</th>
              <th className="py-2.5 px-3">Phone</th>
              <th className="py-2.5 px-3 text-right">Total Spending</th>
              <th className="py-2.5 px-3 text-right">Visits</th>
              <th className="py-2.5 px-3 text-right">Enquiries</th>
              <th className="py-2.5 px-3 text-right">Avg Spending</th>
              <th className="py-2.5 px-3">Last Visit</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">RFM Segment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE9E0]">
            {rows.map((c) => (
              <tr
                key={c.key}
                onClick={() => onSelect && onSelect(c)}
                className={`hover:bg-stone-50 ${onSelect ? "cursor-pointer" : ""}`}
                title={c.leadId ? "Show this customer's enquiries below" : "Known from POS sales only"}
              >
                <td className="py-2 px-3 font-mono font-bold text-[#7a5f33]">#{c.rank}</td>
                <td className="py-2 px-3 font-semibold text-stone-900 max-w-[180px] truncate" title={c.name}>{c.name}</td>
                <td className="py-2 px-3 font-mono text-stone-600">{c.phone || (c.email ? <span className="font-sans">{c.email}</span> : "—")}</td>
                <td className={`py-2 px-3 text-right font-mono ${highlight("spending")} ${highlight("converted")}`}>{c.spent != null ? inr(c.spent) : NA}</td>
                <td className={`py-2 px-3 text-right font-mono ${highlight("visits")}`}>{c.visits != null ? int(c.visits) : NA}</td>
                <td className={`py-2 px-3 text-right font-mono ${highlight("enquiries")}`}>{int(c.enquiries)}</td>
                <td className={`py-2 px-3 text-right font-mono ${highlight("avg")}`}>{c.avgSpend != null ? inr(c.avgSpend) : NA}</td>
                <td className={`py-2 px-3 font-mono text-stone-600 ${highlight("recent")}`}>{c.lastVisit ? date(c.lastVisit) : NA}</td>
                <td className="py-2 px-3">
                  {c.type ? (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.type === "Returning" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-sky-50 text-sky-800 border-sky-200"}`}>{c.type}</span>
                  ) : (
                    NA
                  )}
                </td>
                <td className="py-2 px-3 text-stone-700">{c.segment || "—"}</td>
              </tr>
            ))}
            {data && rows.length === 0 && (
              <tr>
                <td colSpan={10} className="py-6 px-3 text-center text-stone-500">
                  {data.customers === 0 ? "No customers match these filters." : `No customer has ${RANK_BY.find(([v]) => v === data.rankBy)[1].toLowerCase()} data: ${data.excludedReason}.`}
                </td>
              </tr>
            )}
            {!data && !error && (
              <tr>
                <td colSpan={10} className="py-6 px-3 text-center text-stone-500">Loading leaderboard…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pg && pg.pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-[#E0D8CE] bg-white disabled:opacity-40 cursor-pointer">Previous</button>
          <span className="text-stone-600">Page {pg.page} of {pg.pages}</span>
          <button type="button" disabled={page >= pg.pages || loading} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-[#E0D8CE] bg-white disabled:opacity-40 cursor-pointer">Next</button>
        </div>
      )}
    </section>
  );
}
