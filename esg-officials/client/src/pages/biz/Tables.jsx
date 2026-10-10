import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../utils/axios";
import { useBiz } from "../../context/BizContext";
import { FaChair, FaPlus, FaEdit, FaCheck, FaSpinner, FaTimes } from "react-icons/fa";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_META = {
  available: {
    label: "Available",
    dot: "bg-green-500",
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    badge: "bg-green-100 text-green-700",
  },
  occupied: {
    label: "Occupied",
    dot: "bg-amber-500",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-700",
  },
  reserved: {
    label: "Reserved",
    dot: "bg-blue-500",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-700",
  },
  inactive: {
    label: "Inactive",
    dot: "bg-gray-400",
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-500",
    badge: "bg-gray-100 text-gray-500",
  },
};

const INITIAL_FORM = { label: "", capacity: 2, sortOrder: 0 };

// ─── Order Popup ──────────────────────────────────────────────────────────────

function OrderPopup({ table, onClose }) {
  const { bizId } = useParams();
  const navigate = useNavigate();

  if (!table?.currentOrder) return null;
  const order = table.currentOrder;
  const total = order.total ?? (order.items ?? []).reduce((s, i) => s + (i.price ?? 0) * (i.qty ?? 1), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Current Order — {table.label}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <FaTimes />
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span className="font-medium">Order #</span>
            <span className="font-bold text-gray-900">#{order.orderNo}</span>
          </div>
          {order.customerName && (
            <div className="flex justify-between text-gray-600">
              <span className="font-medium">Customer</span>
              <span>{order.customerName}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <span className="font-medium">Status</span>
            <span className="capitalize font-semibold">{order.status}</span>
          </div>

          {order.items && order.items.length > 0 && (
            <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-gray-600">
                  <span className="truncate">{item.productName ?? item.name} ×{item.qty}</span>
                  <span className="shrink-0 ml-2">₹{((item.price ?? 0) * (item.qty ?? 1)).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900">
            <span>Total</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={() => navigate(`/biz/${bizId}/orders`)}
          className="mt-5 w-full bg-[#0f172a] text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-[#1e293b] transition"
        >
          Go to Orders Board
        </button>
      </div>
    </div>
  );
}

// ─── Table Card ───────────────────────────────────────────────────────────────

function TableCard({ table, onEdit, onClick }) {
  const meta = STATUS_META[table.status] ?? STATUS_META.available;

  return (
    <div
      className={`relative rounded-2xl border ${meta.border} ${meta.bg} p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all cursor-pointer group`}
      onClick={onClick}
    >
      {/* Edit button */}
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(table); }}
        className="absolute top-3 right-3 w-7 h-7 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-300 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
        title="Edit table"
      >
        <FaEdit className="text-xs" />
      </button>

      {/* Icon */}
      <div className={`w-12 h-12 ${meta.text.replace("text-", "bg-").replace("-700", "-100").replace("-500", "-100")} rounded-xl flex items-center justify-center`}>
        <FaChair className={`text-2xl ${meta.text}`} />
      </div>

      {/* Label & capacity */}
      <div>
        <p className="text-base font-bold text-gray-900">{table.label}</p>
        <p className="text-xs text-gray-500 mt-0.5">Capacity: {table.capacity}</p>
      </div>

      {/* Status badge */}
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full w-fit ${meta.badge}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
        {meta.label}
      </span>

      {/* Occupied hint */}
      {table.status === "occupied" && table.currentOrder && (
        <p className="text-xs text-amber-600 font-medium truncate">Order #{table.currentOrder.orderNo}</p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Tables() {
  const { bizId } = useParams();
  const { business, canManage } = useBiz();

  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = create
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Occupied popup
  const [popupTable, setPopupTable] = useState(null);

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  const fetchTables = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/biz/businesses/${bizId}/tables`);
      setTables(Array.isArray(data) ? data : (data.tables ?? []));
    } catch (err) {
      setError(err?.response?.data?.message ?? "Failed to load tables.");
    } finally {
      setLoading(false);
    }
  }, [bizId]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // ─── Modal helpers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditTarget(null);
    setForm(INITIAL_FORM);
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (table) => {
    setEditTarget(table);
    setForm({ label: table.label, capacity: table.capacity, sortOrder: table.sortOrder ?? 0 });
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (!saving) setShowModal(false);
  };

  const handleFormChange = (e) => {
    const { name, value, type } = e.target;
    setForm((p) => ({ ...p, [name]: type === "number" ? Number(value) : value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.label.trim()) { setFormError("Label is required."); return; }
    if (form.capacity < 1) { setFormError("Capacity must be at least 1."); return; }
    setSaving(true);
    setFormError("");
    try {
      if (editTarget) {
        await api.put(`/biz/businesses/${bizId}/tables/${editTarget._id}`, form);
      } else {
        await api.post(`/biz/businesses/${bizId}/tables`, form);
      }
      setShowModal(false);
      await fetchTables();
    } catch (err) {
      setFormError(err?.response?.data?.message ?? "Failed to save table.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Card click handler ────────────────────────────────────────────────────

  const handleCardClick = (table) => {
    if (table.status === "occupied" && table.currentOrder) {
      setPopupTable(table);
    }
  };

  // ─── Status summary ────────────────────────────────────────────────────────

  const statusCounts = Object.keys(STATUS_META).reduce((acc, s) => {
    acc[s] = tables.filter((t) => t.status === s).length;
    return acc;
  }, {});

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <FaChair className="text-blue-600 text-lg" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tables</h1>
            <p className="text-sm text-gray-500">{business?.name}</p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#0f172a] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1e293b] transition shadow"
          >
            <FaPlus className="text-xs" />
            Add Table
          </button>
        )}
      </div>

      {/* Status summary bar */}
      {!loading && tables.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <span key={key} className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${meta.badge}`}>
              <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
              {meta.label}: {statusCounts[key]}
            </span>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-32 gap-3 text-gray-400">
          <FaSpinner className="text-3xl animate-spin text-blue-400" />
          <span className="text-sm font-medium">Loading tables…</span>
        </div>
      ) : tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-gray-400">
          <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center">
            <FaChair className="text-4xl text-gray-300" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-600">No tables yet</p>
            <p className="text-sm mt-1">Add tables to start managing your floor layout</p>
          </div>
          {canManage && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-[#0f172a] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#1e293b] transition shadow"
            >
              <FaPlus className="text-xs" />
              Add First Table
            </button>
          )}
        </div>
      ) : (
        /* Table Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {tables
            .slice()
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label))
            .map((table) => (
              <TableCard
                key={table._id}
                table={table}
                onEdit={openEdit}
                onClick={() => handleCardClick(table)}
              />
            ))}
        </div>
      )}

      {/* ─── Add / Edit Modal ──────────────────────────────────────────────── */}
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
              <h2 className="text-lg font-bold text-gray-900">
                {editTarget ? "Edit Table" : "Add Table"}
              </h2>
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

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="label"
                  value={form.label}
                  onChange={handleFormChange}
                  placeholder="e.g. Table 1, Window Seat"
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a] transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Capacity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="capacity"
                  value={form.capacity}
                  onChange={handleFormChange}
                  min={1}
                  max={50}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f172a] transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Sort Order</label>
                <input
                  type="number"
                  name="sortOrder"
                  value={form.sortOrder}
                  onChange={handleFormChange}
                  min={0}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f172a] transition"
                />
                <p className="text-xs text-gray-400 mt-1">Lower number appears first on the floor plan</p>
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
                      <FaCheck className="text-xs" />
                      {editTarget ? "Save Changes" : "Add Table"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Occupied Order Popup ──────────────────────────────────────────── */}
      {popupTable && (
        <OrderPopup table={popupTable} onClose={() => setPopupTable(null)} />
      )}
    </div>
  );
}
