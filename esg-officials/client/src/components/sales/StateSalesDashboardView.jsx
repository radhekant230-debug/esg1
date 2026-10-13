import React, { useState, useEffect, useContext } from "react";
import api from "../../utils/axios";
import { AuthContext } from "../../context/AuthContext";
import ExcelUploadModal from "./ExcelUploadModal";
import BusinessDetailModal from "./BusinessDetailModal";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  FaMapMarkerAlt,
  FaBuilding,
  FaUtensils,
  FaConciergeBell,
  FaChartLine,
  FaArrowUp,
  FaArrowDown,
  FaBullseye,
  FaFileExcel,
  FaDownload,
  FaSearch,
  FaFilter,
  FaEye,
  FaCalendarAlt,
  FaSpinner,
  FaExclamationTriangle,
  FaCheckCircle,
  FaSyncAlt,
  FaShieldAlt,
} from "react-icons/fa";

export default function StateSalesDashboardView() {
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState("");

  // Filters
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedMonth, setSelectedMonth] = useState("10"); // Default October 2026 matching sample data
  const [selectedCity, setSelectedCity] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, [selectedYear, selectedMonth]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/sales/dashboard", {
        params: { year: selectedYear, month: selectedMonth },
      });
      setDashboardData(res.data);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(err.response?.data?.message || "Failed to load state-wise sales dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get("/sales/template", { responseType: "blob" });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Sales_Upload_Template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download template error:", err);
      alert("Failed to download template.");
    }
  };

  const handleExportReport = async () => {
    try {
      const params = { year: selectedYear, month: selectedMonth };
      if (selectedCity !== "All") params.city = selectedCity;
      const res = await api.get("/sales/export", {
        params,
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ESG_Sales_Report_${selectedYear}_${selectedMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export report error:", err);
      alert("Failed to export sales report.");
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="py-24 text-center">
        <FaSpinner className="animate-spin text-4xl text-amber-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-800">Loading State Sales Dashboard...</h3>
        <p className="text-xs text-gray-500 mt-1">Retrieving assigned locations, hotels, and monthly sales data</p>
      </div>
    );
  }

  const managerInfo = dashboardData?.managerInfo || {};
  const selectedPeriod = dashboardData?.selectedPeriod || {};
  const summary = dashboardData?.summary || {};
  const businessPerformance = dashboardData?.businessPerformance || [];
  const topPerforming = dashboardData?.topPerforming || [];
  const lowestPerforming = dashboardData?.lowestPerforming || [];
  const trendData = dashboardData?.trendData || [];
  const recentRecords = dashboardData?.recentRecords || [];

  // Filter businesses by city, category, and search query
  const filteredBusinesses = businessPerformance.filter((item) => {
    if (selectedCity !== "All" && item.city !== selectedCity) return false;
    if (selectedCategory !== "All" && item.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (item.name || "").toLowerCase().includes(q);
      const matchCode = (item.code || "").toLowerCase().includes(q);
      if (!matchName && !matchCode) return false;
    }
    return true;
  });

  // Unique cities list for the filter
  const availableCities = managerInfo.assignedCities || [];

  // Format currency
  const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString()}`;

  return (
    <div className="space-y-8">
      {/* 1. STATE-WISE MANAGER HEADER BANNER */}
      <div className="bg-gradient-to-r from-[#141312] via-[#1C1A18] to-[#141312] text-[#F3EFEA] rounded-2xl p-6 sm:p-8 shadow-xl border border-[#2D2A26] relative overflow-hidden">
        {/* Subtle accent glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 shadow-xs">
                <FaShieldAlt className="text-xs" />
                STATE-WISE SALES MANAGER PORTAL
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase bg-stone-800 text-stone-300 border border-stone-700">
                {managerInfo.primaryState} Region
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight font-serif text-white">
              {managerInfo.primaryCity} Manager Dashboard
            </h1>

            <p className="text-xs sm:text-sm text-stone-400 mt-1.5 flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1 text-stone-300">
                <FaMapMarkerAlt className="text-amber-500 text-xs" />
                State: <strong className="text-white ml-1">{managerInfo.primaryState}</strong>
              </span>
              <span className="text-stone-600">•</span>
              <span className="text-stone-300">
                Assigned Cities:{" "}
                <strong className="text-white ml-1">
                  {managerInfo.assignedCities?.join(", ") || managerInfo.primaryCity}
                </strong>
              </span>
              <span className="text-stone-600">•</span>
              <span className="text-stone-300">
                Manager: <strong className="text-white ml-1">{managerInfo.name}</strong>
              </span>
            </p>
          </div>

          {/* ACTION BUTTONS: UPLOAD EXCEL, TEMPLATE, EXPORT */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setUploadModalOpen(true)}
              className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold text-xs sm:text-sm rounded-xl shadow-lg hover:shadow-amber-500/20 transition flex items-center gap-2.5 cursor-pointer"
              title="Upload monthly sales spreadsheet"
            >
              <FaFileExcel className="text-base text-black" />
              Upload Sales Excel
            </button>

            <button
              onClick={handleDownloadTemplate}
              className="px-4 py-3 bg-stone-800/90 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition flex items-center gap-2 cursor-pointer"
              title="Download standard Excel template with sample rows"
            >
              <FaDownload className="text-xs text-stone-400" />
              Template
            </button>

            <button
              onClick={handleExportReport}
              className="px-4 py-3 bg-stone-800/90 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition flex items-center gap-2 cursor-pointer"
              title="Export current monthly sales report to Excel"
            >
              <FaDownload className="text-xs text-stone-400" />
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* 2. DATE SELECTOR & PERIOD COMPARISON CONTROLS */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg flex-shrink-0">
            <FaCalendarAlt />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              Active Period: {selectedPeriod.monthName}
            </h3>
            <p className="text-xs text-gray-500">
              Comparing against previous period: {selectedPeriod.prevMonthName}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Year selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-600">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-lg px-3 py-2 font-semibold focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          {/* Month selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-600">Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-lg px-3 py-2 font-semibold focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>

          <button
            onClick={fetchDashboard}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition cursor-pointer"
            title="Refresh live data"
          >
            <FaSyncAlt className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* 3. CORE SUMMARY KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* CURRENT MONTH SALES & GROWTH */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Current Month Sales
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
              <FaChartLine />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-gray-900">
            {formatCurrency(summary.currentMonthSales)}
          </h3>

          <div className="mt-2 flex items-center gap-2">
            {summary.salesGrowthPercentage !== null ? (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                  summary.salesGrowthPercentage >= 0
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {summary.salesGrowthPercentage >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                {Math.abs(summary.salesGrowthPercentage)}% MoM
              </span>
            ) : (
              <span className="text-xs text-gray-400 font-medium">Initial Period</span>
            )}
            <span className="text-xs text-gray-500">{summary.currentMonthOrders || 0} orders</span>
          </div>
        </div>

        {/* PREVIOUS MONTH SALES */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Previous Month Sales
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
              <FaCalendarAlt />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-gray-900">
            {formatCurrency(summary.previousMonthSales)}
          </h3>
          <p className="text-xs text-gray-500 mt-2">
            {selectedPeriod.prevMonthName} baseline ({summary.previousMonthOrders || 0} orders)
          </p>
        </div>

        {/* MONTHLY TARGET & ACHIEVEMENT */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Target Achievement
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg">
              <FaBullseye />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-black text-gray-900">
              {summary.achievementRate || 0}%
            </h3>
            <span className="text-xs text-gray-500">
              Target: {formatCurrency(summary.targetTotal)}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-2 mt-2.5 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                (summary.achievementRate || 0) >= 100
                  ? "bg-emerald-500"
                  : (summary.achievementRate || 0) >= 80
                  ? "bg-amber-500"
                  : "bg-blue-500"
              }`}
              style={{ width: `${Math.min(summary.achievementRate || 0, 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1.5 flex justify-between">
            <span>Pending: {formatCurrency(summary.pendingTarget)}</span>
            {(summary.achievementRate || 0) >= 100 && (
              <span className="text-emerald-600 font-bold">Target Met!</span>
            )}
          </p>
        </div>

        {/* ASSIGNED BUSINESSES BREAKDOWN */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Assigned Businesses
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg">
              <FaBuilding />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-gray-900">
            {summary.totalBusinesses || 0}
          </h3>
          <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-gray-600">
            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
              {summary.totalHotels || 0} Hotels
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700">
              {summary.totalRestaurants || 0} Restaurants
            </span>
            {summary.totalServices > 0 && (
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                {summary.totalServices} Services
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. VISUALIZATIONS SECTION (RECHARTS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* CHART 1: MONTHLY SALES TREND LINE CHART */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Monthly Sales Revenue Trend</h3>
              <p className="text-xs text-gray-500">Historical performance across assigned businesses</p>
            </div>
            <span className="text-xs font-mono px-2 py-1 bg-gray-100 rounded text-gray-600">
              Revenue (INR)
            </span>
          </div>

          <div className="h-72 w-full">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#888888" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#888888"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value) => [`₹${Number(value).toLocaleString()}`, "Sales"]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#D97706"
                    strokeWidth={3}
                    dot={{ r: 5, fill: "#D97706" }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                No historical trend data available.
              </div>
            )}
          </div>
        </div>

        {/* CHART 2: BUSINESS-WISE SALES VS TARGET BAR CHART */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Sales vs Target by Business</h3>
              <p className="text-xs text-gray-500">{selectedPeriod.monthName} target comparison</p>
            </div>
            <span className="text-xs font-mono px-2 py-1 bg-gray-100 rounded text-gray-600">
              Actual vs Target
            </span>
          </div>

          <div className="h-72 w-full">
            {filteredBusinesses.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredBusinesses.slice(0, 6)}
                  margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={10}
                    tickLine={false}
                    interval={0}
                    tickFormatter={(val) => (val.length > 12 ? `${val.substring(0, 10)}...` : val)}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val) => `₹${Number(val).toLocaleString()}`}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Bar dataKey="sales" name="Actual Sales" fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="target" name="Monthly Target" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                No business data matching current filter.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. TOP PERFORMING & LOWEST PERFORMING CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* TOP PERFORMERS */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <FaCheckCircle className="text-emerald-600" />
            Top Performing Hotels & Restaurants
          </h4>
          {topPerforming.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No sales data recorded yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {topPerforming.map((biz, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-gray-900">{biz.name}</h5>
                      <span className="text-[11px] text-gray-500">
                        {biz.city} • {biz.category}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono font-bold text-emerald-700">
                      {formatCurrency(biz.sales)}
                    </p>
                    <span className="text-[11px] font-semibold text-emerald-600">
                      {biz.achievementRate}% achieved
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LOWEST PERFORMERS / ATTENTION REQUIRED */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <FaExclamationTriangle className="text-amber-500" />
            Businesses Requiring Attention
          </h4>
          {lowestPerforming.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">All businesses are meeting expectations.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {lowestPerforming.map((biz, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center">
                      !
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-gray-900">{biz.name}</h5>
                      <span className="text-[11px] text-gray-500">
                        {biz.city} • {biz.category}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono font-bold text-gray-800">
                      {formatCurrency(biz.sales)}
                    </p>
                    <span className="text-[11px] font-semibold text-amber-600">
                      {biz.achievementRate}% of {formatCurrency(biz.target)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6. HOTEL, RESTAURANT & SERVICE MANAGEMENT DIRECTORY */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* DIRECTORY HEADER & FILTERS */}
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FaBuilding className="text-amber-600" />
              Assigned Hotels, Restaurants & Service Businesses
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Select any business to view complete sales history, monthly targets, and records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-3 text-gray-400 text-xs" />
              <input
                type="text"
                placeholder="Search business..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500 w-44"
              />
            </div>

            {/* City Filter */}
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg px-3 py-1.5 font-medium focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="All">All Cities ({availableCities.length})</option>
              {availableCities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg px-3 py-1.5 font-medium focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="Hotel">Hotels</option>
              <option value="Restaurant">Restaurants</option>
              <option value="Service">Services</option>
            </select>
          </div>
        </div>

        {/* BUSINESS DIRECTORY TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase font-bold border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">Business</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4 text-right">Monthly Target</th>
                <th className="py-3 px-4 text-right">{selectedPeriod.monthName} Sales</th>
                <th className="py-3 px-4 text-right">Orders</th>
                <th className="py-3 px-4 text-right">Achievement</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBusinesses.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-gray-400">
                    No businesses match your search filter in {managerInfo.primaryState}.
                  </td>
                </tr>
              ) : (
                filteredBusinesses.map((biz) => {
                  const rate = biz.achievementRate || 0;
                  return (
                    <tr key={biz._id} className="hover:bg-gray-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{biz.name}</div>
                        <span className="font-mono text-[11px] text-gray-400">{biz.code}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            biz.category === "Hotel"
                              ? "bg-indigo-100 text-indigo-800"
                              : biz.category === "Restaurant"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {biz.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-700 font-medium">
                        {biz.city}, {biz.state}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-600">
                        {formatCurrency(biz.target)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        {formatCurrency(biz.sales)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-700">
                        {biz.orders || 0}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            rate >= 100
                              ? "bg-emerald-100 text-emerald-800"
                              : rate >= 80
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {rate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedBusinessId(biz._id);
                            setDetailModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                          title="View complete business profile & sales history"
                        >
                          <FaEye className="text-xs" />
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. RECENT SALES ACTIVITY FEED */}
      {recentRecords.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FaCalendarAlt className="text-gray-600" />
            Recent Sales Records in {managerInfo.primaryState}
          </h4>

          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 uppercase font-bold border-b border-gray-100">
                <tr>
                  <th className="py-2.5 px-3">Month</th>
                  <th className="py-2.5 px-3">Business</th>
                  <th className="py-2.5 px-3">City</th>
                  <th className="py-2.5 px-3 text-right">Total Sales</th>
                  <th className="py-2.5 px-3 text-right">Target</th>
                  <th className="py-2.5 px-3 text-right">Achievement</th>
                  <th className="py-2.5 px-3">Remarks</th>
                  <th className="py-2.5 px-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentRecords.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50/70">
                    <td className="py-2.5 px-3 font-semibold text-gray-900">{r.monthName}</td>
                    <td className="py-2.5 px-3 font-bold text-gray-900">{r.businessName}</td>
                    <td className="py-2.5 px-3 text-gray-600">{r.city}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                      {formatCurrency(r.totalSales)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-600">
                      {formatCurrency(r.target)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          (r.achievementRate || 0) >= 100
                            ? "bg-green-100 text-green-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {r.achievementRate}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 truncate max-w-[120px]">
                      {r.remarks || "-"}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-gray-500">
                      {r.source === "excel_upload" ? "Excel Import" : "Manual"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS */}
      <ExcelUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          fetchDashboard();
        }}
        userScope={managerInfo}
      />

      <BusinessDetailModal
        businessId={selectedBusinessId}
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedBusinessId(null);
        }}
        onRefresh={fetchDashboard}
      />
    </div>
  );
}
