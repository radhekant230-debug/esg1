import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../utils/axios";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaSearch,
  FaFilter,
  FaShieldAlt,
  FaHistory,
  FaFileAlt,
  FaBuilding,
  FaTimes,
  FaExclamationTriangle,
  FaHourglassHalf,
  FaCheck,
  FaUndo,
} from "react-icons/fa";

export default function ApprovalsCenter() {
  const { user, isAdmin, isManager } = useContext(AuthContext);

  // Active Tab Filter
  const [activeTab, setActiveTab] = useState("pending_client");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Data & State
  const [counts, setCounts] = useState({
    pendingClient: 0,
    pendingManager: 0,
    approved: 0,
    rejected: 0,
    autoApproved: 0,
    expiringSoon: 0,
    overdue: 0,
    total: 0,
  });
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);

  // Modals & Action State
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState("Approved"); // 'Approved' | 'Rejected' | 'Request Changes'
  const [decisionNotes, setDecisionNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  // Live countdown timer ticker
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [activeTab, search, page]);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const params = {
        filter: activeTab,
        page,
        limit: 10,
      };
      if (search) params.search = search;

      const res = await api.get("/risks/approvals/center", { params });
      if (res.data) {
        setCounts(res.data.counts || {});
        setItems(res.data.items || []);
        setPagination(res.data.pagination || { total: 0, pages: 1 });
      }
    } catch (err) {
      console.error("Error fetching approvals center:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    setActionLoading(true);
    setActionError("");
    try {
      await api.put(`/risks/${selectedItem._id}/decide`, {
        decision: decisionType,
        decisionNotes,
      });
      setShowDecisionModal(false);
      setDecisionNotes("");
      setSelectedItem(null);
      fetchApprovals();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to submit decision.");
    } finally {
      setActionLoading(false);
    }
  };

  // Live countdown calculation
  const getCountdownString = (deadline) => {
    if (!deadline) return "No deadline";
    const diff = new Date(deadline).getTime() - now.getTime();
    if (diff <= 0) return "Expired (Auto-approved)";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours}h ${mins}m ${secs}s`;
  };

  const tabs = [
    {
      id: "pending_client",
      label: "Pending Client",
      count: counts.pendingClient,
      color: "purple",
    },
    {
      id: "pending_manager",
      label: "Pending Review",
      count: counts.pendingManager,
      color: "amber",
    },
    {
      id: "expiring_soon",
      label: "Expiring Soon (<4h)",
      count: counts.expiringSoon,
      color: "rose",
    },
    {
      id: "auto_approved",
      label: "Auto-Approved (24h)",
      count: counts.autoApproved,
      color: "indigo",
    },
    {
      id: "approved",
      label: "Approved",
      count: counts.approved,
      color: "emerald",
    },
    {
      id: "rejected",
      label: "Rejected / Changes",
      count: counts.rejected,
      color: "rose",
    },
    {
      id: "overdue",
      label: "Overdue Items",
      count: counts.overdue,
      color: "stone",
    },
    {
      id: "all",
      label: "All Proposals",
      count: counts.total,
      color: "stone",
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* =========================================================
          1. HEADER
      ========================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl p-6 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#9C7A42]"></span>
            <span className="text-[10px] font-mono tracking-widest uppercase text-[#8C6D37] font-bold">
              UNIFIED DECISION GOVERNANCE
            </span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#1A1816] tracking-tight">
            Approvals Center
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Real-time pipeline of pending client authorizations, 24-hour auto-approval tracking, and executive mitigations.
          </p>
        </div>

        {/* Global Pending Notification Badge */}
        <div className="flex items-center gap-3">
          <div className="bg-[#FAF8F5] border border-[#E7DFD5] px-4 py-2 rounded-xl flex items-center gap-3 shadow-2xs">
            <div className="w-8 h-8 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 font-bold text-xs">
              {counts.pendingClient}
            </div>
            <div>
              <p className="text-[10px] font-mono text-stone-500 uppercase">Awaiting Client</p>
              <p className="text-xs font-bold text-stone-900">24-Hour Timer Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          2. FILTER TABS WITH COUNTERS
      ========================================================= */}
      <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl p-3 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? "bg-[#1A1816] text-[#FAF8F5] font-bold shadow-xs"
                    : "text-stone-600 hover:text-stone-900 hover:bg-[#F5F0E6]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                    isActive
                      ? "bg-[#C5A880] text-[#1A1816]"
                      : "bg-[#EFE9DF] text-stone-700"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input Bar */}
        <div className="pt-3 border-t border-[#E7DFD5] mt-2 flex items-center gap-3">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs" />
            <input
              type="text"
              placeholder="Search approvals by title, client name, risk ID, or manager..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl text-xs text-[#1A1816] placeholder-stone-400 focus:outline-hidden focus:border-[#9C7A42]"
            />
          </div>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-xs text-stone-500 hover:text-stone-900 font-mono"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* =========================================================
          3. APPROVALS QUEUE TABLE
      ========================================================= */}
      <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-[#9C7A42]/30 border-t-[#9C7A42] rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-mono text-stone-500">Loading approvals queue...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-[#F7F3EB] border border-[#DCD2C4] flex items-center justify-center text-[#9C7A42] mx-auto mb-3">
              <FaCheckCircle className="text-xl" />
            </div>
            <h3 className="text-base font-serif font-bold text-[#1A1816]">No items in this queue</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              There are currently no proposals matching the "{tabs.find((t) => t.id === activeTab)?.label}" criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#E7DFD5] text-[10px] font-mono uppercase tracking-wider text-stone-500">
                  <th className="py-3 px-4">Proposal / Risk</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Severity &amp; Impact</th>
                  <th className="py-3 px-4">Approval Status</th>
                  <th className="py-3 px-4">24h Auto-Approval Countdown</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE9DF]">
                {items.map((item) => {
                  const countdown = getCountdownString(item.approvalDeadline);
                  return (
                    <tr
                      key={item._id}
                      className="hover:bg-[#FAF8F5]/80 transition cursor-pointer"
                      onClick={() => setSelectedItem(item)}
                    >
                      {/* Proposal / Risk */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-[#8C6D37] bg-[#F2EDE4] px-1.5 py-0.5 rounded border border-[#E0D7C9]">
                            {item.riskId}
                          </span>
                          {item.mitigationPlan?.version && (
                            <span className="text-[9.5px] font-mono text-stone-400">
                              v{item.mitigationPlan.version}.0
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-[#1A1816] mt-1 line-clamp-1">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-stone-500 line-clamp-1">
                          {item.mitigationPlan?.title || item.description}
                        </p>
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-medium text-[#1A1816]">
                          {item.clientName || item.client?.companyName || "Client"}
                        </p>
                        <p className="text-[10px] font-mono text-stone-400">
                          {item.clientIdCode || "—"}
                        </p>
                      </td>

                      {/* Severity & Impact */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] border ${
                              item.severity === "Critical"
                                ? "bg-rose-100 text-rose-800 border-rose-300 font-bold"
                                : item.severity === "High"
                                ? "bg-amber-100 text-amber-800 border-amber-300 font-semibold"
                                : "bg-blue-100 text-blue-800 border-blue-200"
                            }`}
                          >
                            {item.severity}
                          </span>
                          <span className="font-mono text-stone-600 text-[10.5px]">
                            {item.financialImpactAmount
                              ? `₹${Number(item.financialImpactAmount).toLocaleString("en-IN")}`
                              : "Standard"}
                          </span>
                        </div>
                      </td>

                      {/* Approval Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] border ${
                              item.isAutoApproved
                                ? "bg-indigo-100 text-indigo-800 border-indigo-300 font-bold"
                                : item.status === "Approved"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold"
                                : item.status === "Pending Client Approval"
                                ? "bg-purple-100 text-purple-800 border-purple-300 font-semibold"
                                : item.status === "Rejected"
                                ? "bg-rose-100 text-rose-800 border-rose-300 font-bold"
                                : "bg-stone-100 text-stone-700 border-stone-300"
                            }`}
                          >
                            {item.isAutoApproved ? "Auto-Approved (24h)" : item.status}
                          </span>
                        </div>
                      </td>

                      {/* 24h Countdown */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.status === "Pending Client Approval" && item.approvalDeadline ? (
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-700">
                              <FaClock className="text-xs" />
                            </div>
                            <div>
                              <p className="font-mono font-bold text-purple-900 text-[11px]">
                                {countdown}
                              </p>
                              <p className="text-[9.5px] font-mono text-stone-400">
                                Due: {new Date(item.approvalDeadline).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        ) : item.isAutoApproved ? (
                          <div className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md inline-block border border-indigo-200">
                            Policy Executed at 24h
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-stone-400">
                            {item.decisionAt
                              ? `Decided on ${new Date(item.decisionAt).toLocaleDateString()}`
                              : "Review in progress"}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#F5F0E6] hover:bg-[#EDE5D8] text-[#8C6D37] border border-[#DDD3C3] transition"
                          >
                            Details
                          </button>

                          {/* Quick Decision Trigger */}
                          {item.status === "Pending Client Approval" && (
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setDecisionType("Approved");
                                setShowDecisionModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-2xs flex items-center gap-1"
                            >
                              <FaCheck className="text-[9px]" /> Decide
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-[#E7DFD5] bg-[#FAF8F5] flex items-center justify-between text-xs">
            <span className="text-stone-500 font-mono">
              Page {page} of {pagination.pages} ({pagination.total} total proposals)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 rounded-lg border border-[#E7DFD5] bg-white disabled:opacity-40 text-stone-700"
              >
                Previous
              </button>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 rounded-lg border border-[#E7DFD5] bg-white disabled:opacity-40 text-stone-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          4. PROPOSAL DETAILS & DECISION MODAL
      ========================================================= */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-2xs">
          <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-[#E7DFD5] bg-[#FAF8F5] flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-[#8C6D37] bg-[#F2EDE4] px-2 py-0.5 rounded border border-[#E0D7C9] font-bold">
                    {selectedItem.riskId}
                  </span>
                  <span className="text-xs font-mono text-stone-500">
                    Client: {selectedItem.clientName}
                  </span>
                </div>
                <h3 className="font-serif font-bold text-lg text-[#1A1816]">
                  {selectedItem.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <FaTimes />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs text-stone-700">
              {/* Mandatory 24h Notice */}
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-purple-900 font-bold flex items-center gap-1.5">
                    <FaClock className="text-purple-700" /> Automated 24-Hour Approval Policy
                  </span>
                  {selectedItem.status === "Pending Client Approval" && (
                    <span className="font-mono font-bold text-purple-900">
                      {getCountdownString(selectedItem.approvalDeadline)} remaining
                    </span>
                  )}
                </div>
                <p className="text-xs text-purple-950 font-serif leading-relaxed italic">
                  "Please review this proposed risk mitigation plan within 24 hours. If no decision is received within 24 hours of submission, the plan will be automatically approved according to the applicable approval policy."
                </p>
              </div>

              {/* Proposed Mitigation Plan */}
              <div className="p-4 bg-[#FAF8F5] border border-[#E7DFD5] rounded-xl space-y-2">
                <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider font-semibold">
                  Proposed Mitigation Roadmap
                </span>
                <p className="font-semibold text-stone-900 text-sm">
                  {selectedItem.mitigationPlan?.title || selectedItem.title}
                </p>
                <p className="leading-relaxed bg-white p-3 rounded-lg border border-[#E7DFD5] text-stone-800">
                  {selectedItem.mitigationPlan?.proposedAction || "Mitigation action under review."}
                </p>
              </div>

              {/* Postponement notice if any */}
              {selectedItem.postponementHistory?.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-mono text-amber-800 uppercase font-bold">
                    Rescheduled History
                  </span>
                  <p className="text-amber-900">
                    Latest Reason:{" "}
                    <strong>
                      {selectedItem.postponementHistory[selectedItem.postponementHistory.length - 1].reason}
                    </strong>
                  </p>
                </div>
              )}
            </div>

            {/* Decision Footer Buttons */}
            <div className="p-4 border-t border-[#E7DFD5] bg-[#FAF8F5] flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 border border-[#E7DFD5] rounded-xl text-stone-600 hover:bg-[#EFE9DF]"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setDecisionType("Request Changes");
                    setShowDecisionModal(true);
                  }}
                  className="px-3.5 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl font-bold transition cursor-pointer"
                >
                  Request Changes
                </button>
                <button
                  onClick={() => {
                    setDecisionType("Rejected");
                    setShowDecisionModal(true);
                  }}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition cursor-pointer"
                >
                  Reject Plan
                </button>
                <button
                  onClick={() => {
                    setDecisionType("Approved");
                    setShowDecisionModal(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-xs cursor-pointer"
                >
                  Approve Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DECISION REASON MODAL */}
      {showDecisionModal && selectedItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-150 text-xs">
            <h3 className="font-serif font-bold text-base text-[#1A1816]">
              Confirm Decision:{" "}
              <span
                className={
                  decisionType === "Approved"
                    ? "text-emerald-700"
                    : decisionType === "Rejected"
                    ? "text-rose-700"
                    : "text-amber-700"
                }
              >
                {decisionType}
              </span>
            </h3>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                {actionError}
              </div>
            )}

            <div>
              <label className="block text-stone-700 font-semibold mb-1">
                {decisionType === "Approved"
                  ? "Approval Notes / Executive Remarks (Optional)"
                  : "Reason for Rejection or Requested Changes *"}
              </label>
              <textarea
                required={decisionType !== "Approved"}
                rows={3}
                placeholder={
                  decisionType === "Approved"
                    ? "Add any implementation conditions or executive notes..."
                    : "Specify precisely why the proposal requires revisions..."
                }
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDecisionModal(false)}
                className="px-4 py-2 border border-[#E7DFD5] rounded-xl text-stone-600 hover:bg-[#EFE9DF]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDecision}
                className={`px-5 py-2 text-white rounded-xl font-bold transition shadow-xs cursor-pointer ${
                  decisionType === "Approved"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : decisionType === "Rejected"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {actionLoading ? "Submitting..." : `Confirm ${decisionType}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
