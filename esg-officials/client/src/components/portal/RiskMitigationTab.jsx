import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import api from "../../utils/axios";
import {
  FaShieldAlt,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaEye,
  FaCheck,
  FaTimes,
  FaExchangeAlt,
  FaCalendarAlt,
  FaHistory,
} from "react-icons/fa";

export default function RiskMitigationTab({ clientId }) {
  const { user } = useContext(AuthContext);

  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Decision Modal State
  const [selectedRisk, setSelectedRisk] = useState(null);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decisionType, setDecisionType] = useState("Approved"); // 'Approved' | 'Rejected' | 'Request Changes'
  const [decisionNotes, setDecisionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Live timer tick
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchClientRisks();
  }, [clientId]);

  const fetchClientRisks = async () => {
    try {
      setLoading(true);
      const params = {};
      if (clientId) params.client = clientId;
      const res = await api.get("/risks", { params });
      setRisks(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching client risks:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRisk) return;
    setSubmitting(true);
    setFeedbackMessage(null);
    try {
      const res = await api.put(`/risks/${selectedRisk._id}/decide`, {
        decision: decisionType,
        decisionNotes,
      });
      setFeedbackMessage({
        type: "success",
        text: `Successfully recorded your decision: ${decisionType}.`,
      });
      setDecisionModalOpen(false);
      setDecisionNotes("");
      setSelectedRisk(null);
      fetchClientRisks();
    } catch (err) {
      setFeedbackMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to submit decision.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Live Countdown String calculation
  const getCountdownString = (deadline) => {
    if (!deadline) return "24h policy active";
    const diff = new Date(deadline).getTime() - now.getTime();
    if (diff <= 0) return "Auto-approved after 24 hours";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return `Auto-approval in ${hours}h ${mins}m ${secs}s`;
  };

  const pendingRisks = risks.filter((r) => r.status === "Pending Client Approval");
  const decidedRisks = risks.filter((r) => r.status !== "Pending Client Approval");

  return (
    <div className="space-y-6">
      {/* =========================================================
          1. MANDATORY EXACT 24-HOUR NOTICE DISCLOSURE
      ========================================================= */}
      <div className="bg-[#FAF7F2] border-2 border-[#D4AF37]/50 rounded-2xl p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/60 flex items-center justify-center text-[#9C7A42]">
            <FaClock className="text-sm" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-sm text-[#1A1816] tracking-tight">
              Notice: 24-Hour Automated Approval Policy
            </h3>
            <p className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">
              Official Client Governance Protocol
            </p>
          </div>
        </div>

        {/* EXACT REQUIRED STRING */}
        <div className="p-4 bg-white rounded-xl border border-[#E7DFD5] text-xs text-[#2D2A26] font-serif leading-relaxed shadow-2xs">
          <p className="font-semibold text-stone-900">
            "Please review this proposed risk mitigation plan within 24 hours. If no decision is received within 24 hours of submission, the plan will be automatically approved according to the applicable approval policy."
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-stone-500 pt-1">
          <span>• Applies to eligible proposed mitigation roadmaps</span>
          <span>• Live timers update continuously</span>
          <span>• Manual decision can be submitted anytime before expiry</span>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
            feedbackMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button onClick={() => setFeedbackMessage(null)} className="text-xs">
            ✕
          </button>
        </div>
      )}

      {/* =========================================================
          2. PENDING PROPOSALS AWAITING CLIENT ACTION
      ========================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-serif font-bold text-[#1A1816] flex items-center gap-2">
            <FaShieldAlt className="text-[#9C7A42]" />
            Proposed Mitigation Plans Awaiting Your Approval ({pendingRisks.length})
          </h2>
          <span className="text-xs font-mono text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 font-semibold">
            Action Requested
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center bg-white rounded-2xl border border-[#E7DFD5]">
            <div className="w-8 h-8 border-3 border-[#9C7A42]/30 border-t-[#9C7A42] rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs font-mono text-stone-500">Checking pending mitigation proposals...</p>
          </div>
        ) : pendingRisks.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-[#E7DFD5] space-y-2">
            <FaCheckCircle className="text-3xl text-emerald-600 mx-auto" />
            <h3 className="font-serif font-bold text-sm text-[#1A1816]">
              All proposed mitigations are up to date!
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              There are currently no risk mitigation plans awaiting your approval. Any new proposals submitted by your Account Manager will appear here with an active 24-hour review window.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pendingRisks.map((risk) => {
              const countdown = getCountdownString(risk.approvalDeadline);
              return (
                <div
                  key={risk._id}
                  className="bg-white border-2 border-purple-200 rounded-2xl p-6 shadow-sm space-y-4 hover:border-purple-300 transition"
                >
                  {/* Top Bar with Live Countdown Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-100">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#9C7A42] bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#E7DFD5]">
                        {risk.riskId}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          risk.severity === "Critical"
                            ? "bg-rose-100 text-rose-800 border-rose-300"
                            : risk.severity === "High"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-blue-100 text-blue-800 border-blue-200"
                        }`}
                      >
                        {risk.severity} Severity
                      </span>
                      {risk.mitigationPlan?.version && (
                        <span className="text-[10px] font-mono text-stone-400">
                          v{risk.mitigationPlan.version}.0
                        </span>
                      )}
                    </div>

                    {/* LIVE COUNTDOWN */}
                    <div className="flex items-center gap-2 bg-purple-50 text-purple-900 border border-purple-200 px-3 py-1 rounded-xl">
                      <FaClock className="text-xs animate-spin" />
                      <span className="font-mono text-xs font-bold tracking-tight">
                        {countdown}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-serif font-bold text-[#1A1816]">
                      {risk.title}
                    </h3>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      {risk.description}
                    </p>
                  </div>

                  {/* Potential Impact */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#FAF8F5] p-3 rounded-xl border border-[#E7DFD5]">
                    <div>
                      <span className="text-[10px] font-mono text-stone-400 uppercase font-semibold">
                        Potential Financial Impact
                      </span>
                      <p className="font-mono font-bold text-stone-900 mt-0.5">
                        {risk.financialImpactAmount
                          ? `₹${Number(risk.financialImpactAmount).toLocaleString("en-IN")}`
                          : risk.financialImpact || "Unspecified"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-stone-400 uppercase font-semibold">
                        Business Impact Context
                      </span>
                      <p className="text-stone-800 mt-0.5">
                        {risk.businessImpact || "Operational integrity risk."}
                      </p>
                    </div>
                  </div>

                  {/* Proposed Mitigation Plan (Manager's plan) */}
                  <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E7DFD5] space-y-2">
                    <span className="text-[10px] font-mono text-[#9C7A42] uppercase font-bold tracking-wider">
                      Manager's Proposed Mitigation Plan
                    </span>
                    <h4 className="font-serif font-bold text-stone-900 text-sm">
                      {risk.mitigationPlan?.title || "Mitigation Roadmap"}
                    </h4>
                    <p className="text-xs text-stone-700 leading-relaxed bg-white p-3 rounded-lg border border-[#E7DFD5]">
                      {risk.mitigationPlan?.proposedAction || "Mitigation steps submitted for client signoff."}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-stone-500 pt-1">
                      <span>
                        Estimated Window:{" "}
                        <strong className="text-stone-800">
                          {risk.mitigationPlan?.estimatedResolutionDays || 14} days
                        </strong>
                      </span>
                      {risk.mitigationPlan?.estimatedCost && (
                        <span>
                          Estimated Budget:{" "}
                          <strong className="text-stone-800">
                            ₹{Number(risk.mitigationPlan.estimatedCost).toLocaleString("en-IN")}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Postponement details if applicable (Requirement 4) */}
                  {risk.isPostponed && risk.postponementHistory?.length > 0 && (
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px]">
                        <FaCalendarAlt className="text-amber-700" /> Rescheduled Timeline Notice
                      </div>
                      <p className="text-amber-900">
                        Reason for Postponement:{" "}
                        <strong>
                          {risk.postponementHistory[risk.postponementHistory.length - 1].reason}
                        </strong>
                      </p>
                      {risk.proposedReviewDate && (
                        <p className="font-mono text-stone-700 text-[11px]">
                          Proposed Revised Review Date:{" "}
                          <strong>{new Date(risk.proposedReviewDate).toLocaleString()}</strong>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Submission and Deadline Timestamps */}
                  <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-stone-400 pt-2 border-t border-stone-100">
                    <span>
                      Submitted:{" "}
                      {risk.submittedForApprovalAt
                        ? new Date(risk.submittedForApprovalAt).toLocaleString()
                        : "Recently"}
                    </span>
                    <span className="text-purple-800 font-semibold">
                      Auto-approval Deadline:{" "}
                      {risk.approvalDeadline
                        ? new Date(risk.approvalDeadline).toLocaleString()
                        : "In 24 hours"}
                    </span>
                  </div>

                  {/* CLIENT ACTIONS: Approve, Reject, Request Changes, View Details */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setSelectedRisk(risk)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-100 transition"
                    >
                      <FaEye className="inline mr-1" /> View Full Details
                    </button>

                    <button
                      onClick={() => {
                        setSelectedRisk(risk);
                        setDecisionType("Request Changes");
                        setDecisionModalOpen(true);
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FAF8F5] hover:bg-[#F2EDE4] text-amber-900 border border-amber-300 transition cursor-pointer"
                    >
                      <FaExchangeAlt className="inline mr-1" /> Request Changes
                    </button>

                    <button
                      onClick={() => {
                        setSelectedRisk(risk);
                        setDecisionType("Rejected");
                        setDecisionModalOpen(true);
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 transition cursor-pointer"
                    >
                      <FaTimes className="inline mr-1" /> Reject Plan
                    </button>

                    <button
                      onClick={() => {
                        setSelectedRisk(risk);
                        setDecisionType("Approved");
                        setDecisionModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition cursor-pointer"
                    >
                      <FaCheck className="inline mr-1" /> Approve Plan
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================
          3. DECIDED / HISTORICAL MITIGATION PLANS
      ========================================================= */}
      {decidedRisks.length > 0 && (
        <div className="space-y-4 pt-6">
          <h2 className="text-lg font-serif font-bold text-[#1A1816]">
            Historical Decisions &amp; Approved Roadmaps ({decidedRisks.length})
          </h2>

          <div className="grid grid-cols-1 gap-3">
            {decidedRisks.map((risk) => (
              <div
                key={risk._id}
                className="bg-white border border-[#E7DFD5] rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[#9C7A42] bg-[#FAF7F2] px-1.5 py-0.5 rounded border border-[#E7DFD5]">
                      {risk.riskId}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        risk.isAutoApproved
                          ? "bg-indigo-100 text-indigo-800 border-indigo-300"
                          : risk.status === "Approved"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : risk.status === "Resolved"
                          ? "bg-teal-100 text-teal-800 border-teal-300"
                          : "bg-rose-100 text-rose-800 border-rose-300"
                      }`}
                    >
                      {risk.isAutoApproved ? "Auto-approved after 24 hours" : risk.status}
                    </span>
                  </div>
                  <h4 className="font-serif font-bold text-stone-900 text-sm mt-1">
                    {risk.title}
                  </h4>
                  <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
                    {risk.mitigationPlan?.proposedAction || risk.description}
                  </p>
                </div>

                <div className="text-right whitespace-nowrap text-xs">
                  <p className="font-mono text-stone-500">
                    {risk.decisionAt
                      ? `Decided ${new Date(risk.decisionAt).toLocaleDateString()}`
                      : "Completed"}
                  </p>
                  <button
                    onClick={() => setSelectedRisk(risk)}
                    className="mt-1 text-xs text-[#9C7A42] hover:underline font-semibold"
                  >
                    View Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================
          4. DECISION SUBMISSION MODAL
      ========================================================= */}
      {decisionModalOpen && selectedRisk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-150 text-xs">
            <h3 className="font-serif font-bold text-base text-[#1A1816]">
              Confirm Mitigation Decision:{" "}
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

            <p className="text-stone-600">
              Risk: <strong>{selectedRisk.title}</strong> ({selectedRisk.riskId})
            </p>

            <form onSubmit={handleDecisionSubmit} className="space-y-4">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  {decisionType === "Approved"
                    ? "Approval Remarks (Optional)"
                    : "Reason for Rejection or Requested Changes *"}
                </label>
                <textarea
                  required={decisionType !== "Approved"}
                  rows={3}
                  placeholder={
                    decisionType === "Approved"
                      ? "Add any comments for the assigned Account Manager..."
                      : "Please explain what needs to be revised or improved in the mitigation roadmap..."
                  }
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl px-3 py-2 text-xs text-[#1A1816] focus:outline-hidden focus:border-[#9C7A42]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDecisionModalOpen(false)}
                  className="px-4 py-2 border border-[#E7DFD5] rounded-xl text-stone-600 hover:bg-[#F2EDE4]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2 text-white rounded-xl font-bold transition shadow-xs cursor-pointer ${
                    decisionType === "Approved"
                      ? "bg-emerald-700 hover:bg-emerald-800"
                      : decisionType === "Rejected"
                      ? "bg-rose-700 hover:bg-rose-800"
                      : "bg-amber-700 hover:bg-amber-800"
                  }`}
                >
                  {submitting ? "Submitting..." : `Submit ${decisionType}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL DETAILS MODAL */}
      {selectedRisk && !decisionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-2xs">
          <div className="bg-[#FFFFFF] border border-[#E7DFD5] rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150 text-xs">
            <div className="p-5 border-b border-[#E7DFD5] bg-[#FAF8F5] flex items-start justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-[#9C7A42]">
                  {selectedRisk.riskId} • {selectedRisk.category}
                </span>
                <h3 className="font-serif font-bold text-base text-[#1A1816] mt-0.5">
                  {selectedRisk.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRisk(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar text-stone-700">
              <div>
                <span className="font-mono text-[10px] text-stone-400 uppercase font-semibold">
                  Risk Description
                </span>
                <p className="mt-0.5">{selectedRisk.description}</p>
              </div>

              <div>
                <span className="font-mono text-[10px] text-stone-400 uppercase font-semibold">
                  Manager Proposed Mitigation Action
                </span>
                <p className="mt-0.5 p-3 bg-[#FAF8F5] rounded-xl border border-[#E7DFD5] leading-relaxed">
                  {selectedRisk.mitigationPlan?.proposedAction || "Plan under review."}
                </p>
              </div>

              {selectedRisk.decisionNotes && (
                <div>
                  <span className="font-mono text-[10px] text-stone-400 uppercase font-semibold">
                    Decision Remarks
                  </span>
                  <p className="mt-0.5 text-stone-900 italic">{selectedRisk.decisionNotes}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#E7DFD5] bg-[#FAF8F5] flex justify-end">
              <button
                onClick={() => setSelectedRisk(null)}
                className="px-4 py-2 bg-[#9C7A42] text-white rounded-xl font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
