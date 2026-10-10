import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/axios';
import { useBiz } from '../../context/BizContext';
import { FaReceipt, FaSearch, FaEye, FaBan, FaFilter } from 'react-icons/fa';

const STATUS_BADGE = {
  completed: 'bg-green-100 text-green-700 border border-green-200',
  cancelled: 'bg-red-100 text-red-700 border border-red-200',
  partial: 'bg-amber-100 text-amber-700 border border-amber-200',
  refunded: 'bg-purple-100 text-purple-700 border border-purple-200',
};

const STATUSES = ['completed', 'partial', 'cancelled', 'refunded'];
const PAYMENT_METHODS = ['cash', 'card', 'upi', 'credit', 'cheque', 'other'];
const LIMIT = 20;

const defaultFilters = { from: '', to: '', status: '', paymentMethod: '', search: '' };

export default function SalesList() {
  const { bizId } = useParams();
  const { biz } = useBiz();

  const [sales, setSales] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [pendingFilters, setPendingFilters] = useState(defaultFilters);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: LIMIT, ...filters };
      Object.keys(params).forEach((k) => !params[k] && delete params[k]);
      const { data } = await api.get(`/biz/businesses/${bizId}/sales`, { params });
      setSales(data.sales ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? (Math.ceil((data.total ?? 0) / LIMIT) || 1));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load sales.');
    } finally {
      setLoading(false);
    }
  }, [bizId, page, filters]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const applyFilters = () => {
    setFilters(pendingFilters);
    setPage(1);
    setExpandedId(null);
  };

  const clearFilters = () => {
    setPendingFilters(defaultFilters);
    setFilters(defaultFilters);
    setPage(1);
    setExpandedId(null);
  };

  const handlePendingChange = (e) =>
    setPendingFilters((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleKeyDown = (e) => { if (e.key === 'Enter') applyFilters(); };

  const handleCancel = async (sale) => {
    if (!window.confirm(`Cancel invoice ${sale.invoiceNo}?\nThis action cannot be undone.`)) return;
    try {
      await api.put(`/biz/businesses/${bizId}/sales/${sale._id}/cancel`);
      fetchSales();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel sale.');
    }
  };

  const toggleExpand = (id) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const fmt = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(n ?? 0);

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-indigo-100 rounded-xl">
          <FaReceipt className="text-indigo-600 text-lg" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">Sales History</h1>
          {biz?.name && <p className="text-sm text-gray-400">{biz.name}</p>}
        </div>
        <span className="ml-auto text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {total} records
        </span>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <FaFilter className="text-gray-400 text-xs" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filters</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* From */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">From</label>
            <input
              type="date"
              name="from"
              value={pendingFilters.from}
              onChange={handlePendingChange}
              onKeyDown={handleKeyDown}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
            />
          </div>
          {/* To */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">To</label>
            <input
              type="date"
              name="to"
              value={pendingFilters.to}
              onChange={handlePendingChange}
              onKeyDown={handleKeyDown}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
            />
          </div>
          {/* Status */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Status</label>
            <select
              name="status"
              value={pendingFilters.status}
              onChange={handlePendingChange}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent bg-white"
            >
              <option value="">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{cap(s)}</option>
              ))}
            </select>
          </div>
          {/* Payment Method */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Payment</label>
            <select
              name="paymentMethod"
              value={pendingFilters.paymentMethod}
              onChange={handlePendingChange}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent bg-white"
            >
              <option value="">All Methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m.toUpperCase()}</option>
              ))}
            </select>
          </div>
          {/* Search */}
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs text-gray-400 mb-1 block">Search</label>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input
                type="text"
                name="search"
                placeholder="Invoice / Customer"
                value={pendingFilters.search}
                onChange={handlePendingChange}
                onKeyDown={handleKeyDown}
                className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
              />
            </div>
          </div>
          {/* Buttons */}
          <div className="flex items-end gap-2">
            <button
              onClick={applyFilters}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-3 py-2 text-sm font-medium transition-colors"
            >
              Apply
            </button>
            <button
              onClick={clearFilters}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading sales…</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <FaReceipt className="text-4xl mb-2 opacity-20" />
            <p className="text-sm font-medium">No sales found</p>
            <p className="text-xs mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {[
                    'Invoice No', 'Customer', 'Items', 'Total',
                    'Paid', 'Balance', 'Method', 'Status', 'Date', 'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sales.map((sale) => (
                  <React.Fragment key={sale._id}>
                    {/* ── Main row ── */}
                    <tr
                      className={`transition-colors hover:bg-gray-50/60 ${
                        expandedId === sale._id ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-indigo-600 font-semibold text-xs">
                        {sale.invoiceNo}
                      </td>
                      <td className="px-4 py-3 text-gray-800 font-medium">
                        {sale.customer?.name || sale.customerName || <span className="text-gray-400">Walk-in</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {sale.items?.length ?? 0}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{fmt(sale.total)}</td>
                      <td className="px-4 py-3 text-green-700 font-medium">{fmt(sale.paid)}</td>
                      <td className="px-4 py-3 text-red-500 font-medium">{fmt(sale.balance)}</td>
                      <td className="px-4 py-3 uppercase text-xs font-semibold text-gray-500">
                        {sale.paymentMethod || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            STATUS_BADGE[sale.status] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {sale.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {fmtDate(sale.createdAt || sale.saleDate || sale.date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleExpand(sale._id)}
                            title={expandedId === sale._id ? 'Collapse' : 'View Items'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              expandedId === sale._id
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'text-indigo-500 hover:bg-indigo-50'
                            }`}
                          >
                            <FaEye className="text-xs" />
                          </button>
                          {sale.status !== 'cancelled' && sale.status !== 'refunded' && (
                            <button
                              onClick={() => handleCancel(sale)}
                              title="Cancel Sale"
                              className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <FaBan className="text-xs" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* ── Expanded item breakdown ── */}
                    {expandedId === sale._id && (
                      <tr>
                        <td
                          colSpan={10}
                          className="bg-gradient-to-r from-indigo-50/40 to-purple-50/20 px-6 py-4 border-b border-indigo-100"
                        >
                          <div className="max-w-2xl">
                            <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3">
                              Line Items — {sale.invoiceNo}
                            </p>
                            {sale.items && sale.items.length > 0 ? (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-indigo-200/60">
                                    <th className="text-left pb-2 text-gray-500 font-semibold">Product</th>
                                    <th className="text-right pb-2 text-gray-500 font-semibold w-16">Qty</th>
                                    <th className="text-right pb-2 text-gray-500 font-semibold w-24">Unit Price</th>
                                    <th className="text-right pb-2 text-gray-500 font-semibold w-24">Discount</th>
                                    <th className="text-right pb-2 text-gray-500 font-semibold w-24">Line Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-indigo-100/40">
                                  {sale.items.map((item, i) => {
                                    const qty = item.qty ?? item.quantity ?? 1;
                                    const price = item.price ?? item.unitPrice ?? 0;
                                    const discount = item.discount ?? 0;
                                    const lineTotal =
                                      item.total ?? item.lineTotal ?? qty * price - discount;
                                    return (
                                      <tr key={i}>
                                        <td className="py-1.5 text-gray-700 font-medium">
                                          {item.product?.name ||
                                            item.productName ||
                                            item.name ||
                                            `Item ${i + 1}`}
                                        </td>
                                        <td className="py-1.5 text-right text-gray-600">{qty}</td>
                                        <td className="py-1.5 text-right text-gray-600">{fmt(price)}</td>
                                        <td className="py-1.5 text-right text-amber-600">
                                          {discount > 0 ? fmt(discount) : '—'}
                                        </td>
                                        <td className="py-1.5 text-right font-semibold text-gray-900">
                                          {fmt(lineTotal)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t border-indigo-200/60">
                                    <td
                                      colSpan={4}
                                      className="pt-2 text-right font-bold text-gray-700 pr-4"
                                    >
                                      Grand Total
                                    </td>
                                    <td className="pt-2 text-right font-bold text-indigo-700">
                                      {fmt(sale.total)}
                                    </td>
                                  </tr>
                                  {(sale.discount ?? 0) > 0 && (
                                    <tr>
                                      <td colSpan={4} className="text-right text-xs text-gray-400 pr-4">
                                        Overall Discount
                                      </td>
                                      <td className="text-right text-xs text-amber-600">
                                        -{fmt(sale.discount)}
                                      </td>
                                    </tr>
                                  )}
                                </tfoot>
                              </table>
                            ) : (
                              <p className="text-xs text-gray-400 italic">No item details available.</p>
                            )}
                            {sale.notes && (
                              <p className="mt-3 text-xs text-gray-400 italic border-t border-indigo-100 pt-2">
                                Note: {sale.notes}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {!loading && pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Page <span className="font-semibold">{page}</span> of{' '}
            <span className="font-semibold">{pages}</span> &mdash;{' '}
            <span className="font-semibold">{total}</span> total records
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              ← Prev
            </button>
            {/* Page numbers (compact) */}
            {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
              const p =
                pages <= 5
                  ? i + 1
                  : page <= 3
                  ? i + 1
                  : page >= pages - 2
                  ? pages - 4 + i
                  : page - 2 + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 text-sm rounded-xl font-medium transition-colors ${
                    p === page
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'border border-gray-200 hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
