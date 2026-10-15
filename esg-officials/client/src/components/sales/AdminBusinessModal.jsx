import React, { useState, useEffect } from "react";
import api from "../../utils/axios";
import {
  FaTimes,
  FaBuilding,
  FaSpinner,
  FaSave,
  FaMapMarkerAlt,
} from "react-icons/fa";

export default function AdminBusinessModal({ isOpen, onClose, onSuccess, initialBusiness, managers = [] }) {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    category: "Hotel",
    state: "Jharkhand",
    city: "Ranchi",
    address: "",
    monthlyTarget: 300000,
    assignedManager: "",
    clientAccount: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [clients, setClients] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    api
      .get("/portal/clients-selector")
      .then((r) => setClients(r.data?.clients || []))
      .catch(() => setClients([]));
  }, [isOpen]);

  useEffect(() => {
    if (initialBusiness) {
      setFormData({
        name: initialBusiness.name || "",
        code: initialBusiness.code || "",
        category: initialBusiness.category || "Hotel",
        state: initialBusiness.state || "Jharkhand",
        city: initialBusiness.city || "Ranchi",
        address: initialBusiness.address || "",
        monthlyTarget: initialBusiness.monthlyTarget || 300000,
        assignedManager: initialBusiness.assignedManager?._id || initialBusiness.assignedManager || "",
        clientAccount: initialBusiness.clientAccount?._id || initialBusiness.clientAccount || "",
        notes: initialBusiness.notes || "",
      });
    } else {
      setFormData({
        name: "",
        code: "",
        category: "Hotel",
        state: "Jharkhand",
        city: "Ranchi",
        address: "",
        monthlyTarget: 300000,
        assignedManager: "",
        clientAccount: "",
        notes: "",
      });
    }
    setError("");
  }, [initialBusiness, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.city || !formData.state) {
      setError("Please fill in Business Name, City, and State.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        ...formData,
        monthlyTarget: Number(formData.monthlyTarget) || 0,
        assignedManager: formData.assignedManager || null,
        clientAccount: formData.clientAccount || null,
      };

      if (initialBusiness?._id) {
        await api.put(`/sales/businesses/${initialBusiness._id}`, payload);
      } else {
        await api.post("/sales/businesses", payload);
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Save business error:", err);
      setError(err.response?.data?.message || "Failed to save business details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="bg-[#18181B] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl">
              <FaBuilding />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {initialBusiness ? "Edit Business" : "Add New Hotel / Restaurant"}
              </h3>
              <p className="text-xs text-gray-400">Manage state-wise sales business records</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <FaTimes />
          </button>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block font-bold text-gray-700 mb-1">Business Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Hotel Royal, Maya Multicuisine Restaurant"
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="Hotel">Hotel</option>
                <option value="Restaurant">Restaurant</option>
                <option value="Service">Service</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Custom Code / ID</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Auto-generated if empty"
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">State *</label>
              <input
                type="text"
                required
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="e.g. Jharkhand, Rajasthan, Assam"
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">City *</label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g. Ranchi, Dhanbad, Jaipur"
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Full Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="e.g. Main Road, Hindpiri, Ranchi"
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Monthly Target (INR)</label>
              <input
                type="number"
                value={formData.monthlyTarget}
                onChange={(e) => setFormData({ ...formData, monthlyTarget: e.target.value })}
                placeholder="300000"
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Assign Manager</label>
              <select
                value={formData.assignedManager}
                onChange={(e) => setFormData({ ...formData, assignedManager: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="">By State/City Match</option>
                {managers.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} ({m.assignedCity || m.assignedState || m.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Client portal account</label>
            <select
              value={formData.clientAccount}
              onChange={(e) => setFormData({ ...formData, clientAccount: e.target.value })}
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="">Not linked (data visible to managers only)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName} — {c.email}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              Sales uploaded for this business appear automatically in this client's portal. Each business belongs to one client only.
            </p>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Notes / Remarks</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes or contractual agreements..."
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* FOOTER */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <FaSpinner className="animate-spin text-sm" /> Saving...
                </>
              ) : (
                <>
                  <FaSave /> Save Business
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
