import React, { useState } from "react";
import api from "../../utils/axios";
import {
  FaTimes,
  FaPlusCircle,
  FaCheckCircle,
  FaDollarSign,
  FaBullhorn,
  FaShareAlt,
  FaUserFriends,
  FaCalendarAlt,
  FaFileAlt,
  FaReceipt,
} from "react-icons/fa";

export default function PortalAdminDataEntryModal({ clientId, clientName, onClose, onRefresh }) {
  const [entryType, setEntryType] = useState("sales");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Form states
  const [salesForm, setSalesForm] = useState({
    date: new Date().toISOString().split("T")[0],
    totalRevenue: "",
    ordersCount: "",
    adAttributedRevenue: "",
    returnsAmount: "",
    notes: "",
  });

  const [campaignForm, setCampaignForm] = useState({
    campaignName: "",
    platform: "Meta Ads",
    objective: "Lead Generation",
    startDate: new Date().toISOString().split("T")[0],
    budget: "",
    adSpend: "",
    impressions: "",
    clicks: "",
    leads: "",
    conversions: "",
    attributedRevenue: "",
  });

  const [leadForm, setLeadForm] = useState({
    name: "",
    email: "",
    phone: "",
    source: "Meta Ads",
    campaign: "",
    status: "New",
    estimatedValue: "",
    noteText: "",
  });

  const [contentForm, setContentForm] = useState({
    title: "",
    platform: "Instagram",
    format: "Reel",
    caption: "",
    creativeUrl: "",
    scheduledDate: new Date().toISOString().split("T")[0],
  });

  const handleSalesSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      await api.post(`/portal/sales?clientId=${clientId}`, {
        date: salesForm.date,
        totalRevenue: Number(salesForm.totalRevenue) || 0,
        ordersCount: Number(salesForm.ordersCount) || 0,
        adAttributedRevenue: Number(salesForm.adAttributedRevenue) || 0,
        returnsAmount: Number(salesForm.returnsAmount) || 0,
        notes: salesForm.notes,
      });
      setSuccess("Sales record logged successfully.");
      setTimeout(() => {
        if (onRefresh) onRefresh();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save sales.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCampaignSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      await api.post(`/portal/campaigns?clientId=${clientId}`, {
        campaignName: campaignForm.campaignName,
        platform: campaignForm.platform,
        objective: campaignForm.objective,
        startDate: campaignForm.startDate,
        budget: Number(campaignForm.budget) || 0,
        adSpend: Number(campaignForm.adSpend) || 0,
        impressions: Number(campaignForm.impressions) || 0,
        clicks: Number(campaignForm.clicks) || 0,
        leads: Number(campaignForm.leads) || 0,
        conversions: Number(campaignForm.conversions) || 0,
        attributedRevenue: Number(campaignForm.attributedRevenue) || 0,
      });
      setSuccess("Campaign added successfully.");
      setTimeout(() => {
        if (onRefresh) onRefresh();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save campaign.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      await api.post(`/portal/leads?clientId=${clientId}`, {
        name: leadForm.name,
        email: leadForm.email,
        phone: leadForm.phone,
        source: leadForm.source,
        campaign: leadForm.campaign,
        status: leadForm.status,
        estimatedValue: Number(leadForm.estimatedValue) || 0,
        notes: leadForm.noteText ? [{ text: leadForm.noteText, author: "Agency Team" }] : [],
      });
      setSuccess("Lead added successfully.");
      setTimeout(() => {
        if (onRefresh) onRefresh();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save lead.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleContentSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      await api.post(`/portal/content-calendar?clientId=${clientId}`, {
        title: contentForm.title,
        platform: contentForm.platform,
        format: contentForm.format,
        caption: contentForm.caption,
        creativeUrl: contentForm.creativeUrl || "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&auto=format&fit=crop&q=80",
        scheduledDate: contentForm.scheduledDate,
        status: "Pending Approval",
      });
      setSuccess("Content item created for client approval.");
      setTimeout(() => {
        if (onRefresh) onRefresh();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to post content.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-[#E7DFD5] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start pb-4 border-b border-[#EFE9E0] mb-5">
          <div>
            <span className="text-[10px] font-mono font-bold text-[#9C7A42] uppercase tracking-wider">
              Agency Management Tools
            </span>
            <h3 className="font-serif text-lg font-bold text-stone-900 mt-0.5">
              Enter Data for {clientName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-xl font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Type Selector Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setEntryType("sales")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              entryType === "sales"
                ? "bg-[#1A1A1A] text-white"
                : "bg-stone-50 text-stone-700 border border-stone-200 hover:bg-stone-100"
            }`}
          >
            Log Daily Sales
          </button>
          <button
            onClick={() => setEntryType("campaign")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              entryType === "campaign"
                ? "bg-[#1A1A1A] text-white"
                : "bg-stone-50 text-stone-700 border border-stone-200 hover:bg-stone-100"
            }`}
          >
            Add Ad Campaign
          </button>
          <button
            onClick={() => setEntryType("lead")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              entryType === "lead"
                ? "bg-[#1A1A1A] text-white"
                : "bg-stone-50 text-stone-700 border border-stone-200 hover:bg-stone-100"
            }`}
          >
            Add Lead
          </button>
          <button
            onClick={() => setEntryType("content")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              entryType === "content"
                ? "bg-[#1A1A1A] text-white"
                : "bg-stone-50 text-stone-700 border border-stone-200 hover:bg-stone-100"
            }`}
          >
            Post Creative for Approval
          </button>
        </div>

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
            <FaCheckCircle className="text-emerald-600" /> {success}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* 1. SALES FORM */}
        {entryType === "sales" && (
          <form onSubmit={handleSalesSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Date</label>
                <input
                  type="date"
                  value={salesForm.date}
                  onChange={(e) => setSalesForm({ ...salesForm, date: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Total Sales Revenue (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 54000"
                  value={salesForm.totalRevenue}
                  onChange={(e) => setSalesForm({ ...salesForm, totalRevenue: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Orders / Covers</label>
                <input
                  type="number"
                  placeholder="e.g. 72"
                  value={salesForm.ordersCount}
                  onChange={(e) => setSalesForm({ ...salesForm, ordersCount: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Ad-Attributed Revenue (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 24000"
                  value={salesForm.adAttributedRevenue}
                  onChange={(e) => setSalesForm({ ...salesForm, adAttributedRevenue: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Returns / Cancellations (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={salesForm.returnsAmount}
                  onChange={(e) => setSalesForm({ ...salesForm, returnsAmount: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Internal Notes</label>
              <input
                type="text"
                placeholder="e.g. Weekend brunch rush, high specialty coffee volume"
                value={salesForm.notes}
                onChange={(e) => setSalesForm({ ...salesForm, notes: e.target.value })}
                className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
              />
            </div>

            <div className="pt-4 border-t border-[#EFE9E0] flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 font-semibold bg-[#1A1A1A] hover:bg-stone-800 text-white rounded-lg"
              >
                {submitting ? "Saving..." : "Save Sales Record"}
              </button>
            </div>
          </form>
        )}

        {/* 2. CAMPAIGN FORM */}
        {entryType === "campaign" && (
          <form onSubmit={handleCampaignSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Campaign Name</label>
                <input
                  type="text"
                  placeholder="e.g. Weekend Brunch Reservations Boost"
                  value={campaignForm.campaignName}
                  onChange={(e) => setCampaignForm({ ...campaignForm, campaignName: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Platform</label>
                <select
                  value={campaignForm.platform}
                  onChange={(e) => setCampaignForm({ ...campaignForm, platform: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                >
                  <option value="Meta Ads">Meta Ads</option>
                  <option value="Google Ads">Google Ads</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Budget (₹)</label>
                <input
                  type="number"
                  placeholder="25000"
                  value={campaignForm.budget}
                  onChange={(e) => setCampaignForm({ ...campaignForm, budget: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Ad Spend (₹)</label>
                <input
                  type="number"
                  placeholder="12000"
                  value={campaignForm.adSpend}
                  onChange={(e) => setCampaignForm({ ...campaignForm, adSpend: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Attributed Revenue (₹)</label>
                <input
                  type="number"
                  placeholder="48000"
                  value={campaignForm.attributedRevenue}
                  onChange={(e) => setCampaignForm({ ...campaignForm, attributedRevenue: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Impressions</label>
                <input
                  type="number"
                  placeholder="42000"
                  value={campaignForm.impressions}
                  onChange={(e) => setCampaignForm({ ...campaignForm, impressions: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Clicks</label>
                <input
                  type="number"
                  placeholder="1840"
                  value={campaignForm.clicks}
                  onChange={(e) => setCampaignForm({ ...campaignForm, clicks: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Leads</label>
                <input
                  type="number"
                  placeholder="84"
                  value={campaignForm.leads}
                  onChange={(e) => setCampaignForm({ ...campaignForm, leads: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Conversions</label>
                <input
                  type="number"
                  placeholder="48"
                  value={campaignForm.conversions}
                  onChange={(e) => setCampaignForm({ ...campaignForm, conversions: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#EFE9E0] flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 font-semibold bg-[#1A1A1A] hover:bg-stone-800 text-white rounded-lg"
              >
                {submitting ? "Saving..." : "Add Campaign"}
              </button>
            </div>
          </form>
        )}

        {/* 3. LEAD FORM */}
        {entryType === "lead" && (
          <form onSubmit={handleLeadSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Customer / Guest Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sanya Mirza"
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+91 98..."
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Source</label>
                <select
                  value={leadForm.source}
                  onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                >
                  <option value="Meta Ads">Meta Ads</option>
                  <option value="Google Ads">Google Ads</option>
                  <option value="Website Enquiry">Website Enquiry</option>
                  <option value="Instagram DM">Instagram DM</option>
                  <option value="Walk-in">Walk-in</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Stage</label>
                <select
                  value={leadForm.status}
                  onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                >
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Converted">Converted</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Est. Value (₹)</label>
                <input
                  type="number"
                  placeholder="3500"
                  value={leadForm.estimatedValue}
                  onChange={(e) => setLeadForm({ ...leadForm, estimatedValue: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Initial Follow-up Note</label>
              <textarea
                placeholder="Requested outdoor table reservation for weekend anniversary brunch..."
                value={leadForm.noteText}
                onChange={(e) => setLeadForm({ ...leadForm, noteText: e.target.value })}
                rows={2}
                className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
              />
            </div>

            <div className="pt-4 border-t border-[#EFE9E0] flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 font-semibold bg-[#1A1A1A] hover:bg-stone-800 text-white rounded-lg"
              >
                {submitting ? "Saving..." : "Save Lead"}
              </button>
            </div>
          </form>
        )}

        {/* 4. CONTENT FORM */}
        {entryType === "content" && (
          <form onSubmit={handleContentSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Creative Title</label>
                <input
                  type="text"
                  placeholder="e.g. Signature Truffle Croissant Reel"
                  value={contentForm.title}
                  onChange={(e) => setContentForm({ ...contentForm, title: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Format</label>
                <select
                  value={contentForm.format}
                  onChange={(e) => setContentForm({ ...contentForm, format: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                >
                  <option value="Reel">Reel / Video</option>
                  <option value="Carousel">Carousel</option>
                  <option value="Static Graphic">Static Graphic</option>
                  <option value="High-Res Photo">High-Res Photo</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Creative Image / Video URL</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={contentForm.creativeUrl}
                  onChange={(e) => setContentForm({ ...contentForm, creativeUrl: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Planned Publishing Date</label>
                <input
                  type="date"
                  value={contentForm.scheduledDate}
                  onChange={(e) => setContentForm({ ...contentForm, scheduledDate: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Caption & Copy</label>
              <textarea
                placeholder="Write creative caption, hashtags, and call to action..."
                value={contentForm.caption}
                onChange={(e) => setContentForm({ ...contentForm, caption: e.target.value })}
                rows={3}
                className="w-full p-2.5 rounded-lg border border-[#E0D8CE]"
                required
              />
            </div>

            <div className="pt-4 border-t border-[#EFE9E0] flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 font-semibold bg-[#1A1A1A] hover:bg-stone-800 text-white rounded-lg"
              >
                {submitting ? "Posting..." : "Submit for Client Approval"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
