import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/axios";
import {
  FaPlus,
  FaCoffee,
  FaUtensils,
  FaTshirt,
  FaGem,
  FaBuilding,
  FaSpinner,
  FaArrowRight,
} from "react-icons/fa";

const TYPE_META = {
  cafe: { icon: FaCoffee, color: "text-amber-500", bg: "bg-amber-50" },
  restaurant: { icon: FaUtensils, color: "text-orange-500", bg: "bg-orange-50" },
  clothing: { icon: FaTshirt, color: "text-sky-500", bg: "bg-sky-50" },
  jewellery: { icon: FaGem, color: "text-rose-500", bg: "bg-rose-50" },
};

const ROLE_COLORS = {
  owner: "bg-indigo-100 text-indigo-700",
  admin: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  cashier: "bg-teal-100 text-teal-700",
  staff: "bg-gray-100 text-gray-600",
};

const BUSINESS_TYPES = ["cafe", "restaurant", "clothing", "jewellery"];

const INITIAL_FORM = { name: "", type: "cafe", address: "", phone: "", email: "" };

export default function BusinessList() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [createError, setCreateError] = useState("");

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await api.get("/biz/businesses");
      setBusinesses(Array.isArray(data) ? data : data.businesses ?? []);
    } catch (err) {
      setError(err?.response?.data?.message ?? "Failed to load businesses. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setCreateError("Business name is required.");
      return;
    }
    try {
      setCreating(true);
      setCreateError("");
      const { data } = await api.post("/biz/businesses", form);
      const newBusiness = data.business ?? data;
      setShowCreate(false);
      setForm(INITIAL_FORM);
      await fetchBusinesses();
      navigate(`/biz/${newBusiness._id}/dashboard`);
    } catch (err) {
      setCreateError(err?.response?.data?.message ?? "Failed to create business. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const openModal = () => {
    setForm(INITIAL_FORM);
    setCreateError("");
    setShowCreate(true);
  };

  const closeModal = () => {
    if (!creating) {
      setShowCreate(false);
      setCreateError("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Businesses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage all your registered businesses</p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 bg-[#0f172a] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1e293b] active:scale-95 transition-all shadow"
        >
          <FaPlus className="text-xs" />
          New Business
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-gray-400">
            <FaSpinner className="text-4xl animate-spin text-indigo-500" />
            <p className="text-sm font-medium">Loading businesses…</p>
          </div>
        ) : businesses.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-gray-400">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center">
              <FaBuilding className="text-4xl text-gray-300" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-600">No businesses yet</p>
              <p className="text-sm mt-1">Create your first business to get started</p>
            </div>
            <button
              onClick={openModal}
              className="flex items-center gap-2 bg-[#0f172a] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1e293b] transition-colors shadow"
            >
              <FaPlus className="text-xs" />
              Create Business
            </button>
          </div>
        ) : (
          /* Business Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {businesses.map((biz) => {
              const meta = TYPE_META[biz.type] ?? {
                icon: FaBuilding,
                color: "text-gray-500",
                bg: "bg-gray-50",
              };
              const Icon = meta.icon;
              const roleClass = ROLE_COLORS[biz.myRole] ?? ROLE_COLORS.staff;

              return (
                <div
                  key={biz._id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group flex flex-col"
                  onClick={() => navigate(`/biz/${biz._id}/dashboard`)}
                >
                  <div className="p-5 flex-1">
                    {/* Icon + Role */}
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 ${meta.bg} rounded-xl flex items-center justify-center`}>
                        <Icon className={`text-2xl ${meta.color}`} />
                      </div>
                      {biz.myRole && (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${roleClass}`}>
                          {biz.myRole}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <h2 className="text-base font-bold text-gray-900 leading-snug truncate">{biz.name}</h2>
                    <p className="text-xs font-medium text-gray-400 capitalize mt-0.5">{biz.type}</p>
                    {biz.address && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">{biz.address}</p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-5 pb-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/biz/${biz._id}/dashboard`);
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-gray-50 group-hover:bg-[#0f172a] group-hover:text-white text-gray-700 text-sm font-semibold py-2 rounded-lg transition-all border border-gray-100 group-hover:border-transparent"
                    >
                      Open
                      <FaArrowRight className="text-xs" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Business Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Create New Business</h2>
              <button
                onClick={closeModal}
                disabled={creating}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none transition-colors disabled:opacity-40"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                  {createError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="e.g. Sunrise Cafe"
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a] focus:border-transparent transition"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Business Type</label>
                <select
                  name="type"
                  value={form.type}
                  onChange={handleFormChange}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f172a] focus:border-transparent transition bg-white"
                >
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t} className="capitalize">
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={handleFormChange}
                  placeholder="Street, City, State"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a] focus:border-transparent transition"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleFormChange}
                  placeholder="+91 98765 43210"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a] focus:border-transparent transition"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleFormChange}
                  placeholder="business@example.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a] focus:border-transparent transition"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={creating}
                  className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-[#0f172a] text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-[#1e293b] transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {creating ? (
                    <>
                      <FaSpinner className="animate-spin text-xs" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <FaPlus className="text-xs" />
                      Create Business
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
