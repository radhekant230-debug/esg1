import React, { useState, useEffect } from "react";
import api from "../../utils/axios";
import AdminBusinessModal from "./AdminBusinessModal";
import ExcelUploadModal from "./ExcelUploadModal";
import BusinessDetailModal from "./BusinessDetailModal";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  FaBuilding,
  FaPlus,
  FaFileExcel,
  FaDownload,
  FaEdit,
  FaTrash,
  FaEye,
  FaFilter,
  FaSearch,
  FaSpinner,
  FaChartLine,
  FaCalendarAlt,
  FaHistory,
  FaShieldAlt,
} from "react-icons/fa";

export default function AdminStateSalesView() {
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [managers, setManagers] = useState([]);
  const [importHistory, setImportHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "businesses" | "history"

  // Filters
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedMonth, setSelectedMonth] = useState("10");
  const [selectedState, setSelectedState] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [businessModalOpen, setBusinessModalOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedMonth, selectedState]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dashRes, bizRes, mgrRes, histRes] = await Promise.allSettled([
        api.get("/sales/dashboard", {
          params: {
            year: selectedYear,
            month: selectedMonth,
            state: selectedState !== "All" ? selectedState : undefined,
          },
        }),
        api.get("/sales/businesses", {
          params: {
            state: selectedState !== "All" ? selectedState : undefined,
          },
        }),
        api.get("/portal/managers"),
        api.get("/sales/import-history"),
      ]);

      if (dashRes.status === "fulfilled") setDashboardData(dashRes.value.data);
      if (bizRes.status === "fulfilled") setBusinesses(bizRes.value.data || []);
      if (mgrRes.status === "fulfilled") setManagers(mgrRes.value.data?.managers || []);
      if (histRes.status === "fulfilled") setImportHistory(histRes.value.data || []);
    } catch (err) {
      console.error("Error loading admin sales data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBusiness = async (biz) => {
    if (!window.confirm(`Are you sure you want to delete "${biz.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/sales/businesses/${biz._id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete business.");
    }
  };

  const handleExport = async () => {
    try {
      const params = { year: selectedYear, month: selectedMonth };
      if (selectedState !== "All") params.state = selectedState;
      const res = await api.get("/sales/export", { params, responseType: "blob" });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ESG_Consolidated_Sales_Report_${selectedYear}_${selectedMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export sales report.");
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
      alert("Failed to download template.");
    }
  };

  const summary = dashboardData?.summary || {};
  const cityBreakdown = dashboardData?.cityBreakdown || [];

  const filteredBizList = businesses.filter((b) => {
    if (selectedState !== "All" && b.state !== selectedState) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        b.name?.toLowerCase().includes(q) ||
        b.city?.toLowerCase().includes(q) ||
        b.code?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-[#18181B] text-white p-6 sm:p-8 rounded-2xl shadow-lg border border-[#27272A] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-amber-400/20 text-amber-300 border border-amber-400/40">
              EXECUTIVE CONSOLIDATED VIEW
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-serif text-white">
            State-Wise Sales Management & Ingestion
          </h1>
          <p className="text-xs sm:text-sm text-stone-400 mt-1">
            Consolidated overview across all states (Jharkhand, Rajasthan, Assam, Odisha) with Excel bulk import.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setEditingBusiness(null);
              setBusinessModalOpen(true);
            }}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
          >
            <FaPlus /> Add Business
          </button>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
          >
            <FaFileExcel /> Upload Sales Excel
          </button>
          <button
            onClick={handleExport}
            className="px-3.5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold rounded-xl border border-stone-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <FaDownload /> Export All
          </button>
          <button
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold rounded-xl border border-stone-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <FaDownload /> Template
          </button>
        </div>
      </div>

      {/* FILTER & TAB NAVIGATION */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === "overview"
                ? "bg-gray-900 text-white shadow-xs"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Consolidated Analytics
          </button>
          <button
            onClick={() => setActiveTab("businesses")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === "businesses"
                ? "bg-gray-900 text-white shadow-xs"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Manage Businesses ({businesses.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === "history"
                ? "bg-gray-900 text-white shadow-xs"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Import Audit Logs ({importHistory.length})
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-gray-500">State:</span>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-800 rounded-lg px-2.5 py-1.5 font-medium cursor-pointer"
            >
              <option value="All">All States</option>
              <option value="Jharkhand">Jharkhand</option>
              <option value="Rajasthan">Rajasthan</option>
              <option value="Assam">Assam</option>
              <option value="Odisha">Odisha</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-gray-500">Period:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-800 rounded-lg px-2.5 py-1.5 font-medium cursor-pointer"
            >
              <option value="9">September 2026</option>
              <option value="10">October 2026</option>
              <option value="11">November 2026</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <FaSpinner className="animate-spin text-3xl text-gray-600 mx-auto mb-3" />
          <p className="text-xs text-gray-500">Loading consolidated data...</p>
        </div>
      ) : activeTab === "overview" ? (
        <div className="space-y-6">
          {/* KPI CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Total Monthly Sales
              </span>
              <p className="text-2xl font-black text-gray-900 mt-1">
                ₹{Number(summary.currentMonthSales || 0).toLocaleString()}
              </p>
              <p className="text-xs text-emerald-600 font-semibold mt-1">
                {summary.salesGrowthPercentage !== null ? `${summary.salesGrowthPercentage}% MoM Growth` : "Active"}
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Monthly Target Total
              </span>
              <p className="text-2xl font-black text-gray-900 mt-1">
                ₹{Number(summary.targetTotal || 0).toLocaleString()}
              </p>
              <p className="text-xs text-blue-600 font-semibold mt-1">
                {summary.achievementRate || 0}% overall quota achieved
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Total Businesses
              </span>
              <p className="text-2xl font-black text-gray-900 mt-1">
                {summary.totalBusinesses || businesses.length}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {summary.totalHotels || 0} Hotels • {summary.totalRestaurants || 0} Restaurants
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Monthly Orders
              </span>
              <p className="text-2xl font-black text-gray-900 mt-1">
                {summary.currentMonthOrders || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">Completed transactions</p>
            </div>
          </div>

          {/* CITY-WISE SALES SUMMARY */}
          {cityBreakdown.length > 0 && (
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-xs">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
                City-Wise Sales & Target Summary
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cityBreakdown} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="city" stroke="#888888" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip formatter={(val) => `₹${Number(val).toLocaleString()}`} />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                    <Bar dataKey="sales" name="Actual Sales" fill="#D97706" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="target" name="Target" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === "businesses" ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
          {/* SEARCH & ADD BAR */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <div className="relative w-72">
              <FaSearch className="absolute left-3 top-3 text-gray-400 text-xs" />
              <input
                type="text"
                placeholder="Search business, code, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800"
              />
            </div>
            <button
              onClick={() => {
                setEditingBusiness(null);
                setBusinessModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-black transition flex items-center gap-1.5 cursor-pointer"
            >
              <FaPlus /> New Business
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 uppercase font-bold border-b border-gray-100">
                <tr>
                  <th className="py-3 px-4">Business</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">State</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4">Assigned Manager</th>
                  <th className="py-3 px-4 text-right">Target (INR)</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBizList.map((biz) => (
                  <tr key={biz._id} className="hover:bg-gray-50/70">
                    <td className="py-3 px-4">
                      <p className="font-bold text-gray-900">{biz.name}</p>
                      <span className="font-mono text-[11px] text-gray-400">{biz.code}</span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-700">{biz.category}</td>
                    <td className="py-3 px-4 text-gray-600">{biz.state}</td>
                    <td className="py-3 px-4 text-gray-900 font-medium">{biz.city}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {biz.assignedManager?.name || "Auto by City"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-gray-800">
                      ₹{Number(biz.monthlyTarget || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedBusinessId(biz._id);
                            setDetailModalOpen(true);
                          }}
                          className="p-1.5 text-gray-600 hover:text-black rounded hover:bg-gray-100"
                          title="View Details"
                        >
                          <FaEye />
                        </button>
                        <button
                          onClick={() => {
                            setEditingBusiness(biz);
                            setBusinessModalOpen(true);
                          }}
                          className="p-1.5 text-amber-600 hover:text-amber-800 rounded hover:bg-amber-50"
                          title="Edit"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDeleteBusiness(biz)}
                          className="p-1.5 text-red-500 hover:text-red-700 rounded hover:bg-red-50"
                          title="Delete"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* IMPORT AUDIT LOGS */
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-bold text-sm text-gray-900">Excel Upload Audit Trail</h3>
            <p className="text-xs text-gray-500">History of Excel/CSV batch ingestions and error logs</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 uppercase font-bold border-b border-gray-100">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Uploader</th>
                  <th className="py-3 px-4 text-right">Rows</th>
                  <th className="py-3 px-4 text-right">Successful</th>
                  <th className="py-3 px-4 text-right">Updated</th>
                  <th className="py-3 px-4 text-right">Failed</th>
                  <th className="py-3 px-4 text-right">Total Revenue</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {importHistory.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-gray-400">
                      No import jobs logged yet.
                    </td>
                  </tr>
                ) : (
                  importHistory.map((job) => (
                    <tr key={job._id} className="hover:bg-gray-50/70">
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(job.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-900">{job.filename}</td>
                      <td className="py-3 px-4 text-gray-700">{job.uploaderName || job.uploadedBy?.name}</td>
                      <td className="py-3 px-4 text-right font-mono text-gray-700">{job.totalRows}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        {job.successCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-blue-600">{job.updatedCount}</td>
                      <td className="py-3 px-4 text-right font-mono text-red-500">{job.failedCount}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                        ₹{Number(job.totalRevenue || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                            job.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : job.status === "partial"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS */}
      <AdminBusinessModal
        isOpen={businessModalOpen}
        onClose={() => {
          setBusinessModalOpen(false);
          setEditingBusiness(null);
        }}
        onSuccess={fetchData}
        initialBusiness={editingBusiness}
        managers={managers}
      />

      <ExcelUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={fetchData}
      />

      <BusinessDetailModal
        businessId={selectedBusinessId}
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedBusinessId(null);
        }}
        onRefresh={fetchData}
      />
    </div>
  );
}
