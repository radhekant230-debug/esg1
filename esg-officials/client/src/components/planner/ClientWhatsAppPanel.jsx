import React, { useState, useEffect, useMemo, useRef } from "react";
import api from "../../utils/axios";
import {
  FaWhatsapp,
  FaSearch,
  FaEdit,
  FaCheckCircle,
  FaExclamationTriangle,
  FaPhoneAlt,
  FaPaperPlane,
  FaBuilding,
  FaSync,
  FaExternalLinkAlt,
  FaCopy,
} from "react-icons/fa";

const QUICK_TEMPLATES = [
  {
    label: "Monthly Report Ready",
    text: "Hi {name}, your monthly brand performance & marketing report is now ready for review on the ESG Officials portal. Please log in to review the verified metrics. Let us know if you have any questions!",
  },
  {
    label: "Scheduled Upload Reminder",
    text: "Hello {name}, this is a quick reminder regarding your scheduled content upload for tomorrow. Please review and provide your approval on your ESG Officials client dashboard.",
  },
  {
    label: "Strategy Review Call",
    text: "Hi {name}, hope you're having a productive week! Would you be available for a brief strategy & performance review call to discuss upcoming campaigns?",
  },
  {
    label: "General Portal Update",
    text: "Hi {name}, our agency team has posted new updates to your ESG Officials client workspace. Please check your dashboard for the latest details. Have a great day!",
  },
];

const COMMON_COUNTRY_CODES = [
  { code: "+91", label: "+91 (India)" },
  { code: "+1", label: "+1 (USA / Canada)" },
  { code: "+44", label: "+44 (United Kingdom)" },
  { code: "+971", label: "+971 (UAE)" },
  { code: "+65", label: "+65 (Singapore)" },
  { code: "+61", label: "+61 (Australia)" },
  { code: "+49", label: "+49 (Germany)" },
  { code: "+33", label: "+33 (France)" },
];

const ClientWhatsAppPanel = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all"); // 'all' | 'saved' | 'missing'

  // Add / Edit Section State
  const [selectedClientIdForEdit, setSelectedClientIdForEdit] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [formError, setFormError] = useState("");

  // Messaging Section State
  const [selectedClientIdForMsg, setSelectedClientIdForMsg] = useState("");
  const [messageText, setMessageText] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const messageComposerRef = useRef(null);
  const editFormRef = useRef(null);

  // Auto-dismiss alerts
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Load contacts on mount
  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const res = await api.get("/clients/whatsapp/contacts");
      if (res.data && res.data.contacts) {
        setContacts(res.data.contacts);
      } else {
        setContacts([]);
      }
    } catch (err) {
      console.error("Failed to load WhatsApp contacts:", err);
      setError(
        err?.response?.data?.message ||
          "Could not load client contacts. Please ensure you are logged in as an authorized manager or administrator."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Currently selected client for editing
  const selectedClientForEdit = useMemo(() => {
    return contacts.find((c) => String(c._id) === String(selectedClientIdForEdit)) || null;
  }, [contacts, selectedClientIdForEdit]);

  // When selected client for editing changes, prefill current phone if exists
  useEffect(() => {
    if (selectedClientForEdit) {
      setFormError("");
      const current = selectedClientForEdit.whatsappNumber || selectedClientForEdit.phone || "";
      if (current) {
        // Parse country code if present
        const matchedCc = COMMON_COUNTRY_CODES.find((cc) => current.startsWith(cc.code));
        if (matchedCc) {
          setCountryCode(matchedCc.code);
          setPhoneDigits(current.slice(matchedCc.code.length).replace(/\D/g, ""));
        } else if (current.startsWith("+")) {
          // generic +<digits>
          const rawDigits = current.replace(/\D/g, "");
          if (rawDigits.length > 10) {
            const ccDigits = rawDigits.slice(0, rawDigits.length - 10);
            setCountryCode(`+${ccDigits}`);
            setPhoneDigits(rawDigits.slice(rawDigits.length - 10));
          } else {
            setPhoneDigits(rawDigits);
          }
        } else {
          setPhoneDigits(current.replace(/\D/g, ""));
        }
      } else {
        setPhoneDigits("");
      }
    }
  }, [selectedClientForEdit]);

  // Currently selected client for messaging
  const selectedClientForMsg = useMemo(() => {
    return contacts.find((c) => String(c._id) === String(selectedClientIdForMsg)) || null;
  }, [contacts, selectedClientIdForMsg]);

  // Save / update phone number permanently in MongoDB
  const handleSavePhoneNumber = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!selectedClientIdForEdit) {
      setFormError("Please select an existing client from the dropdown.");
      return;
    }

    const cleanDigits = phoneDigits.replace(/\D/g, "");
    if (!cleanDigits) {
      setFormError("Please enter a valid phone number.");
      return;
    }

    if (cleanDigits.length < 7 || cleanDigits.length > 14) {
      setFormError("The phone number should be between 7 and 14 subscriber digits (standard international phone format).");
      return;
    }

    const cleanCcDigits = countryCode.replace(/\D/g, "");
    if (!cleanCcDigits) {
      setFormError("Please provide a valid country code (e.g. +91, +1, etc.).");
      return;
    }

    const fullInternationalNumber = `+${cleanCcDigits}${cleanDigits}`;

    try {
      setSavingPhone(true);
      const res = await api.put(`/clients/${selectedClientIdForEdit}/whatsapp`, {
        whatsappNumber: fullInternationalNumber,
      });

      if (res.data && res.data.success) {
        setSuccessMsg(res.data.message || "WhatsApp number saved permanently to MongoDB!");

        // Update local contacts list state
        setContacts((prev) =>
          prev.map((c) =>
            String(c._id) === String(selectedClientIdForEdit)
              ? { ...c, whatsappNumber: fullInternationalNumber, hasWhatsApp: true }
              : c
          )
        );

        // Auto-select this client in the message composer for immediate convenience
        setSelectedClientIdForMsg(selectedClientIdForEdit);
      }
    } catch (err) {
      console.error("Save phone error:", err);
      setFormError(
        err?.response?.data?.message ||
          "Failed to save WhatsApp number. Please check connection and credentials."
      );
    } finally {
      setSavingPhone(false);
    }
  };

  // Direct 1-Click WhatsApp Send
  const handleSendWhatsApp = () => {
    if (!selectedClientForMsg) {
      setError("Please select a client in the WhatsApp Message section.");
      return;
    }

    const waNum = selectedClientForMsg.whatsappNumber;
    if (!waNum) {
      setError(`Client ${selectedClientForMsg.name} does not have a saved WhatsApp number. Please save one above first.`);
      return;
    }

    if (!messageText.trim()) {
      setError("Please write a message before sending on WhatsApp.");
      return;
    }

    const cleanDigits = waNum.replace(/\D/g, "");
    if (!cleanDigits) {
      setError("Invalid phone number format for WhatsApp.");
      return;
    }

    const encodedText = encodeURIComponent(messageText.trim());
    const waUrl = `https://wa.me/${cleanDigits}?text=${encodedText}`;

    // Open WhatsApp Web or WhatsApp Desktop/Mobile app
    window.open(waUrl, "_blank", "noopener,noreferrer");

    setSuccessMsg(
      `Opening WhatsApp chat with ${selectedClientForMsg.name} (${waNum}) with your pre-filled message!`
    );
  };

  // Select client from table for editing
  const handleSelectClientForEdit = (client) => {
    setSelectedClientIdForEdit(client._id);
    if (editFormRef.current) {
      editFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Select client from table for messaging
  const handleSelectClientForMessage = (client) => {
    setSelectedClientIdForMsg(client._id);
    if (messageComposerRef.current) {
      messageComposerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Copy phone number to clipboard
  const handleCopyPhone = (clientId, phone) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedId(clientId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Apply Quick Template
  const handleApplyTemplate = (tpl) => {
    const clientName = selectedClientForMsg ? selectedClientForMsg.name.split(" ")[0] : "Client";
    const populated = tpl.text.replace(/{name}/g, clientName);
    setMessageText(populated);
  };

  // Filtered contacts list
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      // Filter tab
      if (filterType === "saved" && !c.hasWhatsApp) return false;
      if (filterType === "missing" && c.hasWhatsApp) return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const name = String(c.name || "").toLowerCase();
      const company = String(c.companyName || "").toLowerCase();
      const email = String(c.email || "").toLowerCase();
      const clientId = String(c.clientId || "").toLowerCase();
      const phone = String(c.whatsappNumber || c.phone || "").toLowerCase();

      return (
        name.includes(q) ||
        company.includes(q) ||
        email.includes(q) ||
        clientId.includes(q) ||
        phone.includes(q)
      );
    });
  }, [contacts, filterType, searchQuery]);

  const stats = useMemo(() => {
    const total = contacts.length;
    const withWa = contacts.filter((c) => c.hasWhatsApp).length;
    const missing = total - withWa;
    return { total, withWa, missing };
  }, [contacts]);

  return (
    <div className="space-y-8 animate-fadeIn font-sans">
      {/* ============================================================
          TOP HERO / BANNER
      ============================================================ */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-emerald-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-stone-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <FaWhatsapp className="text-emerald-400" />
                Client WhatsApp Contacts
              </span>
              <span className="text-xs text-stone-400 font-mono hidden sm:inline">
                • Direct Click-to-Chat (wa.me)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Client WhatsApp Contacts &amp; Direct Messaging
            </h1>
            <p className="text-stone-300 text-sm mt-1.5 max-w-2xl">
              Save permanent WhatsApp numbers in MongoDB for every client. Compose customized strategy messages and launch pre-filled direct WhatsApp chats in 1 click without requiring third-party subscriptions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => fetchContacts(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition border border-stone-700 cursor-pointer shadow-sm disabled:opacity-50"
              title="Refresh saved client numbers from MongoDB"
            >
              <FaSync className={refreshing ? "animate-spin text-emerald-400" : "text-stone-400"} />
              {refreshing ? "Syncing..." : "Refresh Contacts"}
            </button>
            <div className="flex items-center gap-2 bg-stone-950/60 border border-stone-800 px-3 py-2 rounded-xl text-xs font-mono">
              <span className="text-stone-400">Saved Numbers:</span>
              <span className="text-emerald-400 font-bold">{stats.withWa}</span>
              <span className="text-stone-500">/</span>
              <span className="text-stone-200">{stats.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-start gap-3 shadow-sm">
          <FaExclamationTriangle className="text-red-500 text-lg mt-0.5 shrink-0" />
          <div className="flex-1 text-sm text-red-800 font-medium">{error}</div>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-red-600 hover:text-red-900 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-fadeIn">
          <FaCheckCircle className="text-emerald-600 text-lg mt-0.5 shrink-0" />
          <div className="flex-1 text-sm text-emerald-900 font-medium">{successMsg}</div>
          <button
            type="button"
            onClick={() => setSuccessMsg("")}
            className="text-emerald-700 hover:text-emerald-950 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ============================================================
          TWO-COLUMN WORKSPACE:
          1. Add / Edit Client WhatsApp Number
          2. WhatsApp Message Section
      ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* ============================================================
            SECTION 1: ADD / EDIT CLIENT WHATSAPP NUMBER
        ============================================================ */}
        <div
          ref={editFormRef}
          className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-6 sm:p-7 relative transition hover:shadow-md"
        >
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center font-bold text-sm">
                <FaEdit />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedClientForEdit?.whatsappNumber ? "Edit WhatsApp Number" : "Add Client WhatsApp Number"}
                </h2>
                <p className="text-xs text-gray-500">
                  Permanent update to MongoDB client record
                </p>
              </div>
            </div>

            {selectedClientForEdit && (
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-stone-100 text-stone-700 font-semibold border border-stone-200">
                {selectedClientForEdit.clientId}
              </span>
            )}
          </div>

          <form onSubmit={handleSavePhoneNumber} className="space-y-4">
            {/* Client Selector Dropdown */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Select Client <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedClientIdForEdit}
                onChange={(e) => setSelectedClientIdForEdit(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white transition text-gray-900 font-medium"
                required
              >
                <option value="">-- Choose an existing client --</option>
                {contacts.map((client) => (
                  <option key={client._id} value={client._id}>
                    {client.name} — {client.companyName || "No Company"} ({client.clientId})
                    {client.whatsappNumber ? ` [Saved: ${client.whatsappNumber}]` : " [No WhatsApp]"}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Client Info Preview */}
            {selectedClientForEdit && (
              <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-100 text-xs space-y-1.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-950 text-sm">
                    {selectedClientForEdit.name}
                  </span>
                  <span className="text-[11px] font-mono text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200">
                    {selectedClientForEdit.companyName}
                  </span>
                </div>
                <div className="text-purple-800 flex items-center justify-between">
                  <span>Email: {selectedClientForEdit.email}</span>
                  {selectedClientForEdit.whatsappNumber ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-100/80 px-2 py-0.5 rounded">
                      <FaCheckCircle className="text-[10px]" /> Current: {selectedClientForEdit.whatsappNumber}
                    </span>
                  ) : (
                    <span className="text-amber-700 font-medium bg-amber-100/80 px-2 py-0.5 rounded">
                      No WhatsApp number saved yet
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Phone Number Input with Country Code */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                WhatsApp Number with Country Code <span className="text-rose-500">*</span>
              </label>

              <div className="flex gap-2">
                {/* Country Code Selector */}
                <div className="w-1/3 min-w-[130px]">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full px-2.5 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white transition text-gray-900 font-mono font-bold"
                  >
                    {COMMON_COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Phone Digits Input */}
                <div className="flex-1 relative">
                  <input
                    type="tel"
                    value={phoneDigits}
                    onChange={(e) => setPhoneDigits(e.target.value)}
                    placeholder="e.g. 98765 43210"
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white transition text-gray-900 font-mono"
                    required
                  />
                </div>
              </div>

              <p className="text-[11px] text-gray-500 mt-1.5 flex items-center justify-between">
                <span>Enter subscriber digits with country code. Duplicates are blocked automatically.</span>
                {phoneDigits && (
                  <span className="font-mono text-purple-700 font-semibold">
                    Preview: {countryCode} {phoneDigits}
                  </span>
                )}
              </p>
            </div>

            {formError && (
              <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                {formError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              {selectedClientIdForEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClientIdForEdit("");
                    setPhoneDigits("");
                    setFormError("");
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition cursor-pointer"
                >
                  Clear Selection
                </button>
              )}

              <button
                type="submit"
                disabled={savingPhone || !selectedClientIdForEdit}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white shadow-sm hover:shadow transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaCheckCircle />
                {savingPhone
                  ? "Saving to MongoDB..."
                  : selectedClientForEdit?.whatsappNumber
                  ? "Update Number in MongoDB"
                  : "Save Number to MongoDB"}
              </button>
            </div>
          </form>
        </div>

        {/* ============================================================
            SECTION 2: WHATSAPP MESSAGE (1-CLICK wa.me LAUNCHER)
        ============================================================ */}
        <div
          ref={messageComposerRef}
          className="bg-white rounded-2xl shadow-sm border border-emerald-200/80 p-6 sm:p-7 relative transition hover:shadow-md"
        >
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold text-lg">
                <FaWhatsapp />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">WhatsApp Message</h2>
                <p className="text-xs text-gray-500">
                  Pre-fills direct chat via <code className="text-emerald-700 font-mono">wa.me</code>
                </p>
              </div>
            </div>

            <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
              Direct Web / App Link
            </span>
          </div>

          <div className="space-y-4">
            {/* Select Saved Client Dropdown */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Select Client for Messaging <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedClientIdForMsg}
                onChange={(e) => setSelectedClientIdForMsg(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition text-gray-900 font-medium"
              >
                <option value="">-- Choose client to message --</option>
                {contacts.map((client) => (
                  <option key={client._id} value={client._id}>
                    {client.name} — {client.companyName || "No Company"}
                    {client.whatsappNumber
                      ? ` (WhatsApp: ${client.whatsappNumber})`
                      : " (NO WHATSAPP SAVED)"}
                  </option>
                ))}
              </select>
            </div>

            {/* Auto-populated Phone Banner */}
            {selectedClientForMsg ? (
              selectedClientForMsg.whatsappNumber ? (
                <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between animate-fadeIn">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <FaPhoneAlt className="text-emerald-600" />
                    <span>Auto-populated WhatsApp Number:</span>
                    <span className="font-mono text-sm text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      {selectedClientForMsg.whatsappNumber}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyPhone(selectedClientForMsg._id, selectedClientForMsg.whatsappNumber)}
                    className="text-[11px] text-emerald-700 hover:text-emerald-950 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <FaCopy />
                    {copiedId === selectedClientForMsg._id ? "Copied!" : "Copy"}
                  </button>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-900 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <FaExclamationTriangle className="text-amber-600 text-sm shrink-0" />
                    <span>This client does not have a saved WhatsApp number.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedClientIdForEdit(selectedClientForMsg._id)}
                    className="font-bold underline text-amber-800 hover:text-amber-950 cursor-pointer"
                  >
                    Add Number Above
                  </button>
                </div>
              )
            ) : (
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 italic">
                Select a client above to automatically populate their saved WhatsApp number.
              </div>
            )}

            {/* Quick Template Pills */}
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Quick Message Templates
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-emerald-100 text-gray-700 hover:text-emerald-900 border border-gray-200 hover:border-emerald-300 transition cursor-pointer"
                  >
                    + {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Textbox */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Message Text <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message to the client here..."
                rows={4}
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition text-gray-900"
              />
              <div className="flex items-center justify-between mt-1 text-[11px] text-gray-400">
                <span>The message will be pre-filled in WhatsApp chat for you to send manually.</span>
                <span>{messageText.length} characters</span>
              </div>
            </div>

            {/* Green "Send on WhatsApp" Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={!selectedClientForMsg || !selectedClientForMsg.whatsappNumber || !messageText.trim()}
                className="w-full py-3 px-5 rounded-xl font-bold text-sm text-white bg-[#25D366] hover:bg-[#20ba59] active:bg-[#1caa4f] shadow-md hover:shadow-lg transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <FaWhatsapp className="text-xl" />
                <span>Send on WhatsApp</span>
                <FaExternalLinkAlt className="text-xs opacity-80" />
              </button>
              <p className="text-[11px] text-center text-gray-400 mt-1.5">
                Opens <code className="font-mono text-gray-600">https://wa.me/PHONE?text=...</code> with client's chat and text pre-filled.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          SECTION 3: WHATSAPP CONTACT LIST (TABLE, SEARCH, ACTIONS)
      ============================================================ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FaBuilding className="text-gray-400 text-base" />
              <span>Client Contacts Directory</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-bold">
                {filteredContacts.length}
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Live records from MongoDB with permanent WhatsApp contact numbers
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Toggle Buttons */}
            <div className="inline-flex rounded-xl p-1 bg-gray-100 text-xs font-semibold border border-gray-200">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  filterType === "all" ? "bg-white text-gray-900 shadow-xs font-bold" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                All ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("saved")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  filterType === "saved" ? "bg-emerald-600 text-white shadow-xs font-bold" : "text-gray-600 hover:text-emerald-700"
                }`}
              >
                <FaCheckCircle className="text-[10px]" /> With WhatsApp ({stats.withWa})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("missing")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  filterType === "missing" ? "bg-amber-600 text-white shadow-xs font-bold" : "text-gray-600 hover:text-amber-700"
                }`}
              >
                Missing ({stats.missing})
              </button>
            </div>

            {/* Live Search Input */}
            <div className="relative min-w-[220px]">
              <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, company, ID..."
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Contacts Table */}
        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-gray-500 font-medium">Loading saved client contacts from MongoDB...</p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="py-14 text-center border-2 border-dashed border-gray-200 rounded-xl p-6">
            <FaWhatsapp className="mx-auto text-3xl text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-gray-700">No client records found</p>
            <p className="text-xs text-gray-400 mt-1">
              {searchQuery ? `No clients matching "${searchQuery}"` : "No clients currently in this view filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-[11px] font-mono uppercase tracking-wider text-gray-500 bg-gray-50/70">
                  <th className="py-3 px-4 font-bold">Client &amp; Company</th>
                  <th className="py-3 px-4 font-bold">Client ID</th>
                  <th className="py-3 px-4 font-bold">Email</th>
                  <th className="py-3 px-4 font-bold">Saved WhatsApp Number</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredContacts.map((client) => {
                  const hasWa = Boolean(client.whatsappNumber);
                  return (
                    <tr
                      key={client._id}
                      className="hover:bg-gray-50/80 transition group"
                    >
                      {/* Name & Company */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 group-hover:text-emerald-700 transition">
                          {client.name}
                        </div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                          <FaBuilding className="text-[10px] text-gray-400" />
                          <span>{client.companyName || "Individual Client"}</span>
                        </div>
                      </td>

                      {/* Client ID */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-stone-700">
                        <span className="px-2 py-0.5 rounded bg-stone-100 border border-stone-200 text-[11px]">
                          {client.clientId || "—"}
                        </span>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 text-gray-600 font-mono text-[11px]">
                        {client.email}
                      </td>

                      {/* Saved WhatsApp Number */}
                      <td className="py-3.5 px-4">
                        {hasWa ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 text-xs flex items-center gap-1.5">
                              <FaWhatsapp className="text-emerald-600 text-sm" />
                              {client.whatsappNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(client._id, client.whatsappNumber)}
                              className="text-gray-400 hover:text-gray-700 p-1 rounded cursor-pointer"
                              title="Copy number"
                            >
                              <FaCopy className="text-xs" />
                            </button>
                            {copiedId === client._id && (
                              <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 italic">
                            No number saved
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {hasWa ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600">
                            Missing
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {/* Edit / Add Number */}
                          <button
                            type="button"
                            onClick={() => handleSelectClientForEdit(client)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-800 border border-gray-200 hover:border-purple-300 transition flex items-center gap-1 cursor-pointer"
                            title={hasWa ? "Edit saved WhatsApp number" : "Add WhatsApp number"}
                          >
                            <FaEdit className="text-[11px]" />
                            <span>{hasWa ? "Edit" : "Add"}</span>
                          </button>

                          {/* Message Button */}
                          <button
                            type="button"
                            onClick={() => handleSelectClientForMessage(client)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-900 border border-emerald-200 hover:border-emerald-300 transition flex items-center gap-1 cursor-pointer"
                            title="Compose message for this client"
                          >
                            <FaPaperPlane className="text-[10px]" />
                            <span>Message</span>
                          </button>

                          {/* Instant 1-Click WhatsApp Link if number exists */}
                          {hasWa && (
                            <a
                              href={`https://wa.me/${client.whatsappNumber.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-[#25D366]/15 hover:bg-[#25D366] text-[#128C7E] hover:text-white border border-[#25D366]/30 transition cursor-pointer flex items-center justify-center"
                              title="Open direct WhatsApp chat"
                            >
                              <FaWhatsapp className="text-sm" />
                            </a>
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
      </div>
    </div>
  );
};

export default ClientWhatsAppPanel;
