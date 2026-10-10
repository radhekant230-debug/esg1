import React, { useState, useEffect } from "react";
import api from "../../utils/axios";
import { FaTimes, FaSave, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";

export default function AdminUniversalDataModal({ isOpen, onClose, onSuccess, initialClientId, initialType = "sales" }) {
  const [dataType, setDataType] = useState(initialType);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(initialClientId || "");
  const [loadingClients, setLoadingClients] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });

  // Sales form
  const [salesForm, setSalesForm] = useState({
    reportingMonth: new Date().toISOString().slice(0, 7),
    grossSales: "",
    discounts: "0",
    refunds: "0",
    netRevenue: "",
    costOfGoodsSold: "0",
    ordersCount: "",
    salesChannel: "In-Store / Direct",
    dataSource: "Verified POS Export",
    verificationStatus: "Verified",
    adAttributedRevenue: "0",
    notes: "",
  });

  // Campaign form
  const [campaignForm, setCampaignForm] = useState({
    campaignName: "",
    platform: "Meta Ads",
    reportingMonth: new Date().toISOString().slice(0, 7),
    budget: "",
    adSpend: "",
    impressions: "",
    reach: "",
    clicks: "",
    leads: "0",
    conversions: "0",
    attributedRevenue: "0",
    status: "Active",
    objective: "Lead Generation",
    supportingEvidence: "",
    verificationStatus: "Verified",
  });

  // Lead form
  const [leadForm, setLeadForm] = useState({
    name: "",
    email: "",
    phone: "",
    source: "Meta Ads",
    campaign: "",
    reportingMonth: new Date().toISOString().slice(0, 7),
    status: "New",
    isQualified: false,
    isConverted: false,
    estimatedValue: "0",
    note: "",
  });

  // Order form
  const [orderForm, setOrderForm] = useState({
    reportingMonth: new Date().toISOString().slice(0, 7),
    orderType: "Order",
    customerName: "Walk-in Guest",
    count: "1",
    value: "",
    status: "Completed",
    channel: "Dine-in",
    notes: "",
  });

  // Invoice form
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    servicePackage: "Brand Growth & Digital Marketing Retainer",
    billingPeriod: `${new Date().toLocaleString("en-US", { month: "long", year: "numeric" })} Retainer`,
    subtotal: "45000",
    taxAmount: "8100",
    totalAmount: "53100",
    status: "Pending",
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    notes: "",
  });

  useEffect(() => {
    if (initialClientId) setSelectedClientId(initialClientId);
    if (initialType) setDataType(initialType);
  }, [initialClientId, initialType, isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchClients();
    }
  }, [isOpen]);

  const fetchClients = async () => {
    try {
      setLoadingClients(true);
      const res = await api.get("/admin/clients");
      setClients(res.data || []);
      if (!selectedClientId && res.data?.length > 0) {
        setSelectedClientId(res.data[0]._id);
      }
    } catch (e) {
      console.error("Error fetching clients list:", e);
    } finally {
      setLoadingClients(false);
    }
  };

  if (!isOpen) return null;

  // Auto calculate Net Revenue in sales form
  const handleGrossSalesChange = (grossVal) => {
    const gross = Number(grossVal) || 0;
    const disc = Number(salesForm.discounts) || 0;
    const ref = Number(salesForm.refunds) || 0;
    setSalesForm((prev) => ({
      ...prev,
      grossSales: grossVal,
      netRevenue: Math.max(0, gross - disc - ref),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClientId) {
      setStatusMsg({ type: "error", text: "Please select a client." });
      return;
    }

    try {
      setSubmitting(true);
      setStatusMsg({ type: "", text: "" });

      if (dataType === "sales") {
        await api.post(`/admin/clients/${selectedClientId}/sales`, salesForm);
      } else if (dataType === "campaign") {
        await api.post(`/admin/clients/${selectedClientId}/campaigns`, campaignForm);
      } else if (dataType === "lead") {
        await api.post(`/admin/clients/${selectedClientId}/leads`, leadForm);
      } else if (dataType === "order") {
        await api.post(`/admin/clients/${selectedClientId}/orders`, orderForm);
      } else if (dataType === "invoice") {
        await api.post(`/admin/clients/${selectedClientId}/invoices`, invoiceForm);
      }

      setStatusMsg({ type: "success", text: "Data record recorded successfully!" });
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
        setStatusMsg({ type: "", text: "" });
      }, 1000);
    } catch (err) {
      console.error("Data submission error:", err);
      setStatusMsg({
        type: "error",
        text: err.response?.data?.message || "Failed to submit data record.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-8">
        {/* Header */}
        <div className="bg-[#1C1B19] text-[#F5F0E8] px-6 py-4 flex items-center justify-between border-b border-stone-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#C5A880]/20 text-[#C5A880] border border-[#C5A880]/30 uppercase tracking-widest">
                ADMIN DATA ENTRY
              </span>
              <span className="text-xs text-stone-400 font-mono">Performance Logging</span>
            </div>
            <h2 className="text-lg font-serif font-bold text-white mt-1">
              Add Client Business Performance
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Status Message */}
          {statusMsg.text && (
            <div
              className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                statusMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {statusMsg.type === "success" ? <FaCheckCircle /> : <FaExclamationCircle />}
              {statusMsg.text}
            </div>
          )}

          {/* Client Selection & Category Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                Target Client *
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-[#C5A880] focus:border-[#C5A880] outline-none"
              >
                {clients.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.companyName || c.name} ({c.clientId || "Client"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                Record Type *
              </label>
              <select
                value={dataType}
                onChange={(e) => setDataType(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-[#C5A880] focus:border-[#C5A880] outline-none font-medium"
              >
                <option value="sales">Sales & Revenue</option>
                <option value="campaign">Advertising Campaign</option>
                <option value="lead">Lead / Customer Enquiry</option>
                <option value="order">Order / Table Reservation</option>
                <option value="invoice">Retainer & Agency Invoice</option>
              </select>
            </div>
          </div>

          {/* 1. SALES & REVENUE FORM */}
          {dataType === "sales" && (
            <div className="space-y-4 pt-2 border-t border-stone-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Reporting Month *
                  </label>
                  <input
                    type="month"
                    required
                    value={salesForm.reportingMonth}
                    onChange={(e) => setSalesForm({ ...salesForm, reportingMonth: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-[#C5A880] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Gross Sales (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 150000"
                    value={salesForm.grossSales}
                    onChange={(e) => handleGrossSalesChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-[#C5A880] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Discounts (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={salesForm.discounts}
                    onChange={(e) => {
                      const disc = e.target.value;
                      const gross = Number(salesForm.grossSales) || 0;
                      const ref = Number(salesForm.refunds) || 0;
                      setSalesForm({
                        ...salesForm,
                        discounts: disc,
                        netRevenue: Math.max(0, gross - (Number(disc) || 0) - ref),
                      });
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-[#C5A880] outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Refunds / Returns (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={salesForm.refunds}
                    onChange={(e) => {
                      const ref = e.target.value;
                      const gross = Number(salesForm.grossSales) || 0;
                      const disc = Number(salesForm.discounts) || 0;
                      setSalesForm({
                        ...salesForm,
                        refunds: ref,
                        netRevenue: Math.max(0, gross - disc - (Number(ref) || 0)),
                      });
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-[#C5A880] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-emerald-800 mb-1">
                    Net Revenue (₹) [Computed]
                  </label>
                  <input
                    type="number"
                    value={salesForm.netRevenue}
                    onChange={(e) => setSalesForm({ ...salesForm, netRevenue: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-300 bg-emerald-50/50 font-mono font-bold text-emerald-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Orders / Transactions
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 120"
                    value={salesForm.ordersCount}
                    onChange={(e) => setSalesForm({ ...salesForm, ordersCount: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-[#C5A880] outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Cost of Goods Sold (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={salesForm.costOfGoodsSold}
                    onChange={(e) => setSalesForm({ ...salesForm, costOfGoodsSold: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-[#C5A880] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Sales Channel
                  </label>
                  <select
                    value={salesForm.salesChannel}
                    onChange={(e) => setSalesForm({ ...salesForm, salesChannel: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 outline-none"
                  >
                    <option value="In-Store / Direct">In-Store / Direct</option>
                    <option value="Online Website">Online Website</option>
                    <option value="Swiggy / Zomato">Swiggy / Zomato</option>
                    <option value="Phone / WhatsApp Orders">Phone / WhatsApp Orders</option>
                    <option value="Multi-Channel Integrated">Multi-Channel Integrated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Verification Status
                  </label>
                  <select
                    value={salesForm.verificationStatus}
                    onChange={(e) => setSalesForm({ ...salesForm, verificationStatus: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 outline-none"
                  >
                    <option value="Verified">Verified (POS / Bank / CA)</option>
                    <option value="Pending Review">Pending Review</option>
                    <option value="Estimated">Estimated</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Notes & Reconciliation Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified against Petpooja / Shopify monthly report."
                  value={salesForm.notes}
                  onChange={(e) => setSalesForm({ ...salesForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-[#C5A880] outline-none"
                />
              </div>
            </div>
          )}

          {/* 2. CAMPAIGN FORM */}
          {dataType === "campaign" && (
            <div className="space-y-4 pt-2 border-t border-stone-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cafe Mysa - March Signature Coffee Campaign"
                    value={campaignForm.campaignName}
                    onChange={(e) => setCampaignForm({ ...campaignForm, campaignName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-[#C5A880] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Platform
                  </label>
                  <select
                    value={campaignForm.platform}
                    onChange={(e) => setCampaignForm({ ...campaignForm, platform: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 outline-none"
                  >
                    <option value="Meta Ads">Meta Ads (Instagram & FB)</option>
                    <option value="Google Ads">Google Ads (Search & Maps)</option>
                    <option value="Other">Other Media</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Ad Spend (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 15000"
                    value={campaignForm.adSpend}
                    onChange={(e) => setCampaignForm({ ...campaignForm, adSpend: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-[#C5A880] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Attributed Revenue (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 60000"
                    value={campaignForm.attributedRevenue}
                    onChange={(e) => setCampaignForm({ ...campaignForm, attributedRevenue: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-[#C5A880] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Impressions
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 35000"
                    value={campaignForm.impressions}
                    onChange={(e) => setCampaignForm({ ...campaignForm, impressions: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-[#C5A880] outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Clicks
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 850"
                    value={campaignForm.clicks}
                    onChange={(e) => setCampaignForm({ ...campaignForm, clicks: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-[#C5A880] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Leads Acquired
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 24"
                    value={campaignForm.leads}
                    onChange={(e) => setCampaignForm({ ...campaignForm, leads: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-[#C5A880] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Status
                  </label>
                  <select
                    value={campaignForm.status}
                    onChange={(e) => setCampaignForm({ ...campaignForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Paused">Paused</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 3. LEAD FORM */}
          {dataType === "lead" && (
            <div className="space-y-4 pt-2 border-t border-stone-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ananya Roy"
                    value={leadForm.name}
                    onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-[#C5A880] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-[#C5A880] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Source
                  </label>
                  <select
                    value={leadForm.source}
                    onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 outline-none"
                  >
                    <option value="Meta Ads">Meta Ads</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="Website Enquiry">Website Enquiry</option>
                    <option value="Instagram DM">Instagram DM</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="Referral">Referral</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Status
                  </label>
                  <select
                    value={leadForm.status}
                    onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 outline-none"
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Converted">Converted</option>
                    <option value="Lost">Lost</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Initial Note / Context
                  </label>
                  <input
                    type="text"
                    placeholder="Interested in catering / bulk order"
                    value={leadForm.note}
                    onChange={(e) => setLeadForm({ ...leadForm, note: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-[#C5A880] outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. ORDER / RESERVATION FORM */}
          {dataType === "order" && (
            <div className="space-y-4 pt-2 border-t border-stone-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Type
                  </label>
                  <select
                    value={orderForm.orderType}
                    onChange={(e) => setOrderForm({ ...orderForm, orderType: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 outline-none"
                  >
                    <option value="Order">Order</option>
                    <option value="Reservation">Table Reservation</option>
                    <option value="Table Booking">Table Booking</option>
                    <option value="Custom Order">Custom Order</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Customer / Table Name
                  </label>
                  <input
                    type="text"
                    value={orderForm.customerName}
                    onChange={(e) => setOrderForm({ ...orderForm, customerName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Value (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 2500"
                    value={orderForm.value}
                    onChange={(e) => setOrderForm({ ...orderForm, value: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Channel
                  </label>
                  <select
                    value={orderForm.channel}
                    onChange={(e) => setOrderForm({ ...orderForm, channel: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 outline-none"
                  >
                    <option value="Dine-in">Dine-in</option>
                    <option value="Takeaway">Takeaway</option>
                    <option value="Online Swiggy/Zomato">Online Swiggy/Zomato</option>
                    <option value="Store Walk-in">Store Walk-in</option>
                    <option value="Website">Website</option>
                    <option value="Direct Phone">Direct Phone</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Status
                  </label>
                  <select
                    value={orderForm.status}
                    onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 outline-none"
                  >
                    <option value="Completed">Completed</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Pending">Pending</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 5. INVOICE / RETAINER FORM */}
          {dataType === "invoice" && (
            <div className="space-y-4 pt-2 border-t border-stone-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Invoice # *
                  </label>
                  <input
                    type="text"
                    required
                    value={invoiceForm.invoiceNumber}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Subtotal Retainer (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={invoiceForm.subtotal}
                    onChange={(e) => {
                      const sub = Number(e.target.value) || 0;
                      const tax = Math.round(sub * 0.18);
                      setInvoiceForm({
                        ...invoiceForm,
                        subtotal: e.target.value,
                        taxAmount: tax,
                        totalAmount: sub + tax,
                      });
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Total Amount with GST (₹)
                  </label>
                  <input
                    type="number"
                    value={invoiceForm.totalAmount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, totalAmount: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 bg-stone-50 font-mono font-bold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={invoiceForm.dueDate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Status
                  </label>
                  <select
                    value={invoiceForm.status}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 outline-none"
                  >
                    <option value="Pending">Pending Payment</option>
                    <option value="Paid">Paid</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg bg-[#C5A880] hover:bg-[#B39369] text-stone-950 font-bold text-xs shadow-md transition flex items-center gap-2 disabled:opacity-50"
            >
              <FaSave />
              {submitting ? "Saving to Database..." : "Save Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
