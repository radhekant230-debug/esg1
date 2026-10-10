import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/axios';
import { useBiz } from '../../context/BizContext';
import { FaUsers, FaPlus, FaEdit, FaHistory, FaSearch } from 'react-icons/fa';

const EMPTY_FORM = { name: '', phone: '', email: '', address: '', notes: '' };

const STATUS_STYLE = {
  completed: 'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-700',
  partial:    'bg-amber-100 text-amber-700',
  refunded:   'bg-purple-100 text-purple-700',
};

export default function Customers() {
  const { bizId } = useParams();
  const { biz } = useBiz();

  /* ── customers list ── */
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  /* ── add / edit modal ── */
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  /* ── purchase history drawer ── */
  const [showHistory, setShowHistory] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const searchTimeout = useRef(null);

  /* ─────────────────────── fetch customers ─────────────────────── */
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (search) params.search = search;
      const { data } = await api.get(`/biz/businesses/${bizId}/customers`, { params });
      setCustomers(data.customers ?? data ?? []);
      setTotal(data.total ?? (data.customers ?? data ?? []).length);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load customers.');
    } finally {
      setLoading(false);
    }
  }, [bizId, search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  /* ─────────────────────── search debounce ─────────────────────── */
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearch(val), 380);
  };

  /* ─────────────────────── modal helpers ─────────────────────── */
  const openAdd = () => {
    setEditCustomer(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditCustomer(c);
    setForm({
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      notes: c.notes || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditCustomer(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const handleFormChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  /* ─────────────────────── submit ─────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Customer name is required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editCustomer) {
        await api.put(
          `/biz/businesses/${bizId}/customers/${editCustomer._id}`,
          form,
        );
      } else {
        await api.post(`/biz/businesses/${bizId}/customers`, form);
      }
      closeModal();
      fetchCustomers();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ─────────────────────── history drawer ─────────────────────── */
  const openHistory = async (customer) => {
    setHistoryCustomer(customer);
    setHistory([]);
    setHistoryError('');
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const { data } = await api.get(
        `/biz/businesses/${bizId}/customers/${customer._id}/history`,
      );
      setHistory(data.sales ?? data.history ?? data ?? []);
    } catch (err) {
      setHistoryError(err.response?.data?.message || 'Could not load history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setShowHistory(false);
    setHistoryCustomer(null);
    setHistory([]);
    setHistoryError('');
  };

  /* ─────────────────────── formatters ─────────────────────── */
  const fmt = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(n ?? 0);

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');

  const initials = (name) =>
    (name || '?')
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');

  /* ── avatar colour based on first char ── */
  const avatarColor = (name) => {
    const colours = [
      'bg-sky-100 text-sky-700',
      'bg-violet-100 text-violet-700',
      'bg-rose-100 text-rose-700',
      'bg-emerald-100 text-emerald-700',
      'bg-amber-100 text-amber-700',
      'bg-indigo-100 text-indigo-700',
    ];
    const idx = ((name || 'A').charCodeAt(0) - 65) % colours.length;
    return colours[Math.abs(idx)];
  };

  /* ══════════════════════════════════════════════════════════ */
  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-100 rounded-xl">
            <FaUsers className="text-sky-600 text-lg" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">Customers</h1>
            {biz?.name && <p className="text-sm text-gray-400">{biz.name}</p>}
          </div>
          <span className="text-sm text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
            {total} total
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Search by name, phone, email…"
              value={searchInput}
              onChange={handleSearchChange}
              className="border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-transparent w-64"
            />
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-sky-200"
          >
            <FaPlus className="text-xs" />
            Add Customer
          </button>
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
            <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading customers…</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <FaUsers className="text-4xl mb-2 opacity-20" />
            <p className="text-sm font-medium">No customers found</p>
            {searchInput && (
              <p className="text-xs mt-1 text-gray-400">
                No results for "{searchInput}"
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {[
                    'Customer', 'Phone', 'Email',
                    'Total Purchases', 'Total Spent (₹)', 'Actions',
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
                {customers.map((c) => (
                  <tr
                    key={c._id}
                    className="hover:bg-gray-50/60 transition-colors"
                  >
                    {/* Name + avatar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(
                            c.name,
                          )}`}
                        >
                          {initials(c.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 leading-tight">
                            {c.name}
                          </p>
                          {c.address && (
                            <p className="text-xs text-gray-400 truncate max-w-[140px]">
                              {c.address}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.phone || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="text-sky-600 hover:underline"
                        >
                          {c.email}
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block bg-sky-50 text-sky-700 font-semibold px-2.5 py-0.5 rounded-full text-xs">
                        {c.purchaseCount ?? c.totalPurchases ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {fmt(c.totalSpent ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          title="Edit Customer"
                          className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <FaEdit className="text-xs" />
                        </button>
                        <button
                          onClick={() => openHistory(c)}
                          title="Purchase History"
                          className="p-1.5 text-sky-500 hover:bg-sky-50 rounded-lg transition-colors"
                        >
                          <FaHistory className="text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════ Add / Edit Modal ══════════════════ */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-100 rounded-lg">
                  <FaUsers className="text-sky-600 text-sm" />
                </div>
                <h2 className="text-base font-bold text-gray-900">
                  {editCustomer ? 'Edit Customer' : 'Add New Customer'}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg text-lg font-bold transition-colors"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">
                  {formError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="Customer's full name"
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Phone */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleFormChange}
                    placeholder="+91 99999 99999"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                </div>
                {/* Email */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleFormChange}
                    placeholder="email@example.com"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Address
                </label>
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleFormChange}
                  rows={2}
                  placeholder="Street, City, State, PIN"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 resize-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleFormChange}
                  rows={2}
                  placeholder="Any additional notes about this customer"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {saving ? 'Saving…' : editCustomer ? 'Update Customer' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ Purchase History Drawer ══════════════════ */}
      {showHistory && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
          onClick={closeHistory}
        >
          <div
            className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    historyCustomer ? avatarColor(historyCustomer.name) : 'bg-sky-100 text-sky-700'
                  }`}
                >
                  {historyCustomer ? initials(historyCustomer.name) : '?'}
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Purchase History</h2>
                  <p className="text-xs text-gray-400">
                    {historyCustomer?.name}{' '}
                    {historyCustomer?.phone && `· ${historyCustomer.phone}`}
                  </p>
                </div>
              </div>
              <button
                onClick={closeHistory}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg text-lg font-bold transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Stats bar */}
            {!historyLoading && history.length > 0 && (
              <div className="flex gap-4 px-5 py-3 bg-sky-50/40 border-b border-sky-100 flex-shrink-0">
                <div>
                  <p className="text-xs text-gray-400">Transactions</p>
                  <p className="font-bold text-gray-800">{history.length}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total Spent</p>
                  <p className="font-bold text-sky-700">
                    {fmt(history.reduce((s, h) => s + (h.total || 0), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Balance Due</p>
                  <p className="font-bold text-red-500">
                    {fmt(history.reduce((s, h) => s + (h.balance || 0), 0))}
                  </p>
                </div>
              </div>
            )}

            {/* Drawer content */}
            <div className="flex-1 overflow-y-auto p-4">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <div className="w-7 h-7 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
                  <p className="text-sm text-gray-400">Loading history…</p>
                </div>
              ) : historyError ? (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                  {historyError}
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <FaHistory className="text-4xl mb-2 opacity-20" />
                  <p className="text-sm font-medium">No purchase history yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((sale) => (
                    <div
                      key={sale._id}
                      className="border border-gray-100 rounded-2xl p-4 hover:bg-gray-50 transition-colors"
                    >
                      {/* Top row */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold text-indigo-600">
                          {sale.invoiceNo}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                            STATUS_STYLE[sale.status] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {sale.status}
                        </span>
                      </div>

                      {/* Amount row */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-400">
                            {fmtDate(sale.createdAt || sale.saleDate || sale.date)}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {sale.items?.length ?? 0} items ·{' '}
                            {(sale.paymentMethod || '').toUpperCase()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{fmt(sale.total)}</p>
                          {(sale.balance ?? 0) > 0 && (
                            <p className="text-xs text-red-500">
                              Bal: {fmt(sale.balance)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Items (mini) */}
                      {sale.items && sale.items.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          {sale.items.slice(0, 3).map((item, i) => (
                            <div
                              key={i}
                              className="flex justify-between text-xs text-gray-500 py-0.5"
                            >
                              <span className="truncate max-w-[180px]">
                                {item.product?.name || item.productName || `Item ${i + 1}`}
                                {' '}
                                <span className="text-gray-400">
                                  ×{item.qty ?? item.quantity ?? 1}
                                </span>
                              </span>
                              <span className="font-medium text-gray-700 ml-2 flex-shrink-0">
                                {fmt(
                                  item.total ??
                                    (item.qty ?? 1) * (item.price ?? 0) -
                                      (item.discount ?? 0),
                                )}
                              </span>
                            </div>
                          ))}
                          {sale.items.length > 3 && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              +{sale.items.length - 3} more items
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
