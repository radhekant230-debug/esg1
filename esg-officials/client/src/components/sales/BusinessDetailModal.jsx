import React, { useState, useEffect } from "react";
import api from "../../utils/axios";
import {
  FaTimes,
  FaBuilding,
  FaMapMarkerAlt,
  FaUserTie,
  FaBullseye,
  FaChartLine,
  FaReceipt,
  FaSpinner,
  FaCalendarAlt,
  FaHistory,
  FaStickyNote,
  FaPlus,
  FaCheckCircle,
} from "react-icons/fa";

export default function BusinessDetailModal({ businessId, isOpen, onClose, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && businessId) {
      fetchBusinessDetail();
    } else {
      setData(null);
    }
  }, [isOpen, businessId]);

  const fetchBusinessDetail = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/sales/businesses/${businessId}`);
      setData(res.data);
    } catch (err) {
      console.error("Error loading business detail:", err);
      setError(err.response?.data?.message || "Failed to load business details.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const business = data?.business;
  const records = data?.salesRecords || [];
  const metrics = data?.metrics || {};

  const getCategoryBadge = (cat) => {
    switch (cat) {
      case "Hotel":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "Restaurant":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Service":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-100 flex flex-col max-h-[92vh]">
        {/* HEADER */}
        <div className="bg-[#18181B] text-white p-5 sm:p-6 flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-2xl flex-shrink-0">
              <FaBuilding />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-xl font-bold tracking-tight">
                  {business?.name || "Business Details"}
                </h2>
                {business && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getCategoryBadge(
                      business.category
                    )}`}
                  >
                    {business.category}
                  </span>
                )}
                {business?.code && (
                  <span className="font-mono text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded">
                    {business.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-300 flex items-center gap-1.5">
                <FaMapMarkerAlt className="text-red-400" />
                {business?.address
                  ? `${business.address}, ${business.city}, ${business.state}`
                  : `${business?.city || "-"}, ${business?.state || "-"}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <FaTimes />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-20 text-center">
              <FaSpinner className="animate-spin text-3xl text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading business information & sales history...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-sm">
              {error}
            </div>
          ) : (
            <>
              {/* KEY STATS CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    <FaChartLine className="text-emerald-600" />
                    Total Sales Revenue
                  </div>
                  <p className="text-2xl font-black text-gray-900">
                    ₹{Number(metrics.totalSales || 0).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Across all recorded months</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    <FaReceipt className="text-blue-600" />
                    Total Orders
                  </div>
                  <p className="text-2xl font-black text-gray-900">
                    {Number(metrics.totalOrders || 0).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Transactions completed</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    <FaBullseye className="text-amber-600" />
                    Monthly Target
                  </div>
                  <p className="text-2xl font-black text-gray-900">
                    ₹{Number(business?.monthlyTarget || 0).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Standard monthly quota</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    <FaCheckCircle className="text-purple-600" />
                    Average Achievement
                  </div>
                  <p className="text-2xl font-black text-gray-900">
                    {metrics.avgAchievementRate || 0}%
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Historical average</p>
                </div>
              </div>

              {/* BUSINESS METADATA & NOTES */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <p className="text-gray-500">
                    <strong>Assigned Manager:</strong>{" "}
                    {business?.assignedManager?.name
                      ? `${business.assignedManager.name} (${business.assignedManager.email})`
                      : "Direct State Assignment"}
                  </p>
                  <p className="text-gray-500">
                    <strong>Business ID:</strong>{" "}
                    <span className="font-mono text-gray-800">{business?.code}</span>
                  </p>
                  {business?.notes && (
                    <p className="text-gray-700 italic pt-1">
                      <FaStickyNote className="inline text-amber-600 mr-1" />
                      "{business.notes}"
                    </p>
                  )}
                </div>
                <div className="text-right sm:text-right text-[11px] text-gray-400 font-mono">
                  Created: {business?.createdAt ? new Date(business.createdAt).toLocaleDateString() : "-"}
                </div>
              </div>

              {/* MONTHLY SALES HISTORY TABLE */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                    <FaCalendarAlt className="text-gray-600" />
                    Complete Monthly Sales History ({records.length} records)
                  </h4>
                </div>

                {records.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-500 text-xs">
                    No sales records found for this business yet. Use the "Upload Sales Excel" button on the dashboard to import monthly records.
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100 text-gray-700 uppercase font-bold border-b border-gray-200">
                        <tr>
                          <th className="py-2.5 px-3">Month</th>
                          <th className="py-2.5 px-3 text-right">Total Sales</th>
                          <th className="py-2.5 px-3 text-right">Orders</th>
                          <th className="py-2.5 px-3 text-right">Target</th>
                          <th className="py-2.5 px-3 text-right">Achievement %</th>
                          <th className="py-2.5 px-3">Remarks</th>
                          <th className="py-2.5 px-3">Source & Uploader</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {records.map((rec) => {
                          const rate = Number(rec.achievementRate || 0);
                          return (
                            <tr key={rec._id} className="hover:bg-gray-50/80">
                              <td className="py-2.5 px-3 font-semibold text-gray-900">
                                {rec.monthName}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                                ₹{Number(rec.totalSales || 0).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-gray-700">
                                {rec.orders}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-gray-600">
                                ₹{Number(rec.target || 0).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] ${
                                    rate >= 100
                                      ? "bg-green-100 text-green-800"
                                      : rate >= 80
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {rate}%
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-gray-600 truncate max-w-[150px]">
                                {rec.remarks || "-"}
                              </td>
                              <td className="py-2.5 px-3 text-gray-500 text-[11px]">
                                <span className="font-semibold text-gray-700">
                                  {rec.source === "excel_upload" ? "Excel Import" : "Manual"}
                                </span>
                                {rec.uploaderName && (
                                  <span className="block text-gray-400">by {rec.uploaderName}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
