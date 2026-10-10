import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useBiz } from '../../context/BizContext';
import {
  FaWarehouse,
  FaSearch,
  FaExclamationTriangle,
  FaPlus,
} from 'react-icons/fa';
import api from '../../utils/axios';

const initialAdjustForm = {
  productId: '',
  quantity: '',
  reason: '',
  type: 'adjustment',
};

const ADJUSTMENT_TYPES = [
  { value: 'adjustment', label: 'Manual Adjustment' },
  { value: 'purchase', label: 'Purchase / Received' },
  { value: 'return', label: 'Customer Return' },
  { value: 'damage', label: 'Damage / Loss' },
  { value: 'other', label: 'Other' },
];

export default function Inventory() {
  const { bizId } = useParams();
  const { canManage } = useBiz();

  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState(initialAdjustForm);
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = showLowStock ? '?lowstock=true' : '';
      const res = await api.get(
        `/biz/businesses/${bizId}/inventory${qs}`
      );
      setInventory(res.data?.data || res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load inventory.');
    } finally {
      setLoading(false);
    }
  }, [bizId, showLowStock]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  /* ── Derived ── */
  const lowStockCount = inventory.filter(
    (item) =>
      Number(item.currentStock ?? 0) <=
      Number(item.reorderLevel ?? item.product?.reorderLevel ?? 0)
  ).length;

  const filtered = inventory.filter((item) => {
    const name = item.product?.name || item.productName || '';
    return (
      search === '' || name.toLowerCase().includes(search.toLowerCase())
    );
  });

  /* ── Adjust modal helpers ── */
  const openAdjust = (item) => {
    setSelectedItem(item);
    setAdjustForm({
      ...initialAdjustForm,
      productId: item.product?._id || item.productId || '',
    });
    setAdjustError(null);
    setShowAdjustModal(true);
  };

  const closeAdjust = () => {
    setShowAdjustModal(false);
    setSelectedItem(null);
    setAdjustError(null);
  };

  const handleAdjustChange = (e) => {
    const { name, value } = e.target;
    setAdjustForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (adjustForm.quantity === '' || adjustForm.quantity === null) {
      setAdjustError('Quantity is required.');
      return;
    }
    setAdjustLoading(true);
    setAdjustError(null);
    try {
      await api.post(`/biz/businesses/${bizId}/inventory/adjust`, {
        ...adjustForm,
        quantity: Number(adjustForm.quantity),
      });
      closeAdjust();
      fetchInventory();
    } catch (err) {
      setAdjustError(
        err.response?.data?.message || 'Stock adjustment failed.'
      );
    } finally {
      setAdjustLoading(false);
    }
  };

  /* ── Badge ── */
  const stockBadge = (stock, reorder) => {
    const s = Number(stock);
    const r = Number(reorder);
    if (s > r)
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          OK
        </span>
      );
    if (s === r)
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          <FaExclamationTriangle className="text-xs" /> Low
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <FaExclamationTriangle className="text-xs" /> Critical
      </span>
    );
  };

  /* ── Projected stock after adjustment ── */
  const projectedStock =
    selectedItem && adjustForm.quantity !== ''
      ? Number(selectedItem.currentStock ?? 0) + Number(adjustForm.quantity)
      : null;

  return (
    <div className="p-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <FaWarehouse className="text-indigo-600 text-xl" />
          <h1 className="text-2xl font-bold text-gray-800">Inventory</h1>
          {lowStockCount > 0 && (
            <span className="flex items-center gap-1.5 bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              <FaExclamationTriangle className="text-xs" />
              {lowStockCount} low-stock item{lowStockCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
          <input
            type="text"
            placeholder="Search product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showLowStock}
            onChange={(e) => setShowLowStock(e.target.checked)}
            className="accent-indigo-600 w-4 h-4"
          />
          Low Stock Only
        </label>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div className="flex justify-center items-center h-48 text-gray-400 text-sm">
          Loading inventory…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  'Product',
                  'Category',
                  'Unit',
                  'Current Stock',
                  'Reorder Level',
                  'Stock Value (₹)',
                  'Status',
                  'Action',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-14 text-gray-400 text-sm"
                  >
                    No inventory records found.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const productName =
                    item.product?.name || item.productName || '—';
                  const category =
                    item.product?.category?.name ||
                    item.categoryName ||
                    '—';
                  const unit =
                    item.product?.unit || item.unit || '—';
                  const stock = item.currentStock ?? 0;
                  const reorder =
                    item.reorderLevel ??
                    item.product?.reorderLevel ??
                    0;
                  const costPrice =
                    item.product?.costPrice || item.costPrice || 0;
                  const stockValue = (
                    Number(stock) * Number(costPrice)
                  ).toFixed(2);

                  return (
                    <tr
                      key={item._id}
                      className="hover:bg-indigo-50/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                        {productName}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {category}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {unit}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                        {stock}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {reorder}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {stockValue}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {stockBadge(stock, reorder)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {canManage && (
                          <button
                            onClick={() => openAdjust(item)}
                            className="flex items-center gap-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 px-3 py-1.5 rounded-lg font-medium transition-all"
                          >
                            <FaPlus className="text-xs" />
                            Adjust
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Adjust Stock Modal ── */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeAdjust}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">
                Adjust Stock
              </h2>
              <button
                onClick={closeAdjust}
                className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="px-6 py-5 space-y-4">
              {adjustError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
                  {adjustError}
                </div>
              )}

              {/* Current stock info */}
              {selectedItem && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1">
                  <p className="font-semibold text-gray-800 text-sm">
                    {selectedItem.product?.name || selectedItem.productName}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      Current Stock:{' '}
                      <span className="font-semibold text-gray-700">
                        {selectedItem.currentStock ?? 0}{' '}
                        {selectedItem.product?.unit || ''}
                      </span>
                    </span>
                    {projectedStock !== null && (
                      <span>
                        After Adjustment:{' '}
                        <span
                          className={`font-semibold ${
                            projectedStock < 0
                              ? 'text-red-600'
                              : 'text-indigo-700'
                          }`}
                        >
                          {projectedStock}{' '}
                          {selectedItem.product?.unit || ''}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Quantity{' '}
                  <span className="text-gray-400 font-normal">
                    (use negative for reduction)
                  </span>{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  name="quantity"
                  type="number"
                  step="any"
                  value={adjustForm.quantity}
                  onChange={handleAdjustChange}
                  required
                  placeholder="e.g. 10 or -5"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Adjustment Type
                </label>
                <select
                  name="type"
                  value={adjustForm.type}
                  onChange={handleAdjustChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                >
                  {ADJUSTMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Reason / Notes
                </label>
                <textarea
                  name="reason"
                  value={adjustForm.reason}
                  onChange={handleAdjustChange}
                  rows={2}
                  placeholder="Reason for this adjustment…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeAdjust}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustLoading}
                  className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg font-medium disabled:opacity-50 transition-all"
                >
                  {adjustLoading ? 'Saving…' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
