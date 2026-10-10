import React, { useState } from "react";
import api from "../../utils/axios";
import {
  FaUser,
  FaPhone,
  FaEnvelope,
  FaPlus,
  FaCommentDots,
  FaCheck,
  FaFilter,
  FaTag,
} from "react-icons/fa";

export default function LeadsPipelineTab({ leadsData, onRefresh }) {
  const leads = leadsData?.leads || [];
  const counts = leadsData?.counts || {};
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [selectedLead, setSelectedLead] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const filteredLeads =
    activeFilter === "ALL"
      ? leads
      : leads.filter((l) => l.status.toUpperCase() === activeFilter);

  const handleUpdateStatus = async (leadId, newStatus) => {
    try {
      setIsUpdating(true);
      await api.put(`/portal/leads/${leadId}`, { status: newStatus });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Error updating lead status:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedLead) return;

    try {
      setIsUpdating(true);
      await api.put(`/portal/leads/${selectedLead._id}`, { noteText: newNote.trim() });
      setNewNote("");
      setSelectedLead(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Error adding note:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "Converted":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Qualified":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "Contacted":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Lost":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-amber-100 text-amber-800 border-amber-200";
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-stone-900">
              Customer Enquiries & High-Intent Leads Pipeline
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              Verified leads generated from paid campaigns, website enquiry forms, and direct social interactions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500 font-mono bg-white px-3 py-1.5 rounded-lg border border-[#E0D8CE]">
              Privacy Protected: Client Isolated
            </span>
          </div>
        </div>
      </div>

      {/* Pipeline Status Filter Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveFilter("ALL")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeFilter === "ALL"
              ? "bg-[#1A1A1A] text-white"
              : "bg-white text-stone-700 border border-[#E7DFD5] hover:bg-stone-50"
          }`}
        >
          All ({counts.total || 0})
        </button>

        <button
          onClick={() => setActiveFilter("NEW")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeFilter === "NEW"
              ? "bg-amber-800 text-white"
              : "bg-white text-amber-900 border border-amber-200 hover:bg-amber-50"
          }`}
        >
          New ({counts.new || 0})
        </button>

        <button
          onClick={() => setActiveFilter("CONTACTED")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeFilter === "CONTACTED"
              ? "bg-blue-800 text-white"
              : "bg-white text-blue-900 border border-blue-200 hover:bg-blue-50"
          }`}
        >
          Contacted ({counts.contacted || 0})
        </button>

        <button
          onClick={() => setActiveFilter("QUALIFIED")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeFilter === "QUALIFIED"
              ? "bg-indigo-800 text-white"
              : "bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-50"
          }`}
        >
          Qualified ({counts.qualified || 0})
        </button>

        <button
          onClick={() => setActiveFilter("CONVERTED")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeFilter === "CONVERTED"
              ? "bg-emerald-800 text-white"
              : "bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-50"
          }`}
        >
          Converted ({counts.converted || 0})
        </button>

        <button
          onClick={() => setActiveFilter("LOST")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeFilter === "LOST"
              ? "bg-rose-800 text-white"
              : "bg-white text-rose-900 border border-rose-200 hover:bg-rose-50"
          }`}
        >
          Lost ({counts.lost || 0})
        </button>
      </div>

      {/* Leads Table */}
      <div className="bg-white border border-[#E7DFD5] rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF7F2] text-stone-600 font-semibold border-b border-[#E7DFD5] uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Customer Name & Contact</th>
                <th className="py-3 px-3">Acquisition Source</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Est. Value</th>
                <th className="py-3 px-3">Current Stage</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE9E0]">
              {filteredLeads.map((lead) => (
                <tr key={lead._id} className="hover:bg-stone-50/70 transition">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-stone-900">{lead.name}</div>
                    <div className="text-[11px] text-stone-500 flex items-center gap-3 mt-0.5">
                      {lead.phone && (
                        <span className="flex items-center gap-1">
                          <FaPhone className="w-2.5 h-2.5" /> {lead.phone}
                        </span>
                      )}
                      {lead.email && (
                        <span className="flex items-center gap-1">
                          <FaEnvelope className="w-2.5 h-2.5" /> {lead.email}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <span className="font-medium text-stone-700 bg-stone-100 px-2 py-0.5 rounded text-[11px]">
                      {lead.source}
                    </span>
                    {lead.campaign && (
                      <div className="text-[10px] text-stone-400 mt-0.5 truncate max-w-[140px]">
                        {lead.campaign}
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-3 text-stone-500 font-mono text-[11px]">
                    {new Date(lead.enquiryDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>

                  <td className="py-3 px-3 font-mono font-semibold text-stone-800">
                    {lead.estimatedValue > 0 ? `₹${lead.estimatedValue.toLocaleString("en-IN")}` : "—"}
                  </td>

                  <td className="py-3 px-3">
                    <select
                      value={lead.status}
                      disabled={isUpdating}
                      onChange={(e) => handleUpdateStatus(lead._id, e.target.value)}
                      className={`text-[11px] font-semibold py-1 px-2 rounded-md border cursor-pointer focus:outline-hidden ${getStatusBadge(
                        lead.status
                      )}`}
                    >
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Converted">Converted</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedLead(lead)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 rounded border border-stone-200 cursor-pointer"
                    >
                      <FaCommentDots className="w-3 h-3 text-[#9C7A42]" />
                      Notes ({lead.notes?.length || 0})
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-[#E7DFD5]">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-serif text-base font-bold text-stone-900">
                  Follow-up Notes • {selectedLead.name}
                </h4>
                <p className="text-xs text-stone-500 mt-0.5">
                  Source: {selectedLead.source} | Stage: {selectedLead.status}
                </p>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-stone-400 hover:text-stone-700 text-lg cursor-pointer font-bold"
              >
                &times;
              </button>
            </div>

            {/* Existing notes */}
            <div className="max-h-48 overflow-y-auto space-y-2 mb-4 pr-1">
              {selectedLead.notes && selectedLead.notes.length > 0 ? (
                selectedLead.notes.map((n, i) => (
                  <div key={i} className="p-2.5 bg-stone-50 rounded-lg text-xs border border-stone-200">
                    <p className="text-stone-800">{n.text}</p>
                    <span className="text-[10px] text-stone-400 mt-1 block">
                      Added by {n.author} • {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-stone-400 italic py-2">No notes recorded yet.</div>
              )}
            </div>

            {/* Add note input */}
            <form onSubmit={handleAddNote} className="space-y-3">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Enter client conversation notes or follow-up details..."
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border border-[#E0D8CE] focus:border-[#9C7A42] focus:outline-hidden"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLead(null)}
                  className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newNote.trim() || isUpdating}
                  className="px-4 py-1.5 text-xs font-semibold bg-[#1A1A1A] hover:bg-stone-800 text-white rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
