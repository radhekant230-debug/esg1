import React, { useState, useEffect, useContext, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import api from "../utils/axios";
import {
  FaShieldAlt,
  FaPlus,
  FaSearch,
  FaFilter,
  FaCalendarAlt,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaHistory,
  FaFileAlt,
  FaUserTie,
  FaBuilding,
  FaArrowRight,
  FaDollarSign,
  FaRegCommentDots,
  FaPaperPlane,
  FaChevronRight,
  FaTimes,
  FaArrowUp,
  FaSlidersH,
} from "react-icons/fa";

export default function RiskManagement() {
  const { user, isAdmin, isManager } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();

  // Risks Data & State
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [managers, setManagers] = useState([]);

  // Filters State
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedManager, setSelectedManager] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // Modals
  const [selectedRisk, setSelectedRisk] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showMitigationModal, setShowMitigationModal] = useState(false);
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  // Form States
  const [createForm, setCreateForm] = useState({
    title: "",
    clientId: "",
    description: "",
    category: "Operational",
    severity: "Medium",
    financialImpact: "",
    financialImpactAmount: "",
    businessImpact: "",
    mitigationAction: "",
    assignedManagerId: "",
    deadline: "",
  });

  const [reviewNotes, setReviewNotes] = useState("");
  const [mitigationForm, setMitigationForm] = useState({
    title: "",
    proposedAction: "",
    estimatedResolutionDays: 14,
    resourceRequirements: "",
    estimatedCost: "",
    notes: "",
  });

  const [postponeForm, setPostponeForm] = useState({
    reason: "",
    newProposedReviewDate: "",
    notes: "",
  });

  const [escalateForm, setEscalateForm] = useState({
    reason: "",
    escalationLevel: "Executive Committee",
    notes: "",
  });

  const [resolveNotes, setResolveNotes] = useState("");
  const [newComment, setNewComment] = useState("");

  // Live Countdown Hook / Tick for 24h Auto-Approval
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Check URL query parameters
  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setShowCreateModal(true);
    }
  }, [searchParams]);

  // Load Initial Data
  useEffect(() => {
    fetchRisks();
    fetchClientsAndManagers();
  }, [selectedClient, selectedManager, selectedSeverity, selectedStatus, selectedCategory]);

  const fetchRisks = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedClient) params.client = selectedClient;
      if (selectedSeverity) params.severity = selectedSeverity;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedCategory) params.category = selectedCategory;

      const res = await api.get("/risks", { params });
      setRisks(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching risks:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientsAndManagers = async () => {
    try {
      const [cRes, mRes] = await Promise.allSettled([
        api.get("/portal/clients-selector"),
        api.get("/admin/managers"),
      ]);

      if (cRes.status === "fulfilled" && cRes.value.data?.clients) {
        setClients(cRes.value.data.clients);
      }
      if (mRes.status === "fulfilled" && Array.isArray(mRes.value.data?.managers)) {
        setManagers(mRes.value.data.managers);
      }
    } catch (e) {
      console.error("Error fetching clients/managers:", e);
    }
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    const total = risks.length;
    const critical = risks.filter((r) => r.severity === "Critical" && r.status !== "Resolved").length;
    const pendingClient = risks.filter((r) => r.status === "Pending Client Approval").length;
    const autoApproved = risks.filter((r) => r.isAutoApproved).length;
    const resolved = risks.filter((r) => r.status === "Resolved").length;
    return { total, critical, pendingClient, autoApproved, resolved };
  }, [risks]);

  // Filtered Risks
  const filteredRisks = useMemo(() => {
    return risks.filter((r) => {
      if (search) {
        const query = search.toLowerCase();
        const matchesTitle = r.title?.toLowerCase().includes(query);
        const matchesClient = r.clientName?.toLowerCase().includes(query);
        const matchesId = r.riskId?.toLowerCase().includes(query);
        const matchesDesc = r.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesClient && !matchesId && !matchesDesc) return false;
      }
      if (dateFilter) {
        const riskDate = new Date(r.createdAt).toISOString().split("T")[0];
        if (riskDate !== dateFilter) return false;
      }
      return true;
    });
  }, [risks, search, dateFilter]);

  // Handle Form Submissions
  const handleCreateRisk = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError("");
    try {
      await api.post("/risks", createForm);
      setShowCreateModal(false);
      setCreateForm({
        title: "",
        clientId: "",
        description: "",
        category: "Operational",
        severity: "Medium",
        financialImpact: "",
        financialImpactAmount: "",
        businessImpact: "",
        mitigationAction: "",
        assignedManagerId: "",
        deadline: "",
      });
      fetchRisks();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to create risk record.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewRisk = async () => {
    if (!selectedRisk) return;
    setActionLoading(true);
    setActionError("");
    try {
      await api.put(`/risks/${selectedRisk._id}/review`, { notes: reviewNotes });
      setShowReviewModal(false);
      setReviewNotes("");
      refreshRiskDetails(selectedRisk._id);
      fetchRisks();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to mark risk as under review.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveMitigationPlan = async (e) => {
    e.preventDefault();
    if (!selectedRisk) return;
    setActionLoading(true);
    setActionError("");
    try {
      await api.put(`/risks/${selectedRisk._id}/mitigation`, mitigationForm);
      setShowMitigationModal(false);
      refreshRiskDetails(selectedRisk._id);
      fetchRisks();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to save mitigation plan.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitForClientApproval = async () => {
    if (!selectedRisk) return;
    setActionLoading(true);
    setActionError("");
    try {
      await api.put(`/risks/${selectedRisk._id}/submit-approval`, {
        notes: "Mitigation plan submitted to client with 24-hour auto-approval policy.",
      });
      refreshRiskDetails(selectedRisk._id);
      fetchRisks();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to submit plan for client approval.");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePostponeRisk = async (e) => {
    e.preventDefault();
    if (!selectedRisk) return;
    setActionLoading(true);
    setActionError("");
    try {
      await api.put(`/risks/${selectedRisk._id}/postpone`, postponeForm);
      setShowPostponeModal(false);
      setPostponeForm({ reason: "", newProposedReviewDate: "", notes: "" });
      refreshRiskDetails(selectedRisk._id);
      fetchRisks();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to postpone risk.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscalateRisk = async (e) => {
    e.preventDefault();
    if (!selectedRisk) return;
    setActionLoading(true);
    setActionError("");
    try {
      await api.put(`/risks/${selectedRisk._id}/escalate`, escalateForm);
      setShowEscalateModal(false);
      setEscalateForm({ reason: "", escalationLevel: "Executive Committee", notes: "" });
      refreshRiskDetails(selectedRisk._id);
      fetchRisks();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to escalate risk.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveRisk = async (e) => {
    e.preventDefault();
    if (!selectedRisk) return;
    setActionLoading(true);
    setActionError("");
    try {
      await api.put(`/risks/${selectedRisk._id}/resolve`, { resolutionNotes: resolveNotes });
      setShowResolveModal(false);
      setResolveNotes("");
      refreshRiskDetails(selectedRisk._id);
      fetchRisks();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to resolve risk.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!selectedRisk || !newComment.trim()) return;
    try {
      await api.post(`/risks/${selectedRisk._id}/comments`, { message: newComment });
      setNewComment("");
      refreshRiskDetails(selectedRisk._id);
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  const refreshRiskDetails = async (id) => {
    try {
      const res = await api.get(`/risks/${id}`);
      setSelectedRisk(res.data.risk);
    } catch (err) {
      console.error("Error refreshing risk:", err);
    }
  };

  const viewAuditLogs = async (risk) => {
    try {
      setSelectedRisk(risk);
      const res = await api.get(`/risks/${risk._id}/audit-logs`);
      setAuditLogs(Array.isArray(res.data) ? res.data : []);
      setShowAuditModal(true);
    } catch (err) {
      console.error("Error viewing audit logs:", err);
    }
  };

  // Severity badge style helper
  const getSeverityBadge = (severity) => {
    switch (severity) {
      case "Critical":
        return "bg-rose-100 text-rose-800 border-rose-300 font-bold";
      case "High":
        return "bg-amber-100 text-amber-800 border-amber-300 font-semibold";
      case "Medium":
        return "bg-blue-100 text-blue-800 border-blue-200 font-medium";
      case "Low":
        return "bg-emerald-100 text-emerald-800 border-emerald-200 font-medium";
      default:
        return "bg-stone-100 text-stone-700 border-stone-200";
    }
  };

  // Status badge style helper
  const getStatusBadge = (status, isAutoApproved) => {
    if (isAutoApproved) {
      return "bg-indigo-100 text-indigo-800 border-indigo-300 font-bold";
    }
    switch (status) {
      case "Identified":
        return "bg-stone-100 text-stone-700 border-stone-300";
      case "Under Review":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "Mitigation Proposed":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "Pending Client Approval":
        return "bg-purple-100 text-purple-800 border-purple-300 font-semibold";
      case "Approved":
        return "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold";
      case "Rejected":
        return "bg-rose-100 text-rose-800 border-rose-300 font-bold";
      case "Resolved":
        return "bg-teal-100 text-teal-800 border-teal-300 font-bold";
      case "Escalated":
        return "bg-red-100 text-red-900 border-red-400 font-black";
      default:
        return "bg-stone-100 text-stone-700 border-stone-200";
    }
  };

  // Countdown Calculator
  const getCountdownString = (deadline) => {
    if (!deadline) return null;
    const diff = new Date(deadline).getTime() - now.getTime();
    if (diff <= 0) return "Deadline Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours}h ${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* =========================================================
          1. HEADER & ACTIONS
      ========================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl p-6 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#9C7A42]"></span>
            <span className="text-[10px] font-mono tracking-widest uppercase text-[#8C6D37] font-bold">
              PORTFOLIO RISK GOVERNANCE
            </span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#1A1816] tracking-tight">
            Risk Management System
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Client-specific risk tracking, manager mitigation planning, postponement logging &amp; 24-hour auto-approval workflow.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-[#9C7A42] hover:bg-[#856734] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs transition cursor-pointer"
          >
            <FaPlus className="text-xs" /> Log New Risk
          </button>
        </div>
      </div>

      {/* =========================================================
          2. KPI SUMMARY METRICS
      ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-xl p-4 shadow-2xs">
          <p className="text-[10px] font-mono uppercase tracking-wider text-stone-500 font-semibold">
            Total Active Risks
          </p>
          <p className="text-2xl font-serif font-bold text-[#1A1816] mt-1">{kpis.total}</p>
          <span className="text-[10px] text-stone-400">Tracked across clients</span>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-xl p-4 shadow-2xs">
          <p className="text-[10px] font-mono uppercase tracking-wider text-rose-600 font-semibold">
            Critical Severity
          </p>
          <p className="text-2xl font-serif font-bold text-rose-700 mt-1">{kpis.critical}</p>
          <span className="text-[10px] text-stone-400">Immediate attention</span>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-xl p-4 shadow-2xs">
          <p className="text-[10px] font-mono uppercase tracking-wider text-purple-600 font-semibold">
            Pending Client Approval
          </p>
          <p className="text-2xl font-serif font-bold text-purple-700 mt-1">{kpis.pendingClient}</p>
          <span className="text-[10px] text-stone-400">24-hour timer active</span>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-xl p-4 shadow-2xs">
          <p className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 font-semibold">
            Auto-Approved (24h)
          </p>
          <p className="text-2xl font-serif font-bold text-indigo-700 mt-1">{kpis.autoApproved}</p>
          <span className="text-[10px] text-stone-400">Policy executed</span>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-xl p-4 shadow-2xs col-span-2 sm:col-span-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 font-semibold">
            Resolved Risks
          </p>
          <p className="text-2xl font-serif font-bold text-emerald-700 mt-1">{kpis.resolved}</p>
          <span className="text-[10px] text-stone-400">Mitigated successfully</span>
        </div>
      </div>

      {/* =========================================================
          3. FILTER BAR
      ========================================================= */}
      <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs" />
            <input
              type="text"
              placeholder="Search by risk title, risk ID, client, or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl text-xs text-[#1A1816] placeholder-stone-400 focus:outline-hidden focus:border-[#9C7A42]"
            />
          </div>

          {/* Quick Clear */}
          {(search || selectedClient || selectedSeverity || selectedStatus || selectedCategory || dateFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setSelectedClient("");
                setSelectedSeverity("");
                setSelectedStatus("");
                setSelectedCategory("");
                setDateFilter("");
              }}
              className="text-xs text-[#8C6D37] hover:underline font-mono shrink-0 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
          {/* Client Filter */}
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-2.5 py-1.5 text-xs text-stone-700 focus:outline-hidden focus:border-[#9C7A42]"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.businessName} ({c.name})
              </option>
            ))}
          </select>

          {/* Severity Filter */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-2.5 py-1.5 text-xs text-stone-700 focus:outline-hidden focus:border-[#9C7A42]"
          >
            <option value="">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-2.5 py-1.5 text-xs text-stone-700 focus:outline-hidden focus:border-[#9C7A42]"
          >
            <option value="">All Statuses</option>
            <option value="Identified">Identified</option>
            <option value="Under Review">Under Review</option>
            <option value="Mitigation Proposed">Mitigation Proposed</option>
            <option value="Pending Client Approval">Pending Client Approval</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Resolved">Resolved</option>
            <option value="Escalated">Escalated</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-2.5 py-1.5 text-xs text-stone-700 focus:outline-hidden focus:border-[#9C7A42]"
          >
            <option value="">All Categories</option>
            <option value="Operational">Operational</option>
            <option value="Financial">Financial</option>
            <option value="Compliance">Compliance</option>
            <option value="Market">Market</option>
            <option value="Reputation">Reputation</option>
            <option value="Strategic">Strategic</option>
            <option value="Legal">Legal</option>
          </select>

          {/* Date Filter */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-2.5 py-1.5 text-xs text-stone-700 focus:outline-hidden focus:border-[#9C7A42]"
            title="Filter by creation date"
          />
        </div>
      </div>

      {/* =========================================================
          4. RISKS TABLE & CARDS
      ========================================================= */}
      <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-[#9C7A42]/30 border-t-[#9C7A42] rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-mono text-stone-500">Loading risk repository...</p>
          </div>
        ) : filteredRisks.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-[#F7F3EB] border border-[#DCD2C4] flex items-center justify-center text-[#9C7A42] mx-auto mb-3">
              <FaShieldAlt className="text-xl" />
            </div>
            <h3 className="text-base font-serif font-bold text-[#1A1816]">No risk records found</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              No risks match the current filter criteria or none have been logged yet.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 bg-[#9C7A42] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs"
            >
              <FaPlus className="text-xs" /> Log First Risk
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#E7DFD5] text-[10px] font-mono uppercase tracking-wider text-stone-500">
                  <th className="py-3 px-4">Risk ID &amp; Title</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Severity &amp; Score</th>
                  <th className="py-3 px-4">Impact</th>
                  <th className="py-3 px-4">Status &amp; 24h Timer</th>
                  <th className="py-3 px-4">Manager / Deadline</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE9DF]">
                {filteredRisks.map((risk) => {
                  const countdown = getCountdownString(risk.approvalDeadline);
                  return (
                    <tr
                      key={risk._id}
                      className="hover:bg-[#FAF8F5]/80 transition cursor-pointer"
                      onClick={() => {
                        setSelectedRisk(risk);
                      }}
                    >
                      {/* Risk ID & Title */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-[#8C6D37] bg-[#F2EDE4] px-1.5 py-0.5 rounded border border-[#E0D7C9]">
                            {risk.riskId}
                          </span>
                          <span className="text-[10px] font-mono text-stone-400">
                            {risk.category}
                          </span>
                        </div>
                        <p className="font-semibold text-[#1A1816] mt-1 line-clamp-1 hover:text-[#8C6D37]">
                          {risk.title}
                        </p>
                        <p className="text-[11px] text-stone-500 line-clamp-1">
                          {risk.description}
                        </p>
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <FaBuilding className="text-stone-400 text-xs shrink-0" />
                          <div>
                            <p className="font-medium text-[#1A1816] truncate max-w-[130px]">
                              {risk.clientName || risk.client?.companyName || "Client"}
                            </p>
                            <p className="text-[10px] font-mono text-stone-400">
                              {risk.clientIdCode || risk.client?.clientId || "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Severity & Score */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] border ${getSeverityBadge(
                              risk.severity
                            )}`}
                          >
                            {risk.severity}
                          </span>
                          <span className="font-mono text-stone-600 text-[11px] font-semibold">
                            Score: {risk.riskScore || 50}
                          </span>
                        </div>
                      </td>

                      {/* Financial Impact */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-mono text-[#1A1816] font-medium">
                          {risk.financialImpactAmount
                            ? `₹${Number(risk.financialImpactAmount).toLocaleString("en-IN")}`
                            : risk.financialImpact || "Not specified"}
                        </p>
                        <p className="text-[10px] text-stone-400 truncate max-w-[110px]">
                          {risk.businessImpact || "Operational"}
                        </p>
                      </td>

                      {/* Status & 24h Countdown */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] border ${getStatusBadge(
                              risk.status,
                              risk.isAutoApproved
                            )}`}
                          >
                            {risk.isAutoApproved ? "Auto-Approved (24h)" : risk.status}
                          </span>

                          {/* Live 24-hour Countdown Timer for Pending Client Approval */}
                          {risk.status === "Pending Client Approval" && risk.approvalDeadline && (
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                              <FaClock className="text-[9px] animate-spin" />
                              <span>Auto-approval in {countdown}</span>
                            </div>
                          )}

                          {/* Postponement tag */}
                          {risk.isPostponed && (
                            <div className="flex items-center gap-1 text-[9.5px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              <FaCalendarAlt className="text-[8px]" />
                              <span>Postponed ({risk.postponementCount}x)</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Manager / Review Deadline */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="text-[#1A1816] font-medium">
                          {risk.assignedManager?.name || "Unassigned"}
                        </p>
                        <p className="text-[10px] font-mono text-stone-500">
                          Due:{" "}
                          {risk.proposedReviewDate
                            ? new Date(risk.proposedReviewDate).toLocaleDateString()
                            : risk.deadline
                            ? new Date(risk.deadline).toLocaleDateString()
                            : "Flexible"}
                        </p>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedRisk(risk)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#F5F0E6] hover:bg-[#EDE5D8] text-[#8C6D37] border border-[#DDD3C3] transition"
                            title="View Risk Details"
                          >
                            View
                          </button>
                          <button
                            onClick={() => viewAuditLogs(risk)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-[#1A1816] hover:bg-[#F2EDE4] transition"
                            title="Audit Trail & Version History"
                          >
                            <FaHistory className="text-xs" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================
          5. RISK DETAILS DRAWER / MODAL
      ========================================================= */}
      {selectedRisk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-2xs">
          <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#E7DFD5] bg-[#FAF8F5] flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs text-[#8C6D37] bg-[#F2EDE4] px-2 py-0.5 rounded border border-[#E0D7C9] font-bold">
                    {selectedRisk.riskId}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] border ${getSeverityBadge(
                      selectedRisk.severity
                    )}`}
                  >
                    {selectedRisk.severity} Severity
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] border ${getStatusBadge(
                      selectedRisk.status,
                      selectedRisk.isAutoApproved
                    )}`}
                  >
                    {selectedRisk.isAutoApproved ? "Auto-Approved (24h)" : selectedRisk.status}
                  </span>
                </div>
                <h2 className="text-xl font-serif font-bold text-[#1A1816]">
                  {selectedRisk.title}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Client: <strong className="text-stone-700">{selectedRisk.clientName}</strong> (
                  {selectedRisk.clientIdCode}) • Category: {selectedRisk.category}
                </p>
              </div>

              <button
                onClick={() => setSelectedRisk(null)}
                className="p-2 rounded-xl text-stone-400 hover:text-[#1A1816] hover:bg-[#F2EDE4] transition"
              >
                <FaTimes />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-xs">
              {/* Mandatory 24-hour notice disclosure */}
              {selectedRisk.status === "Pending Client Approval" && (
                <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-purple-900 font-bold flex items-center gap-1.5">
                      <FaClock className="text-purple-700" /> 24-Hour Automated Approval Policy
                    </span>
                    <span className="font-mono font-bold text-xs text-purple-900">
                      Live Timer: {getCountdownString(selectedRisk.approvalDeadline)}
                    </span>
                  </div>
                  <p className="text-xs text-purple-950 font-serif leading-relaxed italic">
                    "Please review this proposed risk mitigation plan within 24 hours. If no decision is received within 24 hours of submission, the plan will be automatically approved according to the applicable approval policy."
                  </p>
                  <div className="text-[10px] font-mono text-purple-800 pt-1 border-t border-purple-200 flex items-center justify-between">
                    <span>Submitted: {new Date(selectedRisk.submittedForApprovalAt).toLocaleString()}</span>
                    <span>Deadline: {new Date(selectedRisk.approvalDeadline).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Description & Impact Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-[#FAF8F5] border border-[#E7DFD5] rounded-xl space-y-1">
                  <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider font-semibold">
                    Risk Description
                  </span>
                  <p className="text-stone-700 leading-relaxed">{selectedRisk.description}</p>
                </div>

                <div className="p-4 bg-[#FAF8F5] border border-[#E7DFD5] rounded-xl space-y-2">
                  <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider font-semibold">
                    Financial &amp; Business Impact
                  </span>
                  <div className="space-y-1">
                    <p className="font-mono text-stone-800 font-bold">
                      Impact Amount:{" "}
                      {selectedRisk.financialImpactAmount
                        ? `₹${Number(selectedRisk.financialImpactAmount).toLocaleString("en-IN")}`
                        : selectedRisk.financialImpact || "Unspecified"}
                    </p>
                    <p className="text-stone-600">
                      Impact Context: {selectedRisk.businessImpact || "Operational risk to client."}
                    </p>
                    <p className="font-mono text-stone-500 text-[11px]">
                      Calculated Risk Score: {selectedRisk.riskScore || 50} / 100
                    </p>
                  </div>
                </div>
              </div>

              {/* Proposed Mitigation Plan */}
              <div className="p-4 bg-[#FFFFFF] border border-[#E7DFD5] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif font-bold text-sm text-[#1A1816] flex items-center gap-2">
                    <FaFileAlt className="text-[#8C6D37]" /> Proposed Mitigation Plan
                  </h4>
                  {selectedRisk.mitigationPlan?.version && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F2EDE4] text-[#8C6D37] border border-[#E0D7C9]">
                      Version {selectedRisk.mitigationPlan.version}.0
                    </span>
                  )}
                </div>

                {selectedRisk.mitigationPlan?.proposedAction ? (
                  <div className="space-y-2 text-stone-700">
                    <p className="font-semibold text-[#1A1816]">
                      {selectedRisk.mitigationPlan.title || "Mitigation Action Strategy"}
                    </p>
                    <p className="leading-relaxed bg-[#FBF9F5] p-3 rounded-lg border border-[#E7DFD5]">
                      {selectedRisk.mitigationPlan.proposedAction}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[10.5px] text-stone-500 pt-2">
                      <div>
                        Resolution Window:{" "}
                        <strong className="text-stone-800">
                          {selectedRisk.mitigationPlan.estimatedResolutionDays || 14} days
                        </strong>
                      </div>
                      <div>
                        Estimated Budget:{" "}
                        <strong className="text-stone-800">
                          {selectedRisk.mitigationPlan.estimatedCost
                            ? `₹${Number(selectedRisk.mitigationPlan.estimatedCost).toLocaleString("en-IN")}`
                            : "Internal resources"}
                        </strong>
                      </div>
                      <div>
                        Resources:{" "}
                        <strong className="text-stone-800">
                          {selectedRisk.mitigationPlan.resourceRequirements || "Standard advisory"}
                        </strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center bg-[#FAF8F5] rounded-lg border border-dashed border-[#DCD2C4]">
                    <p className="text-stone-500 mb-2">
                      No formal mitigation plan submitted yet for this risk.
                    </p>
                    {(isAdmin || isManager) && (
                      <button
                        onClick={() => {
                          setMitigationForm({
                            title: `Mitigation for ${selectedRisk.title}`,
                            proposedAction: selectedRisk.mitigationAction || "",
                            estimatedResolutionDays: 14,
                            resourceRequirements: "",
                            estimatedCost: "",
                            notes: "",
                          });
                          setShowMitigationModal(true);
                        }}
                        className="px-3 py-1.5 bg-[#9C7A42] hover:bg-[#856734] text-white rounded-lg font-semibold text-xs transition"
                      >
                        + Add Mitigation Plan
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Postponement History Section (Requirement 3: Never overwrite original deadline) */}
              {selectedRisk.postponementHistory?.length > 0 && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif font-bold text-xs text-amber-900 flex items-center gap-1.5">
                      <FaCalendarAlt className="text-amber-700" /> Postponement History &amp; Previous Deadlines
                    </h4>
                    <span className="text-[10px] font-mono text-amber-800">
                      Original Deadline:{" "}
                      {selectedRisk.originalDeadline
                        ? new Date(selectedRisk.originalDeadline).toLocaleDateString()
                        : "Initial target"}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedRisk.postponementHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white/80 p-2.5 rounded-lg border border-amber-200/80 text-[11px] text-stone-700"
                      >
                        <div className="flex items-center justify-between font-mono text-[10px] text-amber-800 mb-1">
                          <span>
                            Postponed by: {item.postponedByName || "Manager"} ({item.postponedByRole})
                          </span>
                          <span>{new Date(item.postponedAt).toLocaleString()}</span>
                        </div>
                        <p className="font-semibold text-stone-900">
                          Reason: <span className="font-normal">{item.reason}</span>
                        </p>
                        <p className="text-stone-600">
                          Revised Review Date:{" "}
                          <strong>
                            {new Date(item.newProposedReviewDate).toLocaleString()}
                          </strong>{" "}
                          (Previous:{" "}
                          {item.previousDeadline
                            ? new Date(item.previousDeadline).toLocaleDateString()
                            : "N/A"}
                          )
                        </p>
                        {item.notes && <p className="text-stone-500 italic mt-0.5">Note: {item.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments & Discussion */}
              <div className="p-4 bg-[#FFFFFF] border border-[#E7DFD5] rounded-xl space-y-3">
                <h4 className="font-serif font-bold text-xs text-[#1A1816] flex items-center gap-1.5">
                  <FaRegCommentDots className="text-[#8C6D37]" /> Discussion &amp; Internal Notes
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {selectedRisk.comments?.length > 0 ? (
                    selectedRisk.comments.map((c, i) => (
                      <div key={i} className="bg-[#FAF8F5] p-2.5 rounded-lg border border-[#E7DFD5] text-[11px]">
                        <div className="flex items-center justify-between font-mono text-[9.5px] text-stone-400 mb-0.5">
                          <span className="font-bold text-stone-700">
                            {c.authorName} ({c.authorRole})
                          </span>
                          <span>{new Date(c.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-stone-800">{c.message}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-stone-400 italic text-[11px]">No comments yet.</p>
                  )}
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add an internal observation or update..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="flex-1 bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-1.5 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#9C7A42] hover:bg-[#856734] text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Post
                  </button>
                </form>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 border-t border-[#E7DFD5] bg-[#FAF8F5] flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => viewAuditLogs(selectedRisk)}
                className="inline-flex items-center gap-1.5 text-stone-600 hover:text-[#1A1816] font-mono text-xs px-2.5 py-1.5 rounded-lg hover:bg-[#EFE9DF]"
              >
                <FaHistory className="text-xs text-[#8C6D37]" /> Audit Trail
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Review Risk Action */}
                {selectedRisk.status === "Identified" && (
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold text-xs transition"
                  >
                    Review Risk
                  </button>
                )}

                {/* 2. Mitigation Plan Action */}
                {(isAdmin || isManager) && (
                  <button
                    onClick={() => {
                      setMitigationForm({
                        title:
                          selectedRisk.mitigationPlan?.title ||
                          `Mitigation Plan for ${selectedRisk.title}`,
                        proposedAction: selectedRisk.mitigationPlan?.proposedAction || "",
                        estimatedResolutionDays:
                          selectedRisk.mitigationPlan?.estimatedResolutionDays || 14,
                        resourceRequirements:
                          selectedRisk.mitigationPlan?.resourceRequirements || "",
                        estimatedCost: selectedRisk.mitigationPlan?.estimatedCost || "",
                        notes: "",
                      });
                      setShowMitigationModal(true);
                    }}
                    className="px-3 py-1.5 bg-[#F5F0E6] hover:bg-[#EDE5D8] text-[#8C6D37] border border-[#DDD3C3] rounded-xl font-semibold text-xs transition"
                  >
                    {selectedRisk.mitigationPlan?.proposedAction
                      ? "Edit Mitigation Plan"
                      : "Add Mitigation Plan"}
                  </button>
                )}

                {/* 3. Submit to Client for Approval (Initiates 24-Hour Timer) */}
                {(isAdmin || isManager) &&
                  selectedRisk.mitigationPlan?.proposedAction &&
                  selectedRisk.status !== "Pending Client Approval" &&
                  selectedRisk.status !== "Approved" &&
                  selectedRisk.status !== "Resolved" && (
                    <button
                      onClick={handleSubmitForClientApproval}
                      disabled={actionLoading}
                      className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-semibold text-xs transition shadow-xs flex items-center gap-1.5"
                    >
                      <FaPaperPlane className="text-[10px]" /> Request Client Approval (24h)
                    </button>
                  )}

                {/* 4. Postpone / Reschedule */}
                {(isAdmin || isManager) &&
                  selectedRisk.status !== "Resolved" && (
                    <button
                      onClick={() => setShowPostponeModal(true)}
                      className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl font-semibold text-xs transition"
                    >
                      Postpone / Reschedule
                    </button>
                  )}

                {/* 5. Escalate */}
                {selectedRisk.status !== "Escalated" &&
                  selectedRisk.status !== "Resolved" && (
                    <button
                      onClick={() => setShowEscalateModal(true)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-xs transition"
                    >
                      Escalate
                    </button>
                  )}

                {/* 6. Mark Resolved */}
                {selectedRisk.status !== "Resolved" && (
                  <button
                    onClick={() => setShowResolveModal(true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs transition"
                  >
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          6. MODALS FOR WORKFLOW ACTIONS
      ========================================================= */}

      {/* CREATE RISK MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-2xs">
          <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-[#E7DFD5] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#1A1816]">Log New Business Risk</h3>
                <p className="text-xs text-stone-500">
                  Register risk record, assign to client, assess severity &amp; set review deadline.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleCreateRisk} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs">
              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Risk Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Brand Positioning Dilution via Multi-Channel Discounting"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Target Client *</label>
                  <select
                    required
                    value={createForm.clientId}
                    onChange={(e) => setCreateForm({ ...createForm, clientId: e.target.value })}
                    className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                  >
                    <option value="">Select Client Account</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.businessName} ({c.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Risk Category *</label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                  >
                    <option value="Operational">Operational</option>
                    <option value="Financial">Financial</option>
                    <option value="Compliance">Compliance</option>
                    <option value="Market">Market</option>
                    <option value="Reputation">Reputation</option>
                    <option value="Strategic">Strategic</option>
                    <option value="Legal">Legal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Risk Description *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the nature of the vulnerability, observed patterns, and root causes..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Severity Level *</label>
                  <select
                    value={createForm.severity}
                    onChange={(e) => setCreateForm({ ...createForm, severity: e.target.value })}
                    className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical (Immediate Escalation)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Financial Impact (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 500000"
                    value={createForm.financialImpactAmount}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, financialImpactAmount: e.target.value })
                    }
                    className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Review Deadline</label>
                  <input
                    type="date"
                    value={createForm.deadline}
                    onChange={(e) => setCreateForm({ ...createForm, deadline: e.target.value })}
                    className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  Business Impact Context
                </label>
                <input
                  type="text"
                  placeholder="e.g. Risk of 25% revenue loss across flagship retail café"
                  value={createForm.businessImpact}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, businessImpact: e.target.value })
                  }
                  className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  Initial Recommended Mitigation Action
                </label>
                <textarea
                  rows={2}
                  placeholder="Proposed immediate remedy or corrective action to be reviewed..."
                  value={createForm.mitigationAction}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, mitigationAction: e.target.value })
                  }
                  className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                />
              </div>

              <div className="p-4 border-t border-[#E7DFD5] bg-[#FAF8F5] flex justify-end gap-3 -mx-6 -mb-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-[#E7DFD5] rounded-xl text-stone-600 hover:bg-[#EFE9DF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#9C7A42] hover:bg-[#856734] text-white rounded-xl font-bold transition shadow-xs cursor-pointer"
                >
                  {actionLoading ? "Saving..." : "Log Risk"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MITIGATION PLAN MODAL */}
      {showMitigationModal && selectedRisk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-2xs">
          <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-[#E7DFD5] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#1A1816]">
                  {selectedRisk.mitigationPlan?.proposedAction
                    ? "Edit Mitigation Proposal (New Version)"
                    : "Formulate Mitigation Plan"}
                </h3>
                <p className="text-xs text-stone-500">
                  Risk: <strong>{selectedRisk.title}</strong> ({selectedRisk.riskId})
                </p>
              </div>
              <button
                onClick={() => setShowMitigationModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <FaTimes />
              </button>
            </div>

            <form
              onSubmit={handleSaveMitigationPlan}
              className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs"
            >
              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {actionError}
                </div>
              )}

              {/* Notice regarding 24h timer restarting if resubmitted */}
              {selectedRisk.status === "Pending Client Approval" && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl">
                  <strong>Notice:</strong> Materially editing this proposal will archive the previous version and restart the 24-hour client approval timer upon re-submission.
                </div>
              )}

              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  Mitigation Plan Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unified Pricing Policy & Direct Booking Incentive"
                  value={mitigationForm.title}
                  onChange={(e) => setMitigationForm({ ...mitigationForm, title: e.target.value })}
                  className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  Proposed Action Strategy *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Detail step-by-step resolution roadmap, required governance adjustments, and execution milestones..."
                  value={mitigationForm.proposedAction}
                  onChange={(e) =>
                    setMitigationForm({ ...mitigationForm, proposedAction: e.target.value })
                  }
                  className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">
                    Estimated Resolution (Days)
                  </label>
                  <input
                    type="number"
                    value={mitigationForm.estimatedResolutionDays}
                    onChange={(e) =>
                      setMitigationForm({
                        ...mitigationForm,
                        estimatedResolutionDays: e.target.value,
                      })
                    }
                    className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">
                    Estimated Implementation Cost (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 50000"
                    value={mitigationForm.estimatedCost}
                    onChange={(e) =>
                      setMitigationForm({ ...mitigationForm, estimatedCost: e.target.value })
                    }
                    className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  Resource Requirements
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lead Brand Consultant + Digital Marketing Specialist"
                  value={mitigationForm.resourceRequirements}
                  onChange={(e) =>
                    setMitigationForm({
                      ...mitigationForm,
                      resourceRequirements: e.target.value,
                    })
                  }
                  className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                />
              </div>

              <div className="p-4 border-t border-[#E7DFD5] bg-[#FAF8F5] flex justify-end gap-3 -mx-6 -mb-6">
                <button
                  type="button"
                  onClick={() => setShowMitigationModal(false)}
                  className="px-4 py-2 border border-[#E7DFD5] rounded-xl text-stone-600 hover:bg-[#EFE9DF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#9C7A42] hover:bg-[#856734] text-white rounded-xl font-bold transition shadow-xs cursor-pointer"
                >
                  {actionLoading ? "Saving..." : "Save Mitigation Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POSTPONE / RESCHEDULE MODAL (Requirement 3: Reason, revised date, notes, preserve history) */}
      {showPostponeModal && selectedRisk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-2xs">
          <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-[#E7DFD5] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#1A1816]">
                  Postpone &amp; Reschedule Risk Review
                </h3>
                <p className="text-xs text-stone-500">
                  Save postponement reason &amp; history. The original deadline is permanently retained.
                </p>
              </div>
              <button
                onClick={() => setShowPostponeModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <FaTimes />
              </button>
            </div>

            <form
              onSubmit={handlePostponeRisk}
              className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs"
            >
              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  Reason for Postponement *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Awaiting Q3 audited financial statements from client's CFO"
                  value={postponeForm.reason}
                  onChange={(e) => setPostponeForm({ ...postponeForm, reason: e.target.value })}
                  className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  New Proposed Review Date &amp; Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={postponeForm.newProposedReviewDate}
                  onChange={(e) =>
                    setPostponeForm({
                      ...postponeForm,
                      newProposedReviewDate: e.target.value,
                    })
                  }
                  className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Additional Notes</label>
                <textarea
                  rows={3}
                  placeholder="Additional context on the revised timeline or stakeholder discussions..."
                  value={postponeForm.notes}
                  onChange={(e) => setPostponeForm({ ...postponeForm, notes: e.target.value })}
                  className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                />
              </div>

              <div className="p-4 border-t border-[#E7DFD5] bg-[#FAF8F5] flex justify-end gap-3 -mx-6 -mb-6">
                <button
                  type="button"
                  onClick={() => setShowPostponeModal(false)}
                  className="px-4 py-2 border border-[#E7DFD5] rounded-xl text-stone-600 hover:bg-[#EFE9DF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition shadow-xs cursor-pointer"
                >
                  {actionLoading ? "Updating..." : "Confirm Postponement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ESCALATE MODAL */}
      {showEscalateModal && selectedRisk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-2xs">
          <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-[#E7DFD5] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#1A1816]">Escalate Business Risk</h3>
                <p className="text-xs text-stone-500">
                  Notify agency executive leadership and senior advisors.
                </p>
              </div>
              <button
                onClick={() => setShowEscalateModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <FaTimes />
              </button>
            </div>

            <form
              onSubmit={handleEscalateRisk}
              className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs"
            >
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Escalation Reason *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Critical budget deficit threatening project continuation"
                  value={escalateForm.reason}
                  onChange={(e) => setEscalateForm({ ...escalateForm, reason: e.target.value })}
                  className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Escalation Level</label>
                <select
                  value={escalateForm.escalationLevel}
                  onChange={(e) =>
                    setEscalateForm({ ...escalateForm, escalationLevel: e.target.value })
                  }
                  className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                >
                  <option value="Executive Committee">Executive Committee</option>
                  <option value="Senior Managing Partner">Senior Managing Partner</option>
                  <option value="Legal & Compliance Officer">Legal &amp; Compliance Officer</option>
                </select>
              </div>

              <div className="p-4 border-t border-[#E7DFD5] bg-[#FAF8F5] flex justify-end gap-3 -mx-6 -mb-6">
                <button
                  type="button"
                  onClick={() => setShowEscalateModal(false)}
                  className="px-4 py-2 border border-[#E7DFD5] rounded-xl text-stone-600 hover:bg-[#EFE9DF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition shadow-xs cursor-pointer"
                >
                  {actionLoading ? "Escalating..." : "Confirm Escalation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLVE MODAL */}
      {showResolveModal && selectedRisk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-2xs">
          <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-[#E7DFD5] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#1A1816]">Mark Risk as Resolved</h3>
                <p className="text-xs text-stone-500">Record final resolution outcome and mitigation evidence.</p>
              </div>
              <button
                onClick={() => setShowResolveModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <FaTimes />
              </button>
            </div>

            <form
              onSubmit={handleResolveRisk}
              className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs"
            >
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Resolution Summary *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Detail how the risk was mitigated and verified..."
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                />
              </div>

              <div className="p-4 border-t border-[#E7DFD5] bg-[#FAF8F5] flex justify-end gap-3 -mx-6 -mb-6">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 border border-[#E7DFD5] rounded-xl text-stone-600 hover:bg-[#EFE9DF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-xs cursor-pointer"
                >
                  {actionLoading ? "Resolving..." : "Confirm Resolution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVIEW RISK MODAL */}
      {showReviewModal && selectedRisk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-2xs">
          <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-[#E7DFD5] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#1A1816]">Start Manager Risk Review</h3>
                <p className="text-xs text-stone-500">
                  Move risk status to "Under Review" and log review notes.
                </p>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Review Assessment Notes</label>
                <textarea
                  rows={3}
                  placeholder="Record initial findings, questions for client, or risk magnitude verification..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full bg-[#FBF9F5] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="px-4 py-2 border border-[#E7DFD5] rounded-xl text-stone-600 hover:bg-[#EFE9DF]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReviewRisk}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition shadow-xs cursor-pointer"
                >
                  {actionLoading ? "Saving..." : "Begin Review"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT LOGS MODAL (Requirement 8 & 9) */}
      {showAuditModal && selectedRisk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-2xs">
          <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-[#E7DFD5] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#1A1816] flex items-center gap-2">
                  <FaHistory className="text-[#8C6D37]" /> Complete Audit Trail &amp; Version History
                </h3>
                <p className="text-xs text-stone-500">
                  Risk: <strong>{selectedRisk.title}</strong> ({selectedRisk.riskId})
                </p>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <FaTimes />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar text-xs">
              {auditLogs.length === 0 ? (
                <p className="text-stone-400 italic text-center py-8">No audit logs recorded.</p>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log._id}
                    className="p-3 bg-[#FAF8F5] border border-[#E7DFD5] rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-[#8C6D37] bg-[#F2EDE4] px-2 py-0.5 rounded border border-[#E0D7C9]">
                        {log.action}
                      </span>
                      <span className="font-mono text-[10px] text-stone-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="font-semibold text-stone-900 text-xs">
                      Performer: {log.performerName} ({log.performerRole})
                    </p>
                    <div className="text-[11px] text-stone-600 flex items-center gap-2">
                      <span>Status transition:</span>
                      <span className="font-mono font-semibold text-stone-800">
                        {log.previousStatus || "Start"} → {log.newStatus || "Updated"}
                      </span>
                      {log.version && (
                        <span className="font-mono text-[10px] bg-stone-200 px-1 rounded">
                          v{log.version}.0
                        </span>
                      )}
                    </div>
                    {log.notes && <p className="text-stone-500 italic mt-0.5">{log.notes}</p>}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-[#E7DFD5] bg-[#FAF8F5] flex justify-end">
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-2 bg-[#9C7A42] text-white rounded-xl font-bold text-xs"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
