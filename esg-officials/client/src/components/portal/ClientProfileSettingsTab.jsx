import React, { useState } from "react";
import api from "../../utils/axios";
import {
  FaBuilding,
  FaPhoneAlt,
  FaGlobe,
  FaMapMarkerAlt,
  FaUserTie,
  FaCheckCircle,
  FaSave,
  FaExclamationCircle,
} from "react-icons/fa";

export default function ClientProfileSettingsTab({ profile, clientUser, onRefresh }) {
  const [formData, setFormData] = useState({
    businessName: profile?.businessName || clientUser?.companyName || "",
    tagline: profile?.tagline || "",
    welcomeMessage: profile?.welcomeMessage || "",
    phone: profile?.phone || clientUser?.phone || "",
    website: profile?.website || "",
    address: profile?.address || "",
    logo: profile?.logo || "",
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg("");
      await api.put("/portal/profile", formData);
      setSuccessMsg("Settings updated successfully.");
      setTimeout(() => setSuccessMsg(""), 4000);
      if (onRefresh) onRefresh();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Failed to update settings.");
    } finally {
      setSaving(false);
    }
  };

  const integrations = profile?.integrations || {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-stone-900">
              Business Profile & Integration Settings
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              Brand contact details, reporting preferences, and connected marketing platform telemetry.
            </p>
          </div>
          <span className="text-xs font-mono bg-white px-3 py-1.5 rounded-lg border border-[#E0D8CE] text-stone-700">
            Client ID: {clientUser?.clientId || "Assigned"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Edit Profile Form */}
        <div className="lg:col-span-2 bg-white border border-[#E7DFD5] rounded-xl p-6 sm:p-8 shadow-sm">
          <h4 className="font-serif text-base font-bold text-stone-900 mb-4 pb-3 border-b border-[#EFE9E0]">
            Business Information & Contact Details
          </h4>

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
              <FaCheckCircle className="text-emerald-600" /> {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
              <FaExclamationCircle className="text-rose-600" /> {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Business Name</label>
                <input
                  type="text"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleChange}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE] focus:border-[#9C7A42] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Business Phone</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE] focus:border-[#9C7A42] focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Official Website</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE] focus:border-[#9C7A42] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Brand Logo URL</label>
                <input
                  type="url"
                  name="logo"
                  value={formData.logo}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="w-full p-2.5 rounded-lg border border-[#E0D8CE] focus:border-[#9C7A42] focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Brand Tagline / Core Message</label>
              <input
                type="text"
                name="tagline"
                value={formData.tagline}
                onChange={handleChange}
                className="w-full p-2.5 rounded-lg border border-[#E0D8CE] focus:border-[#9C7A42] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Physical Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={2}
                className="w-full p-2.5 rounded-lg border border-[#E0D8CE] focus:border-[#9C7A42] focus:outline-hidden"
              />
            </div>

            <div className="pt-4 border-t border-[#EFE9E0] flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] hover:bg-stone-800 text-white rounded-lg font-semibold transition cursor-pointer shadow-sm"
              >
                <FaSave /> {saving ? "Saving Changes..." : "Save Business Profile"}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Connected Platforms & Account Manager */}
        <div className="space-y-6">
          {/* Account Manager Box */}
          <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-xl p-5 shadow-2xs">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#E7DFD5]">
              <FaUserTie className="text-[#9C7A42] w-4 h-4" />
              <h4 className="font-serif font-bold text-stone-900 text-sm">
                Assigned Account Manager
              </h4>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-stone-900 text-sm">
                {profile?.accountManagerDetails?.name || "Rahul Sharma"}
              </div>
              <div className="text-stone-500 font-medium">
                {profile?.accountManagerDetails?.role || "Senior Growth Strategist"}
              </div>
              <div className="pt-2 border-t border-[#E7DFD5] space-y-1 text-stone-600">
                <div>Email: {profile?.accountManagerDetails?.email || "rahul.manager@esgofficial.com"}</div>
                <div>Direct Line: {profile?.accountManagerDetails?.phone || "+91 98765 43210"}</div>
              </div>
            </div>
          </div>

          {/* Connected Platforms Status */}
          <div className="bg-white border border-[#E7DFD5] rounded-xl p-5 shadow-2xs">
            <h4 className="font-serif font-bold text-stone-900 text-sm mb-3 pb-2 border-b border-[#EFE9E0]">
              Marketing Integration Status
            </h4>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200">
                <span className="font-semibold text-stone-700">Meta Ads Manager</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {integrations.metaAds?.status || "Connected"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200">
                <span className="font-semibold text-stone-700">Google Ads API</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {integrations.googleAds?.status || "Connected"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200">
                <span className="font-semibold text-stone-700">Instagram Graph API</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {integrations.instagram?.status || "Connected"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200">
                <span className="font-semibold text-stone-700">Google Business Profile</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {integrations.googleBusinessProfile?.status || "Connected"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
