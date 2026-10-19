import React, { useCallback, useEffect, useRef, useState } from "react";
import api from "../../utils/axios";
import LeadImportModal from "./LeadImportModal";
import {
  FaUser,
  FaPhone,
  FaEnvelope,
  FaPlus,
  FaCommentDots,
  FaCheck,
  FaFilter,
  FaTag,
  FaEdit,
  FaFileUpload,
  FaSearch,
} from "react-icons/fa";

const DEFAULT_SOURCES = ["Meta Ads", "Google Ads", "Website Enquiry", "Instagram DM", "Walk-in", "Referral", "Other"];
const DEFAULT_STATUSES = ["New", "Contacted", "Qualified", "Converted", "Lost"];
const inr = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const todayInput = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const emptyForm = () => ({ name: "", phone: "", email: "", source: "Meta Ads", campaign: "", enquiryDate: todayInput(), estimatedValue: "", status: "New", noteText: "" });

const PAGE_SIZE = 100;
const FILTER_STATUS = { ALL: "", NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified", CONVERTED: "Converted", LOST: "Lost" };

const UNAVAILABLE = <span className="font-sans text-[10px] text-stone-400" title="No visit or transaction records for this customer">Data unavailable</span>;
const shortDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });

/** Customer columns: actual visits, enquiries, spending, last visit, New/Returning. */
function CustomerCells({ c }) {
  const scope = c?.scope === "lifetime" ? "Lifetime total from the imported customer list" : c?.dataSource === "POS sales" ? "From POS sales records" : "";
  return (
    <>
      <td className="py-3 px-3 text-right font-mono text-stone-800" title={scope}>{c && c.visits != null ? c.visits.toLocaleString("en-IN") : UNAVAILABLE}</td>
      <td className="py-3 px-3 text-right font-mono text-stone-800">{c ? c.enquiries.toLocaleString("en-IN") : "—"}</td>
      <td className="py-3 px-3 text-right font-mono font-semibold text-stone-800" title={scope}>{c && c.spent != null ? inr(c.spent) : UNAVAILABLE}</td>
      <td className="py-3 px-3 font-mono text-[11px] text-stone-500">{c && c.lastVisit ? shortDate(c.lastVisit) : UNAVAILABLE}</td>
      <td className="py-3 px-3">
        {c && c.type ? (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.type === "Returning" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-sky-50 text-sky-800 border-sky-200"}`}>{c.type}</span>
        ) : (
          UNAVAILABLE
        )}
      </td>
    </>
  );
}

export default function LeadsPipelineTab({ leadsData, onRefresh, clientId = "", advancedParams = null, customerParams = null }) {
  // Manager Portal advanced filters/sort (source, segment, value, date, status, sort)
  const advKey = JSON.stringify(advancedParams || {});
  // Customer Insights (one row per customer) when set; otherwise one row per enquiry
  const custKey = customerParams ? JSON.stringify(customerParams) : "";
  const canEdit = true; // clients (own enquiries), assigned managers and admins; the server enforces ownership
  // The list is paged/filtered on the server (customer imports can hold thousands of rows)
  const [data, setData] = useState(leadsData || null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const leads = data?.leads || [];
  const counts = data?.counts || {};
  const values = data?.values || null;
  const pageInfo = data?.page || null;
  const sources = data?.options?.sources || DEFAULT_SOURCES;
  const statuses = data?.options?.statuses || DEFAULT_STATUSES;
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | lead
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [selectedLead, setSelectedLead] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const filteredLeads = leads; // already filtered by the server

  const reqId = useRef(0);
  const reload = useCallback(async () => {
    const id = ++reqId.current;
    try {
      setLoadingList(true);
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (clientId) params.set("clientId", clientId);
      const adv = custKey ? JSON.parse(custKey) : JSON.parse(advKey);
      Object.entries(adv).forEach(([k, v]) => {
        if (v !== "" && v != null && k !== "status") params.set(k, String(v));
      });
      // a status button wins; otherwise the advanced status filter applies
      if (FILTER_STATUS[activeFilter]) params.set("status", FILTER_STATUS[activeFilter]);
      else if (adv.status) params.set("status", adv.status);
      if (query) params.set("q", query);
      const res = await api.get(`/portal/leads${custKey ? "/customers" : ""}?${params.toString()}`);
      // the customer view has no per-status counts: keep the ones already shown
      if (id === reqId.current)
        setData((prev) => ({ ...res.data, counts: res.data.counts || prev?.counts, values: res.data.values ?? prev?.values, options: res.data.options || prev?.options }));
    } catch (err) {
      if (id === reqId.current) setError(err.response?.data?.message || "Could not load enquiries.");
    } finally {
      if (id === reqId.current) setLoadingList(false);
    }
  }, [clientId, activeFilter, query, page, advKey, custKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  // new advanced filters start again at page 1
  useEffect(() => {
    setPage(1);
  }, [advKey, custKey]);

  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setQuery(search.trim());
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const afterChange = () => {
    reload();
    if (onRefresh) onRefresh();
  };
  const pickFilter = (f) => {
    setActiveFilter(f);
    setPage(1);
  };

  const handleUpdateStatus = async (leadId, newStatus) => {
    try {
      setIsUpdating(true);
      setError("");
      await api.put(`/portal/leads/${leadId}`, { status: newStatus });
      afterChange();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update the stage. Please try again.");
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
      afterChange();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save the note. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const openForm = (lead) => {
    setFormError("");
    if (lead === "new") {
      setForm(emptyForm());
    } else {
      setForm({
        name: lead.name || "",
        phone: lead.phone || "",
        email: lead.email || "",
        source: lead.source || "Other",
        campaign: lead.campaign || "",
        enquiryDate: lead.enquiryDate ? new Date(lead.enquiryDate).toISOString().slice(0, 10) : todayInput(),
        estimatedValue: lead.estimatedValue ? String(lead.estimatedValue) : "",
        status: lead.status || "New",
        noteText: "",
      });
    }
    setEditing(lead);
  };

  const saveForm = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) return setFormError("Customer name is required.");
    const value = form.estimatedValue === "" ? 0 : Number(form.estimatedValue);
    if (!Number.isFinite(value) || value < 0) return setFormError("Estimated value must be 0 or more.");
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      source: form.source,
      campaign: form.campaign.trim(),
      enquiryDate: form.enquiryDate,
      estimatedValue: value,
      status: form.status,
      ...(form.noteText.trim() ? { noteText: form.noteText.trim() } : {}),
    };
    try {
      setIsUpdating(true);
      if (editing === "new") {
        await api.post(`/portal/leads${clientId ? `?clientId=${clientId}` : ""}`, payload);
      } else {
        await api.put(`/portal/leads/${editing._id}`, payload);
      }
      setEditing(null);
      afterChange();
    } catch (err) {
      setFormError(err.response?.data?.message || "Could not save the enquiry. Please try again.");
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
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-white hover:bg-stone-50 text-stone-800 border border-[#E0D8CE] rounded-lg cursor-pointer"
              >
                <FaFileUpload className="w-3 h-3 text-[#9C7A42]" />
                Import CSV / Excel
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => openForm("new")}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#1A1A1A] hover:bg-stone-800 text-white rounded-lg cursor-pointer"
              >
                <FaPlus className="w-3 h-3 text-[#D4AF37]" />
                Add enquiry
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="font-bold cursor-pointer" aria-label="Dismiss">×</button>
        </div>
      )}

      {values && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ["Open pipeline value", values.pipeline, "New, contacted & qualified"],
            ["Converted value", values.converted, `${counts.converted || 0} converted enquir${counts.converted === 1 ? "y" : "ies"}`],
            ["Lost value", values.lost, `${counts.lost || 0} lost`],
            ["Total estimated value", values.total, `${counts.total || 0} enquiries`],
          ].map(([label, v, sub]) => (
            <div key={label} className="bg-white border border-[#E7DFD5] rounded-xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">{label}</p>
              <p className="text-lg font-bold font-mono text-stone-900 mt-1">{inr(v)}</p>
              <p className="text-[11px] text-stone-500 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Pipeline Status Filter Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => pickFilter("ALL")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeFilter === "ALL"
              ? "bg-[#1A1A1A] text-white"
              : "bg-white text-stone-700 border border-[#E7DFD5] hover:bg-stone-50"
          }`}
        >
          All ({counts.total || 0})
        </button>

        <button
          onClick={() => pickFilter("NEW")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeFilter === "NEW"
              ? "bg-amber-800 text-white"
              : "bg-white text-amber-900 border border-amber-200 hover:bg-amber-50"
          }`}
        >
          New ({counts.new || 0})
        </button>

        <button
          onClick={() => pickFilter("CONTACTED")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeFilter === "CONTACTED"
              ? "bg-blue-800 text-white"
              : "bg-white text-blue-900 border border-blue-200 hover:bg-blue-50"
          }`}
        >
          Contacted ({counts.contacted || 0})
        </button>

        <button
          onClick={() => pickFilter("QUALIFIED")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeFilter === "QUALIFIED"
              ? "bg-indigo-800 text-white"
              : "bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-50"
          }`}
        >
          Qualified ({counts.qualified || 0})
        </button>

        <button
          onClick={() => pickFilter("CONVERTED")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeFilter === "CONVERTED"
              ? "bg-emerald-800 text-white"
              : "bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-50"
          }`}
        >
          Converted ({counts.converted || 0})
        </button>

        <button
          onClick={() => pickFilter("LOST")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeFilter === "LOST"
              ? "bg-rose-800 text-white"
              : "bg-white text-rose-900 border border-rose-200 hover:bg-rose-50"
          }`}
        >
          Lost ({counts.lost || 0})
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <label className="relative w-full sm:w-80">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-stone-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email or segment"
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[#E0D8CE] bg-white focus:outline-hidden focus:border-[#9C7A42]"
          />
        </label>
        {pageInfo && (
          <span className="text-[11px] text-stone-500">
            {loadingList ? "Loading…" : `${pageInfo.matching.toLocaleString("en-IN")} matching · page ${pageInfo.page} of ${pageInfo.pages}`}
          </span>
        )}
      </div>

      {/* Leads Table */}
      <div className="bg-white border border-[#E7DFD5] rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF7F2] text-stone-600 font-semibold border-b border-[#E7DFD5] uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Customer Name & Contact</th>
                <th className="py-3 px-3 text-right">Total Visits</th>
                <th className="py-3 px-3 text-right">Total Enquiries</th>
                <th className="py-3 px-3 text-right">Total Actual Spending</th>
                <th className="py-3 px-3">Last Visit</th>
                <th className="py-3 px-3">Customer Type</th>
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

                  <CustomerCells c={lead.customer} />

                  <td className="py-3 px-3">
                    {lead.source ? (
                      <span className="font-medium text-stone-700 bg-stone-100 px-2 py-0.5 rounded text-[11px]">
                        {lead.source}
                      </span>
                    ) : (
                      <span className="text-[11px] text-stone-400">POS customer</span>
                    )}
                    {lead.campaign && (
                      <div className="text-[10px] text-stone-400 mt-0.5 truncate max-w-[140px]">
                        {lead.campaign}
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-3 text-stone-500 font-mono text-[11px]">
                    {lead.enquiryDate
                      ? new Date(lead.enquiryDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
                      : "—"}
                  </td>

                  <td className="py-3 px-3 font-mono font-semibold text-stone-800">
                    {lead.estimatedValue > 0 ? inr(lead.estimatedValue) : "—"}
                  </td>

                  <td className="py-3 px-3">
                    {lead.noEnquiry ? (
                      <span className="text-[11px] text-stone-400">No enquiry</span>
                    ) : (
                    <select
                      value={lead.status}
                      disabled={isUpdating}
                      onChange={(e) => handleUpdateStatus(lead._id, e.target.value)}
                      className={`text-[11px] font-semibold py-1 px-2 rounded-md border cursor-pointer focus:outline-hidden ${getStatusBadge(
                        lead.status
                      )}`}
                    >
                      {statuses.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {lead.noEnquiry ? (
                      <span className="text-[11px] text-stone-400" title="Known from POS sales only — add an enquiry to track them here">—</span>
                    ) : (
                    <>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openForm(lead)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 mr-1.5 text-[11px] font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 rounded border border-stone-200 cursor-pointer"
                      >
                        <FaEdit className="w-3 h-3 text-[#9C7A42]" />
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedLead(lead)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 rounded border border-stone-200 cursor-pointer"
                    >
                      <FaCommentDots className="w-3 h-3 text-[#9C7A42]" />
                      Notes ({lead.notes?.length || 0})
                    </button>
                    </>
                    )}
                  </td>
                </tr>
              ))}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 px-4 text-center text-xs text-stone-500">
                    {counts.total ? "No enquiries match this filter." : "No enquiries recorded yet."}
                    {canEdit && !counts.total && (
                      <button type="button" onClick={() => openForm("new")} className="ml-2 underline font-semibold text-stone-800 cursor-pointer">
                        Add the first enquiry
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      {pageInfo && pageInfo.pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <button type="button" disabled={page <= 1 || loadingList} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-[#E0D8CE] bg-white disabled:opacity-40 cursor-pointer">
            Previous
          </button>
          <span className="text-stone-600">
            Page {pageInfo.page} of {pageInfo.pages}
          </span>
          <button type="button" disabled={page >= pageInfo.pages || loadingList} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-[#E0D8CE] bg-white disabled:opacity-40 cursor-pointer">
            Next
          </button>
        </div>
      )}

      {showImport && (
        <LeadImportModal
          clientId={clientId}
          sources={sources}
          onClose={() => setShowImport(false)}
          onImported={() => {
            pickFilter("ALL");
            afterChange();
          }}
        />
      )}
      </div>

      {/* Add / Edit Enquiry Modal (agency team) */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={saveForm} className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-[#E7DFD5] space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <h4 className="font-serif text-base font-bold text-stone-900">{editing === "new" ? "Add enquiry" : `Edit enquiry • ${editing.name}`}</h4>
              <button type="button" onClick={() => setEditing(null)} className="text-stone-400 hover:text-stone-700 text-lg cursor-pointer font-bold" aria-label="Close">&times;</button>
            </div>
            {formError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">{formError}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block sm:col-span-2">
                <span className="block font-semibold text-stone-700 mb-1">Customer name *</span>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full p-2.5 rounded-lg border border-[#E0D8CE]" />
              </label>
              <label className="block">
                <span className="block font-semibold text-stone-700 mb-1">Phone</span>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full p-2.5 rounded-lg border border-[#E0D8CE]" />
              </label>
              <label className="block">
                <span className="block font-semibold text-stone-700 mb-1">Email</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full p-2.5 rounded-lg border border-[#E0D8CE]" />
              </label>
              <label className="block">
                <span className="block font-semibold text-stone-700 mb-1">Source</span>
                <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full p-2.5 rounded-lg border border-[#E0D8CE]">
                  {sources.map((src) => (
                    <option key={src} value={src}>{src}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block font-semibold text-stone-700 mb-1">Campaign</span>
                <input value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} className="w-full p-2.5 rounded-lg border border-[#E0D8CE]" />
              </label>
              <label className="block">
                <span className="block font-semibold text-stone-700 mb-1">Enquiry date</span>
                <input type="date" value={form.enquiryDate} onChange={(e) => setForm({ ...form, enquiryDate: e.target.value })} className="w-full p-2.5 rounded-lg border border-[#E0D8CE]" />
              </label>
              <label className="block">
                <span className="block font-semibold text-stone-700 mb-1">Est. value / charge (₹)</span>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} className="w-full p-2.5 rounded-lg border border-[#E0D8CE]" />
              </label>
              <label className="block">
                <span className="block font-semibold text-stone-700 mb-1">Stage</span>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full p-2.5 rounded-lg border border-[#E0D8CE]">
                  {statuses.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="block font-semibold text-stone-700 mb-1">{editing === "new" ? "First note (optional)" : "Add a note (optional)"}</span>
                <textarea rows={2} value={form.noteText} onChange={(e) => setForm({ ...form, noteText: e.target.value })} className="w-full p-2.5 rounded-lg border border-[#E0D8CE]" />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-3 py-1.5 text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer">Cancel</button>
              <button type="submit" disabled={isUpdating} className="px-4 py-1.5 font-semibold bg-[#1A1A1A] hover:bg-stone-800 text-white rounded-lg cursor-pointer disabled:opacity-50">
                {isUpdating ? "Saving…" : editing === "new" ? "Add enquiry" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

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
