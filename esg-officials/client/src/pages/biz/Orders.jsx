import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import api from "../../utils/axios";
import { useBiz } from "../../context/BizContext";
import {
  FaUtensils,
  FaPlus,
  FaClock,
  FaCheck,
  FaBan,
  FaSync,
  FaSpinner,
  FaTimes,
  FaSearch,
  FaMinus,
} from "react-icons/fa";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUSES = ["pending", "preparing", "ready", "served", "completed"];

const STATUS_META = {
  pending:    { label: "Pending",    bg: "bg-amber-50",  border: "border-amber-200",  badge: "bg-amber-100 text-amber-700",  header: "bg-amber-500"  },
  preparing:  { label: "Preparing",  bg: "bg-blue-50",   border: "border-blue-200",   badge: "bg-blue-100 text-blue-700",    header: "bg-blue-500"   },
  ready:      { label: "Ready",      bg: "bg-green-50",  border: "border-green-200",  badge: "bg-green-100 text-green-700",  header: "bg-green-500"  },
  served:     { label: "Served",     bg: "bg-purple-50", border: "border-purple-200", badge: "bg-purple-100 text-purple-700",header: "bg-purple-500" },
  completed:  { label: "Completed",  bg: "bg-gray-50",   border: "border-gray-200",   badge: "bg-gray-100 text-gray-600",    header: "bg-gray-400"   },
};

const NEXT_STATUS = {
  pending:   "preparing",
  preparing: "ready",
  ready:     "served",
  served:    "completed",
};

const NEXT_LABEL = {
  pending:   "Start Preparing",
  preparing: "Mark Ready",
  ready:     "Mark Served",
  served:    "Complete",
};

const ORDER_TYPES = ["dine-in", "takeaway", "delivery"];

const INITIAL_FORM = {
  orderType: "dine-in",
  tableId: "",
  customerName: "",
  customerPhone: "",
  notes: "",
  items: [],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeElapsed(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`;
}

function calcTotal(items) {
  return items.reduce((sum, i) => sum + (i.price ?? 0) * (i.qty ?? 1), 0);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OrderCard({ order, onAdvance, onCancel, advancing, cancelling }) {
  const meta = STATUS_META[order.status] ?? STATUS_META.pending;
  const nextStatus = NEXT_STATUS[order.status];
  const canCancel = ["pending", "preparing"].includes(order.status);
  const total = order.total ?? calcTotal(order.items ?? []);

  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} p-3 shadow-sm flex flex-col gap-2`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-1">
        <div>
          <span className="text-xs font-bold text-gray-700">#{order.orderNo}</span>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            {order.tableLabel ? `Table: ${order.tableLabel}` : "Takeaway / Delivery"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <FaClock className="text-gray-400 text-[10px]" />
          <span className="text-[10px] text-gray-400">{timeElapsed(order.createdAt)}</span>
        </div>
      </div>

      {/* Customer */}
      {order.customerName && (
        <p className="text-xs font-semibold text-gray-800 truncate">{order.customerName}</p>
      )}

      {/* Items */}
      {order.items && order.items.length > 0 && (
        <ul className="space-y-0.5">
          {order.items.map((item, idx) => (
            <li key={idx} className="text-xs text-gray-600 flex justify-between">
              <span className="truncate">{item.productName ?? item.name}</span>
              <span className="shrink-0 ml-2 text-gray-500">×{item.qty}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Total */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-1.5 mt-0.5">
        <span className="text-xs font-bold text-gray-800">₹{total.toFixed(2)}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${meta.badge}`}>
          {order.orderType ?? ""}
        </span>
      </div>

      {/* Actions */}
      {nextStatus && (
        <button
          onClick={() => onAdvance(order._id, nextStatus)}
          disabled={advancing === order._id}
          className="w-full flex items-center justify-center gap-1.5 bg-[#0f172a] text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-[#1e293b] transition disabled:opacity-60"
        >
          {advancing === order._id ? (
            <FaSpinner className="animate-spin text-[10px]" />
          ) : (
            <FaCheck className="text-[10px]" />
          )}
          {NEXT_LABEL[order.status]}
        </button>
      )}

      {canCancel && (
        <button
          onClick={() => onCancel(order._id)}
          disabled={cancelling === order._id}
          className="w-full flex items-center justify-center gap-1.5 bg-red-50 text-red-600 border border-red-200 text-xs font-semibold py-1.5 rounded-lg hover:bg-red-100 transition disabled:opacity-60"
        >
          {cancelling === order._id ? (
            <FaSpinner className="animate-spin text-[10px]" />
          ) : (
            <FaBan className="text-[10px]" />
          )}
          Cancel
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Orders() {
  const { bizId } = useParams();
  const { business, canManage } = useBiz();

  // Orders state
  const [orders, setOrders] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [advancing, setAdvancing] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  // New order modal
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Products & tables for modal
  const [products, setProducts] = useState([]);
  const [tables, setTables] = useState([]);
  const [productSearch, setProductSearch] = useState("");

  // Auto-refresh
  const [lastRefresh, setLastRefresh] = useState(null);
  const intervalRef = useRef(null);

  // ─── Fetch Orders ───────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/biz/businesses/${bizId}/orders`);
      const list = Array.isArray(data) ? data : (data.orders ?? []);
      const grouped = {};
      STATUSES.forEach((s) => (grouped[s] = []));
      list.forEach((o) => {
        const s = o.status ?? "pending";
        if (grouped[s]) grouped[s].push(o);
      });
      setOrders(grouped);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err?.response?.data?.message ?? "Failed to load orders.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [bizId]);

  useEffect(() => {
    fetchOrders();
    intervalRef.current = setInterval(() => fetchOrders(true), 30000);
    return () => clearInterval(intervalRef.current);
  }, [fetchOrders]);

  // ─── Fetch Products & Tables for Modal ─────────────────────────────────────

  const fetchModalData = useCallback(async () => {
    try {
      const [prodRes, tableRes] = await Promise.all([
        api.get(`/biz/businesses/${bizId}/products`),
        api.get(`/biz/businesses/${bizId}/tables`),
      ]);
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data.products ?? []));
      setTables(Array.isArray(tableRes.data) ? tableRes.data : (tableRes.data.tables ?? []));
    } catch {
      // non-critical
    }
  }, [bizId]);

  const openNewOrder = () => {
    setNewOrderForm(INITIAL_FORM);
    setSubmitError("");
    setProductSearch("");
    fetchModalData();
    setShowNewOrder(true);
  };

  // ─── Advance / Cancel ──────────────────────────────────────────────────────

  const handleAdvance = async (orderId, nextStatus) => {
    setAdvancing(orderId);
    try {
      await api.patch(`/biz/businesses/${bizId}/orders/${orderId}/status`, { status: nextStatus });
      await fetchOrders(true);
    } catch (err) {
      alert(err?.response?.data?.message ?? "Failed to update status.");
    } finally {
      setAdvancing(null);
    }
  };

  const handleCancel = async (orderId) => {
    if (!window.confirm("Cancel this order?")) return;
    setCancelling(orderId);
    try {
      await api.patch(`/biz/businesses/${bizId}/orders/${orderId}/status`, { status: "cancelled" });
      await fetchOrders(true);
    } catch (err) {
      alert(err?.response?.data?.message ?? "Failed to cancel order.");
    } finally {
      setCancelling(null);
    }
  };

  // ─── New Order Handlers ────────────────────────────────────────────────────

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setNewOrderForm((prev) => ({ ...prev, [name]: value }));
  };

  const addItem = (product) => {
    setNewOrderForm((prev) => {
      const exists = prev.items.find((i) => i.productId === product._id);
      if (exists) {
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.productId === product._id ? { ...i, qty: i.qty + 1 } : i
          ),
        };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          { productId: product._id, productName: product.name, price: product.price ?? 0, qty: 1 },
        ],
      };
    });
  };

  const updateItemQty = (productId, delta) => {
    setNewOrderForm((prev) => ({
      ...prev,
      items: prev.items
        .map((i) => (i.productId === productId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0),
    }));
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (newOrderForm.items.length === 0) {
      setSubmitError("Add at least one item.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      await api.post(`/biz/businesses/${bizId}/orders`, newOrderForm);
      setShowNewOrder(false);
      await fetchOrders(true);
    } catch (err) {
      setSubmitError(err?.response?.data?.message ?? "Failed to create order.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Filtered products for search ─────────────────────────────────────────

  const filteredProducts = products.filter((p) =>
    p.name?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const orderTotal = calcTotal(newOrderForm.items);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full flex flex-col">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
            <FaUtensils className="text-orange-500 text-lg" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Order Board</h1>
            <p className="text-sm text-gray-500">{business?.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Auto-refresh chip */}
          <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
            <FaSync className="text-[10px]" />
            Auto-refresh · {lastRefresh ? lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
          </span>

          <button
            onClick={() => fetchOrders()}
            className="flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-50 transition shadow-sm"
          >
            <FaSync className="text-[10px]" />
            Refresh
          </button>

          {canManage && (
            <button
              onClick={openNewOrder}
              className="flex items-center gap-2 bg-[#0f172a] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#1e293b] transition shadow"
            >
              <FaPlus className="text-xs" />
              New Order
            </button>
          )}
        </div>
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
          <FaSpinner className="text-3xl animate-spin text-indigo-400" />
          <span className="text-sm font-medium">Loading orders…</span>
        </div>
      ) : (
        /* Kanban Board */
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {STATUSES.map((status) => {
            const meta = STATUS_META[status];
            const col = orders[status] ?? [];

            return (
              <div
                key={status}
                className="flex-shrink-0 w-72 flex flex-col"
              >
                {/* Column Header */}
                <div className={`${meta.header} rounded-t-xl px-3 py-2.5 flex items-center justify-between`}>
                  <span className="text-white text-sm font-bold">{meta.label}</span>
                  <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">
                    {col.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 bg-white/60 border border-t-0 border-gray-200 rounded-b-xl p-2 space-y-2 min-h-[200px] overflow-y-auto max-h-[calc(100vh-260px)]">
                  {col.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6 italic">No orders</p>
                  ) : (
                    col.map((order) => (
                      <OrderCard
                        key={order._id}
                        order={order}
                        onAdvance={handleAdvance}
                        onCancel={handleCancel}
                        advancing={advancing}
                        cancelling={cancelling}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── New Order Modal ─────────────────────────────────────────────── */}
      {showNewOrder && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm px-4 py-6 overflow-y-auto"
          onClick={() => !submitting && setShowNewOrder(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">New Order</h2>
              <button
                onClick={() => !submitting && setShowNewOrder(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none transition"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="p-6 space-y-5">
              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                  {submitError}
                </div>
              )}

              {/* Order Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Order Type</label>
                <div className="flex gap-2">
                  {ORDER_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewOrderForm((p) => ({ ...p, orderType: t, tableId: "" }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize border transition ${
                        newOrderForm.orderType === t
                          ? "bg-[#0f172a] text-white border-[#0f172a]"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table Select (dine-in only) */}
              {newOrderForm.orderType === "dine-in" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Table</label>
                  <select
                    name="tableId"
                    value={newOrderForm.tableId}
                    onChange={handleFormChange}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0f172a] transition bg-white"
                  >
                    <option value="">Select a table…</option>
                    {tables.filter((t) => t.status === "available").map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.label} (capacity {t.capacity})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Customer Name</label>
                  <input
                    type="text"
                    name="customerName"
                    value={newOrderForm.customerName}
                    onChange={handleFormChange}
                    placeholder="Optional"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a] transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone</label>
                  <input
                    type="tel"
                    name="customerPhone"
                    value={newOrderForm.customerPhone}
                    onChange={handleFormChange}
                    placeholder="Optional"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a] transition"
                  />
                </div>
              </div>

              {/* Product Search */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Add Items</label>
                <div className="relative mb-2">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search products…"
                    className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a] transition"
                  />
                </div>

                {/* Product List */}
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4 italic">No products found</p>
                  ) : (
                    filteredProducts.slice(0, 30).map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => addItem(p)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition border-b border-gray-100 last:border-0"
                      >
                        <span className="font-medium text-gray-800 truncate">{p.name}</span>
                        <span className="text-gray-500 shrink-0 ml-2">₹{(p.price ?? 0).toFixed(2)}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Selected Items */}
              {newOrderForm.items.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Selected Items</p>
                  </div>
                  {newOrderForm.items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-0"
                    >
                      <span className="flex-1 text-sm font-medium text-gray-800 truncate">{item.productName}</span>
                      <span className="text-xs text-gray-500 shrink-0">₹{item.price.toFixed(2)}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateItemQty(item.productId, -1)}
                          className="w-6 h-6 flex items-center justify-center rounded-md bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 transition text-xs"
                        >
                          <FaMinus />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold text-gray-800">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateItemQty(item.productId, 1)}
                          className="w-6 h-6 flex items-center justify-center rounded-md bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-600 transition text-xs"
                        >
                          <FaPlus />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">Total</span>
                    <span className="text-sm font-bold text-gray-900">₹{orderTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes</label>
                <textarea
                  name="notes"
                  value={newOrderForm.notes}
                  onChange={handleFormChange}
                  rows={2}
                  placeholder="Special instructions, allergies…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a] transition resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => !submitting && setShowNewOrder(false)}
                  disabled={submitting}
                  className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-[#0f172a] text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-[#1e293b] transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <FaSpinner className="animate-spin text-xs" />
                      Placing…
                    </>
                  ) : (
                    <>
                      <FaUtensils className="text-xs" />
                      Place Order
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
