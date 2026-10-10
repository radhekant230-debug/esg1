import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import api from "../../utils/axios";
import { useBiz } from "../../context/BizContext";
import { FaGem, FaPlus, FaEdit, FaSpinner, FaTimes, FaInfoCircle } from "react-icons/fa";

// ─── Constants ───────────────────────────────────────────────────────────────

const METAL_TYPES = ["gold", "silver", "platinum", "other"];

const METAL_META = {
  gold:     { label: "Gold",     color: "text-yellow-600", bg: "bg-yellow-50",  border: "border-yellow-200", badge: "bg-yellow-100 text-yellow-700" },
  silver:   { label: "Silver",   color: "text-slate-500",  bg: "bg-slate-50",   border: "border-slate-200",  badge: "bg-slate-100 text-slate-600"   },
  platinum: { label: "Platinum", color: "text-sky-600",    bg: "bg-sky-50",     border: "border-sky-200",    badge: "bg-sky-100 text-sky-700"       },
  other:    { label: "Other",    color: "text-gray-500",   bg: "bg-gray-50",    border: "border-gray-200",   badge: "bg-gray-100 text-gray-600"     },
};

const TOLA_FACTOR = 11.664; // 1 tola = 11.664 grams

const INITIAL_FORM = {
  metalType: "gold",
  purity: "22K",
  ratePerGram: "",
  ratePerTola: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupByMetal(rates) {
  const groups = {};
  METAL_TYPES.forEach((m) => (groups[m] = []));
  rates.forEach((r) => {
    const key = r.metalType ?? "other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });
  // Sort each group newest-first
  Object.keys(groups).forEach((k) => {
    groups[k].sort((a, b) => new Date(b.effectiveDate ?? b.createdAt) - new Date(a.effectiveDate ?? a.createdAt));
  });
  return groups;
}

// ─── Rate Card (latest) ───────────────────────────────────────────────────────

function LatestRateCard({ rate, meta }) {
  return (
    <div className={`rounded-2xl border ${meta.border} ${meta.bg} p-5 flex flex-col gap-3`}>
      <div className="flex items-center gap-2">
        <FaGem className={`text-xl ${meta.color}`} />
        <div>
          <p className="text-sm font-bold text-gray-900 capitalize">{rate.metalType}</p>
          <p className="text-xs text-gray-500">{rate.purity}</p>
        </div>
        <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${meta.badge}`}>
          Latest
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/70 rounded-xl p-3 border border-white">
          <p className="text-xs text-gray-500 font-medium">Per Gram</p>
          <p className="text-xl font-bold text-gray-900 mt-0.5">
            ₹{Number(rate.ratePerGram ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white/70 rounded-xl p-3 border border-white">
          <p className="text-xs text-gray-500 font-medium">Per Tola</p>
          <p className="text-xl font-bold text-gray-900 mt-0.5">
            ₹{Number(rate.ratePerTola ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Effective: {formatDate(rate.effectiveDate ?? rate.createdAt)}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MetalRates() {
  const { bizId } = useParams();
  const { business, canManage } = useBiz();

  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Expanded history sections
  const [expandedMetals, setExpandedMetals] = useState({});

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  const fetchRates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/biz/businesses/${bizId}/metal-rates`);
      setRates(Array.isArray(data) ? data : (data.rates ?? []));
    } catch (err) {
      setError(err?.response?.data?.message ?? "Failed to load metal rates.");
    } finally {
      setLoading(false);
    }
  }, [bizId]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // ─── Modal helpers ─────────────────────────────────────────────────────────

  const openModal = () => {
    setForm(INITIAL_FORM);
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (!saving) setShowModal(false);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      // Auto-calculate tola when gram changes (unless user is editing tola directly)
      if (name === "ratePerGram" && value !== "") {
        const gram = parseFloat(value);
        if (!isNaN(gram)) {
          updated.ratePerTola = (gram * TOLA_FACTOR).toFixed(2);
        }
      }
      return updated;
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.purity.trim()) { setFormError("Purity is required."); return; }
    if (!form.ratePerGram || isNaN(Number(form.ratePerGram)) || Number(form.ratePerGram) <= 0) {
      setFormError("Enter a valid rate per gram.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await api.post(`/biz/businesses/${bizId}/metal-rates`, {
        metalType: form.metalType,
        purity: form.purity,
        ratePerGram: Number(form.ratePerGram),
        ratePerTola: form.ratePerTola ? Number(form.ratePerTola) : Number(form.ratePerGram) * TOLA_FACTOR,
      });
      setShowModal(false);
      await fetchRates();
    } catch (err) {
      setFormError(err?.response?.data?.message ?? "Failed to save rate.");
    } finally {
      setSaving(false);
    }
  };

  const toggleHistory = (metalType) => {
    setExpandedMetals((p) => ({ ...p, [metalType]: !p[metalType] }));
  };

  // ─── Derived ───────────────────────────────────────────────────────────────

  const grouped = groupByMetal(rates);
  const activeMetals = METAL_TYPES.filter((m) => grouped[m].length > 0);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center">
            <FaGem className="text-yellow-500 text-lg" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Metal Rates</h1>
            <p className="text-sm text-gray-500">{business?.name}</p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={openModal}
            className="flex items-center gap-2 bg-[#0f172a] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1e293b] transition shadow"
          >
            <FaPlus className="text-xs" />
            Add Rate
          </button>
        )}
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
        <FaInfoCircle className="mt-0.5 shrink-0 text-amber-500" />
        <span>Rates are entered manually. Integration with live market data is not included.</span>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-32 gap-3 text-gray-400">
          <FaSpinner className="text-3xl animate-spin text-yellow-400" />
          <span className="text-sm font-medium">Loading rates…</span>
        </div>
      ) : activeMetals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-gray-400">
          <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center">
            <FaGem className="text-4xl text-gray-300" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-600">No rates entered yet</p>
            <p className="text-sm mt-1">Add today's metal rates to track prices over time</p>
          </div>
          {canManage && (
            <button
              onClick={openModal}
              className="flex items-center gap-2 bg-[#0f172a] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1e293b] transition shadow"
            >
              <FaPlus className="text-xs" />
              Add First Rate
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {activeMetals.map((metalType) => {
            const meta = METAL_META[metalType] ?? METAL_META.other;
            const list = grouped[metalType];
            const latest = list[0];
            const history = list.slice(1);
            const isExpanded = expandedMetals[metalType];

            return (
              <div key={metalType}>
                {/* Latest Rate Card */}
                <LatestRateCard rate={latest} meta={meta} />

                {/* History */}
                {history.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => toggleHistory(metalType)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition mb-2"
                    >
                      <span>{isExpanded ? "▲" : "▼"}</span>
                      {isExpanded ? "Hide" : "Show"} history ({history.length} entries)
                    </button>

                    {isExpanded && (
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5">Purity</th>
                              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-2.5">Per Gram (₹)</th>
                              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-2.5">Per Tola (₹)</th>
                              <th className="text-right text-xs font-semibold text-gray-500 px-4 py-2.5">Effective Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.map((rate, idx) => (
                              <tr key={rate._id ?? idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition">
                                <td className="px-4 py-2.5 text-gray-700 font-medium">{rate.purity}</td>
                                <td className="px-4 py-2.5 text-right text-gray-700">
                                  {Number(rate.ratePerGram ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-2.5 text-right text-gray-700">
                                  {Number(rate.ratePerTola ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-2.5 text-right text-gray-500 text-xs">
                                  {formatDate(rate.effectiveDate ?? rate.createdAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Add Rate Modal ────────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Add Metal Rate</h2>
              <button onClick={closeModal} disabled={saving} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none transition disabled:opacity-40">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                  {formError}
                </div>
              )}

              {/* Metal Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Metal Type</label>
                <select
                  name="metalType"
                  value={form.metalType}
                  onChange={handleFormChange}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f172a] transition bg-white"
                >
                  {METAL_TYPES.map((t) => (
                    <option key={t} value={t} className="capitalize">
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Purity */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Purity <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="purity"
                  value={form.purity}
                  onChange={handleFormChange}
                  placeholder="e.g. 22K, 18K, 999"
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a] transition"
                />
              </div>

              {/* Rate Per Gram */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Rate per Gram (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="ratePerGram"
                  value={form.ratePerGram}
                  onChange={handleFormChange}
                  placeholder="e.g. 6500"
                  min={0}
                  step="0.01"
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a] transition"
                />
              </div>

              {/* Rate Per Tola */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Rate per Tola (₹)
                </label>
                <p className="text-xs text-gray-400 mb-1.5">
                  Auto-calculated (1 tola = 11.664 g) — editable
                </p>
                <input
                  type="number"
                  name="ratePerTola"
                  value={form.ratePerTola}
                  onChange={handleFormChange}
                  placeholder="Auto-calculated"
                  min={0}
                  step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a] transition"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-[#0f172a] text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-[#1e293b] transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <FaSpinner className="animate-spin text-xs" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <FaGem className="text-xs" />
                      Save Rate
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
