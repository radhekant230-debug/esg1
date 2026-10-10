import React, { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../utils/axios";
import { AuthContext } from "../../context/AuthContext";
import {
  FaUsers,
  FaDollarSign,
  FaBullhorn,
  FaChartLine,
  FaUserFriends,
  FaCalendarCheck,
  FaShareAlt,
  FaCheckCircle,
  FaFileInvoiceDollar,
  FaFilter,
  FaSyncAlt,
  FaSearch,
  FaArrowRight,
  FaExternalLinkAlt,
  FaPlus,
  FaDatabase,
} from "react-icons/fa";

export default function AdminOverview() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  // Filters state
  const [businessType, setBusinessType] = useState("all");
  const [month, setMonth] = useState("");
  const [quarter, setQuarter] = useState("all");
  const [selectedClientId, setSelectedClientId] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch overview from backend
  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError("");

      const params = {};
      if (businessType !== "all") params.businessType = businessType;
      if (month) params.month = month;
      if (quarter !== "all") params.quarter = quarter;
      if (selectedClientId !== "all") params.clientId = selectedClientId;

      const res = await api.get("/admin/overview", { params });
      setData(res.data);
    } catch (err) {
      console.error("Admin Overview Fetch Error:", err);
      setError("Failed to load overview data from MongoDB. Please check connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();

    // Listen for custom event from universal data modal
    const handleUpdate = () => fetchOverview();
    window.addEventListener("esg-admin-data-updated", handleUpdate);
    return () => window.removeEventListener("esg-admin-data-updated", handleUpdate);
  }, [businessType, month, quarter, selectedClientId]);

  // Format currency in Indian Rupees
  const formatINR = (val) => {
    if (val === undefined || val === null) return "₹0";
    return `₹${Number(val).toLocaleString("en-IN")}`;
  };

  const summary = data?.summary || {};
  const clientPerformance = data?.clientPerformance || [];

  // Filter clients table by search term
  const filteredClients = clientPerformance.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.companyName.toLowerCase().includes(term) ||
      c.clientId.toLowerCase().includes(term) ||
      c.businessType.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Executive Welcome & Controls */}
      <div className="bg-[#1A1918] text-[#F5F0E8] rounded-2xl p-6 sm:p-8 border border-[#33312E] shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-amber-400/20 text-amber-300 border border-amber-400/60 font-mono shadow-[0_0_10px_rgba(245,158,11,0.25)]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              ADMIN CONSOLE
            </span>
            <span className="text-stone-400 text-xs font-mono uppercase tracking-wider font-semibold">
              Live Agency Overview
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
            Admin Overview — All Clients
          </h1>

          <p className="text-stone-300 text-sm max-w-2xl mt-1">
            Aggregated business performance, verified sales, marketing ROI, and operations across all onboarded accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={fetchOverview}
            disabled={loading}
            className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition"
            title="Refresh database records"
          >
            <FaSyncAlt className={loading ? "animate-spin text-amber-400" : ""} />
          </button>
          <button
            onClick={() => navigate("/admin/clients?action=add")}
            className="px-4 py-2.5 rounded-xl bg-[#C5A880] hover:bg-[#B39369] text-stone-950 font-bold text-xs transition shadow-sm flex items-center gap-2"
          >
            <FaPlus />
            + Add New Client
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-stone-700 font-mono uppercase tracking-wider">
          <FaFilter className="text-[#C5A880]" />
          Filters:
        </div>

        <div className="flex flex-wrap items-center gap-3 flex-1 justify-end">
          {/* Business Type Filter */}
          <select
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-medium bg-stone-50 text-stone-800 outline-none focus:border-[#C5A880]"
          >
            <option value="all">All Business Types</option>
            <option value="cafe">Café</option>
            <option value="restaurant">Restaurant</option>
            <option value="clothing">Clothing Shop</option>
            <option value="jewellery">Jewellery Shop</option>
            <option value="retail">Retail</option>
            <option value="other">Other</option>
          </select>

          {/* Month Selector */}
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="Select Month"
            className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-medium bg-stone-50 text-stone-800 outline-none focus:border-[#C5A880]"
          />

          {/* Reset Filters */}
          {(businessType !== "all" || month || quarter !== "all" || selectedClientId !== "all") && (
            <button
              onClick={() => {
                setBusinessType("all");
                setMonth("");
                setQuarter("all");
                setSelectedClientId("all");
              }}
              className="text-xs text-[#8B6E3F] hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Executive Summary Cards Grid (All Required Metrics from Section 2) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* 1. Clients Count */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs hover:border-[#C5A880]/50 transition">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold">Total Clients</span>
            <FaUsers className="text-amber-600 text-sm" />
          </div>
          <div className="text-2xl font-bold text-stone-900 font-serif">
            {summary.totalClients ?? 0}
          </div>
          <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-1.5">
            <span className="text-emerald-700 font-semibold">{summary.activeClients ?? 0} Active</span>
            <span>•</span>
            <span className="text-stone-400">{summary.inactiveClients ?? 0} Inactive</span>
          </div>
        </div>

        {/* 2. Total Gross Sales */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs hover:border-[#C5A880]/50 transition">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold">Total Gross Sales</span>
            <FaDollarSign className="text-amber-600 text-sm" />
          </div>
          <div className="text-2xl font-bold text-stone-900 font-serif">
            {formatINR(summary.totalSales)}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">Across all recorded client channels</div>
        </div>

        {/* 3. Total Net Revenue */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs hover:border-[#C5A880]/50 transition">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold">Net Revenue</span>
            <FaChartLine className="text-emerald-600 text-sm" />
          </div>
          <div className="text-2xl font-bold text-emerald-800 font-serif">
            {formatINR(summary.totalRevenue)}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">Gross sales less discounts & refunds</div>
        </div>

        {/* 4. Total Advertising Spend */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs hover:border-[#C5A880]/50 transition">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold">Ad Spend</span>
            <FaBullhorn className="text-amber-600 text-sm" />
          </div>
          <div className="text-2xl font-bold text-stone-900 font-serif">
            {formatINR(summary.totalAdSpend)}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">Meta Ads & Google Ads campaigns</div>
        </div>

        {/* 5. Ad Attributed Revenue */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs hover:border-[#C5A880]/50 transition">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold">Attributed Revenue</span>
            <FaDollarSign className="text-emerald-600 text-sm" />
          </div>
          <div className="text-2xl font-bold text-stone-900 font-serif">
            {formatINR(summary.adAttributedRevenue)}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">Directly attributed to paid ads</div>
        </div>

        {/* 6. Overall ROAS */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs hover:border-[#C5A880]/50 transition">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold">Overall ROAS</span>
            <span className="text-xs font-mono font-bold text-amber-600">x:1</span>
          </div>
          <div className="text-2xl font-bold text-stone-900 font-serif">
            {summary.overallRoas ? `${summary.overallRoas}x` : "0.0x"}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">Attributed Revenue / Media Spend</div>
        </div>

        {/* 7. Leads & Enquiries */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs hover:border-[#C5A880]/50 transition">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold">Leads & Enquiries</span>
            <FaUserFriends className="text-amber-600 text-sm" />
          </div>
          <div className="text-2xl font-bold text-stone-900 font-serif">
            {summary.totalLeads ?? 0}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            {summary.qualifiedLeads ?? 0} Qualified • {summary.convertedLeads ?? 0} Converted
          </div>
        </div>

        {/* 8. Total Orders & Reservations */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs hover:border-[#C5A880]/50 transition">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold">Orders & Bookings</span>
            <FaCalendarCheck className="text-amber-600 text-sm" />
          </div>
          <div className="text-2xl font-bold text-stone-900 font-serif">
            {summary.totalOrders ?? 0}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">Dine-in, takeaway, and direct orders</div>
        </div>

        {/* 9. Engagement Rate */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs hover:border-[#C5A880]/50 transition">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold">Social Engagement</span>
            <FaShareAlt className="text-purple-600 text-sm" />
          </div>
          <div className="text-2xl font-bold text-stone-900 font-serif">
            {summary.avgEngagementRate ? `${summary.avgEngagementRate}%` : "0%"}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">Average across organic accounts</div>
        </div>

        {/* 10. Pending Approvals */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs hover:border-[#C5A880]/50 transition">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold">Pending Approvals</span>
            <FaCheckCircle className="text-amber-600 text-sm" />
          </div>
          <div className="text-2xl font-bold text-stone-900 font-serif">
            {summary.pendingApprovals ?? 0}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">Awaiting client creative review</div>
        </div>

        {/* 11. Agency Retainers */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs hover:border-[#C5A880]/50 transition">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold">Monthly Retainers</span>
            <FaFileInvoiceDollar className="text-amber-600 text-sm" />
          </div>
          <div className="text-2xl font-bold text-stone-900 font-serif">
            {formatINR(summary.monthlyAgencyRetainers)}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">Contracted agency consulting revenue</div>
        </div>

        {/* 12. Outstanding Invoices */}
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs hover:border-[#C5A880]/50 transition">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold">Outstanding Invoices</span>
            <FaFileInvoiceDollar className="text-red-500 text-sm" />
          </div>
          <div className="text-2xl font-bold text-stone-900 font-serif">
            {formatINR(summary.outstandingInvoices)}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">Unpaid or overdue client invoices</div>
        </div>
      </div>

      {/* Client Performance Table (Exact Specifications from Section 2) */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-serif font-bold text-stone-900">
              Client Performance Breakdown
            </h2>
            <p className="text-xs text-stone-500 font-mono mt-0.5">
              Live database records aggregated per client for selected filter
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <FaSearch className="absolute left-3 top-2.5 text-stone-400 text-xs" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-stone-300 text-xs outline-none focus:border-[#C5A880]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">Client Name</th>
                <th className="py-3 px-3 font-bold">Business Type</th>
                <th className="py-3 px-3 font-bold text-right">Total Sales</th>
                <th className="py-3 px-3 font-bold text-right">Revenue</th>
                <th className="py-3 px-3 font-bold text-right">Ad Spend</th>
                <th className="py-3 px-3 font-bold text-center">Leads</th>
                <th className="py-3 px-3 font-bold text-center">Orders</th>
                <th className="py-3 px-3 font-bold text-center">ROAS</th>
                <th className="py-3 px-3 font-bold text-center">Reporting Period</th>
                <th className="py-3 px-3 font-bold text-center">Status</th>
                <th className="py-3 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan="11" className="py-8 text-center text-stone-400 font-medium">
                    {loading ? "Loading clients from database..." : "No clients match the selected filter."}
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-stone-50/70 transition group">
                    {/* Client Name */}
                    <td className="py-3 px-4">
                      <div>
                        <Link
                          to={`/admin/clients/${client.id}`}
                          className="font-bold text-stone-900 hover:text-[#8B6E3F] transition text-sm"
                        >
                          {client.companyName}
                        </Link>
                        <div className="text-[10px] font-mono text-stone-400">
                          {client.clientId} • {client.name}
                        </div>
                      </div>
                    </td>

                    {/* Business Type */}
                    <td className="py-3 px-3 capitalize">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-stone-100 text-stone-700 border border-stone-200">
                        {client.businessType?.replace("_", " ")}
                      </span>
                    </td>

                    {/* Total Sales */}
                    <td className="py-3 px-3 text-right font-mono font-semibold text-stone-800">
                      {client.hasSalesData ? formatINR(client.totalSales) : (
                        <span className="text-stone-300 font-normal">Data not recorded</span>
                      )}
                    </td>

                    {/* Revenue */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800">
                      {client.hasSalesData ? formatINR(client.revenue) : (
                        <span className="text-stone-300 font-normal">Data not recorded</span>
                      )}
                    </td>

                    {/* Ad Spend */}
                    <td className="py-3 px-3 text-right font-mono font-semibold text-stone-800">
                      {client.hasCampaignData ? formatINR(client.adSpend) : (
                        <span className="text-stone-300 font-normal">₹0</span>
                      )}
                    </td>

                    {/* Leads */}
                    <td className="py-3 px-3 text-center font-mono font-semibold text-stone-700">
                      {client.leads}
                    </td>

                    {/* Orders */}
                    <td className="py-3 px-3 text-center font-mono font-semibold text-stone-700">
                      {client.orders}
                    </td>

                    {/* ROAS */}
                    <td className="py-3 px-3 text-center font-mono">
                      {client.roas > 0 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {client.roas}x
                        </span>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>

                    {/* Reporting Period */}
                    <td className="py-3 px-3 text-center text-stone-600 font-mono text-[11px]">
                      {client.reportingPeriod}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                          client.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-stone-100 text-stone-500 border border-stone-200"
                        }`}
                      >
                        {client.status}
                      </span>
                    </td>

                    {/* View Details Action */}
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/admin/clients/${client.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-stone-900 hover:bg-[#8B6E3F] text-white text-[11px] font-semibold transition shadow-xs"
                      >
                        <span>View Details</span>
                        <FaArrowRight className="text-[10px]" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
