import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../../utils/axios";
import AdminUniversalDataModal from "../../components/admin/AdminUniversalDataModal";
import {
  FaArrowLeft,
  FaPlus,
  FaDollarSign,
  FaBullhorn,
  FaUserFriends,
  FaCalendarCheck,
  FaFileAlt,
  FaFolder,
  FaCheckCircle,
  FaHistory,
  FaEdit,
  FaTrash,
  FaSyncAlt,
  FaUserTie,
  FaPhoneAlt,
  FaEnvelope,
  FaExternalLinkAlt,
  FaDownload,
} from "react-icons/fa";

export default function AdminClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("sales");

  // Modal controls for quick data entry
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("sales");

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/admin/clients/${id}`);
      setData(res.data);
    } catch (err) {
      console.error("Fetch Client Detail Error:", err);
      setError("Failed to load client details from database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDetail();
  }, [id]);

  const formatINR = (val) => {
    if (val === undefined || val === null) return "₹0";
    return `₹${Number(val).toLocaleString("en-IN")}`;
  };

  // Delete records
  const handleDeleteSales = async (recordId) => {
    if (!window.confirm("Delete this sales record permanently?")) return;
    try {
      await api.delete(`/admin/sales/${recordId}`);
      fetchDetail();
    } catch (e) {
      alert("Failed to delete record");
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm("Delete this campaign record permanently?")) return;
    try {
      await api.delete(`/admin/campaigns/${campaignId}`);
      fetchDetail();
    } catch (e) {
      alert("Failed to delete campaign");
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm("Delete this lead record permanently?")) return;
    try {
      await api.delete(`/admin/leads/${leadId}`);
      fetchDetail();
    } catch (e) {
      alert("Failed to delete lead");
    }
  };

  const openDataModal = (type) => {
    setModalType(type);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-8 h-8 border-4 border-stone-200 border-t-[#C5A880] rounded-full animate-spin mb-3" />
        <p className="text-xs font-mono text-stone-500 uppercase tracking-wider">
          Loading Client Performance Profile...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center">
        <p className="text-sm font-bold text-red-800 mb-2">{error || "Client not found"}</p>
        <Link to="/admin/clients" className="text-xs text-stone-700 underline font-semibold">
          &larr; Return to Client Management
        </Link>
      </div>
    );
  }

  const { client, profile, summary, sales, campaigns, leads, orders, activity, invoices, reports, documents } = data;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/admin/clients"
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-stone-500 hover:text-stone-900 font-semibold"
        >
          <FaArrowLeft className="text-[10px]" />
          Back to Client Management
        </Link>
      </div>

      {/* Client Profile Header Banner */}
      <div className="bg-[#1A1918] text-[#F5F0E8] rounded-2xl p-6 sm:p-8 border border-[#33312E] shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-[#C5A880]/20 text-[#C5A880] border border-[#C5A880]/30">
                {profile?.businessType?.replace("_", " ") || "CLIENT"}
              </span>
              <span className="text-xs font-mono text-stone-400">
                ID: {client.clientId || `CLI-${client._id.slice(-4).toUpperCase()}`}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                  client.isActive !== false
                    ? "bg-emerald-900/50 text-emerald-300 border border-emerald-700/60"
                    : "bg-stone-800 text-stone-400 border border-stone-700"
                }`}
              >
                {client.isActive !== false ? "Active Account" : "Inactive"}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
              {profile?.businessName || client.companyName || client.name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-300">
              <span className="flex items-center gap-1.5">
                <FaUserTie className="text-[#C5A880]" />
                Contact: <strong className="text-white">{client.name}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <FaEnvelope className="text-stone-400" />
                {client.email}
              </span>
              {client.phone && (
                <span className="flex items-center gap-1.5">
                  <FaPhoneAlt className="text-stone-400" />
                  {client.phone}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => openDataModal("sales")}
              className="px-3.5 py-2 rounded-xl bg-[#C5A880] hover:bg-[#B39369] text-stone-950 font-bold text-xs shadow-xs transition flex items-center gap-1.5"
            >
              <FaPlus />
              + Add Sales
            </button>
            <button
              onClick={() => openDataModal("campaign")}
              className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-semibold text-xs transition flex items-center gap-1.5"
            >
              <FaPlus />
              + Add Campaign
            </button>
            <button
              onClick={() => openDataModal("lead")}
              className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-semibold text-xs transition flex items-center gap-1.5"
            >
              <FaPlus />
              + Add Lead
            </button>
            <button
              onClick={() => openDataModal("order")}
              className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-semibold text-xs transition flex items-center gap-1.5"
            >
              <FaPlus />
              + Add Order
            </button>
          </div>
        </div>

        {/* Quick KPI Overview Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-stone-800">
          <div>
            <div className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">Gross Sales</div>
            <div className="text-xl font-bold font-serif text-white">{formatINR(summary?.totalSales)}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">Net Revenue</div>
            <div className="text-xl font-bold font-serif text-emerald-400">{formatINR(summary?.netRevenue)}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">Total Ad Spend</div>
            <div className="text-xl font-bold font-serif text-white">{formatINR(summary?.totalAdSpend)}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">Overall ROAS</div>
            <div className="text-xl font-bold font-serif text-amber-400">{summary?.roas || 0}x</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-stone-200 overflow-x-auto gap-2 text-xs font-semibold">
        {[
          { key: "sales", label: `Sales & Revenue (${sales?.length || 0})`, icon: FaDollarSign },
          { key: "campaigns", label: `Campaigns (${campaigns?.length || 0})`, icon: FaBullhorn },
          { key: "leads", label: `Leads & Pipeline (${leads?.length || 0})`, icon: FaUserFriends },
          { key: "orders", label: `Orders & Bookings (${orders?.length || 0})`, icon: FaCalendarCheck },
          { key: "invoices", label: `Retainers & Invoices (${invoices?.length || 0})`, icon: FaFileAlt },
          { key: "activity", label: `Audit & History`, icon: FaHistory },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium transition whitespace-nowrap ${
                isActive
                  ? "border-[#8B6E3F] text-[#8B6E3F] font-bold bg-amber-50/30"
                  : "border-transparent text-stone-600 hover:text-stone-900"
              }`}
            >
              <Icon className="text-xs" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: SALES & REVENUE */}
      {activeTab === "sales" && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-base text-stone-900">
              Verified Sales & Revenue Records
            </h3>
            <button
              onClick={() => openDataModal("sales")}
              className="px-3 py-1.5 rounded-lg bg-[#C5A880] hover:bg-[#B39369] text-stone-950 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <FaPlus />
              + Add Sales Record
            </button>
          </div>

          {sales?.length === 0 ? (
            <div className="py-12 text-center text-stone-400 font-medium text-xs">
              No sales records logged yet for this client. Click "+ Add Sales Record" above to record business performance.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-mono text-[11px] uppercase">
                    <th className="py-2.5 px-3 font-bold">Month / Date</th>
                    <th className="py-2.5 px-3 font-bold text-right">Gross Sales</th>
                    <th className="py-2.5 px-3 font-bold text-right">Discounts</th>
                    <th className="py-2.5 px-3 font-bold text-right">Refunds</th>
                    <th className="py-2.5 px-3 font-bold text-right">Net Revenue</th>
                    <th className="py-2.5 px-3 font-bold text-center">Orders</th>
                    <th className="py-2.5 px-3 font-bold">Channel</th>
                    <th className="py-2.5 px-3 font-bold">Status</th>
                    <th className="py-2.5 px-3 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {sales.map((rec) => (
                    <tr key={rec._id} className="hover:bg-stone-50/60">
                      <td className="py-2.5 px-3 font-mono font-semibold text-stone-900">
                        {rec.reportingMonth || new Date(rec.date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-stone-800">
                        {formatINR(rec.grossSales || rec.totalRevenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-stone-500">
                        {formatINR(rec.discounts || 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-stone-500">
                        {formatINR(rec.refunds || 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800">
                        {formatINR(rec.netRevenue || rec.totalRevenue)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {rec.ordersCount || 0}
                      </td>
                      <td className="py-2.5 px-3 text-stone-700">
                        {rec.salesChannel || "In-Store"}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {rec.verificationStatus || "Verified"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDeleteSales(rec._id)}
                          className="p-1.5 text-stone-400 hover:text-red-600 transition"
                          title="Delete sales record"
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ADVERTISING & CAMPAIGNS */}
      {activeTab === "campaigns" && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-base text-stone-900">
              Paid Advertising Campaigns
            </h3>
            <button
              onClick={() => openDataModal("campaign")}
              className="px-3 py-1.5 rounded-lg bg-[#C5A880] hover:bg-[#B39369] text-stone-950 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <FaPlus />
              + Add Campaign Data
            </button>
          </div>

          {campaigns?.length === 0 ? (
            <div className="py-12 text-center text-stone-400 font-medium text-xs">
              No advertising campaigns logged. Click "+ Add Campaign Data" to record media spend and conversions.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-mono text-[11px] uppercase">
                    <th className="py-2.5 px-3 font-bold">Campaign Name</th>
                    <th className="py-2.5 px-3 font-bold">Platform</th>
                    <th className="py-2.5 px-3 font-bold text-right">Ad Spend</th>
                    <th className="py-2.5 px-3 font-bold text-right">Attributed Rev</th>
                    <th className="py-2.5 px-3 font-bold text-center">ROAS</th>
                    <th className="py-2.5 px-3 font-bold text-right">Clicks</th>
                    <th className="py-2.5 px-3 font-bold text-center">Leads</th>
                    <th className="py-2.5 px-3 font-bold text-center">CTR</th>
                    <th className="py-2.5 px-3 font-bold">Status</th>
                    <th className="py-2.5 px-3 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {campaigns.map((camp) => (
                    <tr key={camp._id} className="hover:bg-stone-50/60">
                      <td className="py-2.5 px-3 font-semibold text-stone-900">
                        {camp.campaignName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-stone-600">
                        {camp.platform}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-stone-800">
                        {formatINR(camp.adSpend)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800">
                        {formatINR(camp.attributedRevenue)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {camp.roas || 0}x
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{camp.clicks || 0}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-semibold">{camp.leads || 0}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{camp.ctr || 0}%</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-stone-100 text-stone-700 border border-stone-200">
                          {camp.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDeleteCampaign(camp._id)}
                          className="p-1.5 text-stone-400 hover:text-red-600 transition"
                          title="Delete campaign"
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LEADS & PIPELINE */}
      {activeTab === "leads" && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-base text-stone-900">
              Customer Leads & Enquiries
            </h3>
            <button
              onClick={() => openDataModal("lead")}
              className="px-3 py-1.5 rounded-lg bg-[#C5A880] hover:bg-[#B39369] text-stone-950 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <FaPlus />
              + Add Lead
            </button>
          </div>

          {leads?.length === 0 ? (
            <div className="py-12 text-center text-stone-400 font-medium text-xs">
              No customer leads logged yet for this client.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-mono text-[11px] uppercase">
                    <th className="py-2.5 px-3 font-bold">Contact Name</th>
                    <th className="py-2.5 px-3 font-bold">Source</th>
                    <th className="py-2.5 px-3 font-bold">Phone / Email</th>
                    <th className="py-2.5 px-3 font-bold text-center">Status</th>
                    <th className="py-2.5 px-3 font-bold">Notes</th>
                    <th className="py-2.5 px-3 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {leads.map((l) => (
                    <tr key={l._id} className="hover:bg-stone-50/60">
                      <td className="py-2.5 px-3 font-semibold text-stone-900">{l.name}</td>
                      <td className="py-2.5 px-3 font-mono text-stone-600">{l.source}</td>
                      <td className="py-2.5 px-3 text-stone-600">
                        {l.phone || l.email || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-stone-100 text-stone-800 border border-stone-200">
                          {l.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-stone-500 max-w-xs truncate">
                        {l.notes?.[0]?.text || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDeleteLead(l._id)}
                          className="p-1.5 text-stone-400 hover:text-red-600 transition"
                          title="Delete lead"
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ORDERS & RESERVATIONS */}
      {activeTab === "orders" && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-base text-stone-900">
              Orders & Table Reservations
            </h3>
            <button
              onClick={() => openDataModal("order")}
              className="px-3 py-1.5 rounded-lg bg-[#C5A880] hover:bg-[#B39369] text-stone-950 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <FaPlus />
              + Add Order / Booking
            </button>
          </div>

          {orders?.length === 0 ? (
            <div className="py-12 text-center text-stone-400 font-medium text-xs">
              No orders or table reservations logged.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-mono text-[11px] uppercase">
                    <th className="py-2.5 px-3 font-bold">Type</th>
                    <th className="py-2.5 px-3 font-bold">Customer / Table</th>
                    <th className="py-2.5 px-3 font-bold text-center">Count</th>
                    <th className="py-2.5 px-3 font-bold text-right">Value</th>
                    <th className="py-2.5 px-3 font-bold">Channel</th>
                    <th className="py-2.5 px-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {orders.map((o) => (
                    <tr key={o._id} className="hover:bg-stone-50/60">
                      <td className="py-2.5 px-3 font-semibold text-stone-900">{o.orderType}</td>
                      <td className="py-2.5 px-3 text-stone-700">{o.customerName}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{o.count}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-800">
                        {formatINR(o.value)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-stone-600">{o.channel}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-stone-100 text-stone-700 border border-stone-200">
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: INVOICES & RETAINERS */}
      {activeTab === "invoices" && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-base text-stone-900">
              Agency Retainers & Billing Records
            </h3>
            <button
              onClick={() => openDataModal("invoice")}
              className="px-3 py-1.5 rounded-lg bg-[#C5A880] hover:bg-[#B39369] text-stone-950 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <FaPlus />
              + Add Retainer Invoice
            </button>
          </div>

          {invoices?.length === 0 ? (
            <div className="py-12 text-center text-stone-400 font-medium text-xs">
              No invoices generated for this client.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-mono text-[11px] uppercase">
                    <th className="py-2.5 px-3 font-bold">Invoice #</th>
                    <th className="py-2.5 px-3 font-bold">Period / Package</th>
                    <th className="py-2.5 px-3 font-bold text-right">Subtotal</th>
                    <th className="py-2.5 px-3 font-bold text-right">Total Amount</th>
                    <th className="py-2.5 px-3 font-bold">Due Date</th>
                    <th className="py-2.5 px-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {invoices.map((inv) => (
                    <tr key={inv._id} className="hover:bg-stone-50/60">
                      <td className="py-2.5 px-3 font-mono font-bold text-stone-900">{inv.invoiceNumber}</td>
                      <td className="py-2.5 px-3 text-stone-700">{inv.billingPeriod}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatINR(inv.subtotal)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-900">
                        {formatINR(inv.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-stone-600">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-50 text-amber-800 border border-amber-200">
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: AUDIT & HISTORY */}
      {activeTab === "activity" && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
          <h3 className="font-serif font-bold text-base text-stone-900">
            Account Activity & Audit History
          </h3>
          {activity?.length === 0 ? (
            <div className="py-12 text-center text-stone-400 font-medium text-xs">
              No recorded activity events for this client.
            </div>
          ) : (
            <div className="space-y-3">
              {activity.map((act) => (
                <div key={act._id} className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-stone-900">{act.action}</span>:{" "}
                    <span className="text-stone-700">{act.description}</span>
                  </div>
                  <span className="text-[10px] font-mono text-stone-400">
                    {new Date(act.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Universal Data Entry Modal */}
      <AdminUniversalDataModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialClientId={id}
        initialType={modalType}
        onSuccess={fetchDetail}
      />
    </div>
  );
}
