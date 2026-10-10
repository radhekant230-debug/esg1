import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/axios';
import { useBiz } from '../../context/BizContext';
import { FaMoneyBillWave, FaPlus, FaEdit, FaTrash, FaSearch } from 'react-icons/fa';

const CATEGORIES = [
  'rent', 'salary', 'electricity', 'supplies',
  'transport', 'marketing', 'maintenance', 'purchase', 'other',
];

const CATEGORY_STYLES = {
  rent:         'bg-red-100 text-red-700 border border-red-200',
  salary:       'bg-blue-100 text-blue-700 border border-blue-200',
  electricity:  'bg-amber-100 text-amber-700 border border-amber-200',
  supplies:     'bg-green-100 text-green-700 border border-green-200',
  transport:    'bg-indigo-100 text-indigo-700 border border-indigo-200',
  marketing:    'bg-purple-100 text-purple-700 border border-purple-200',
  maintenance:  'bg-gray-100 text-gray-700 border border-gray-200',
  purchase:     'bg-teal-100 text-teal-700 border border-teal-200',
  other:        'bg-slate-100 text-slate-600 border border-slate-200',
};

const CATEGORY_DOT = {
  rent:         'bg-red-400',
  salary:       'bg-blue-400',
  electricity:  'bg-amber-400',
  supplies:     'bg-green-400',
  transport:    'bg-indigo-400',
  marketing:    'bg-purple-400',
  maintenance:  'bg-gray-400',
  purchase:     'bg-teal-400',
  other:        'bg-slate-400',
};

const EMPTY_FORM = {
  category: 'other',
  amount: '',
  description: '',
  vendor: '',
  expenseDate: '',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function categoryLabel(c) {
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : '';
}

export default function Expenses() {
  const { bizId } = useParams();
  const { biz } = useBiz();

  /* ── data ── */
  const [expenses, setExpenses] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /* ── filters ── */
  const [filters, setFilters] = useState({ from: '', to: '', category: '', search: '' });

  /* ── modal ── */
  const [showModal, setShowModal] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  /* ─────────────────────── fetch ─────────────────────── */
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { ...filters };
      Object.keys(params).forEach((k) => !params[k] && delete params[k]);
      const { data } = await api.get(`/biz/businesses/${bizId}/expenses`, { params });
      const list = data.expenses ?? data ?? [];
      setExpenses(list);
      setTotalAmount(
        data.totalAmount ??
          list.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0),
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load expenses.');
    } finally {
      setLoading(false);
    }
  }, [bizId, filters]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  /* ─────────────────────── filter handlers ─────────────────────── */
  const handleFilterChange = (e) => {
    setFilters((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const clearFilters = () =>
    setFilters({ from: '', to: '', category: '', search: '' });

  /* ─────────────────────── modal helpers ─────────────────────── */
  const openAdd = () => {
    setEditExpense(null);
    setForm({ ...EMPTY_FORM, expenseDate: todayISO() });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (exp) => {
    setEditExpense(exp);
    setForm({
      category: exp.category || 'other',
      amount: String(exp.amount ?? ''),
      description: exp.description || '',
      vendor: exp.vendor || '',
      expenseDate: exp.expenseDate
        ? exp.expenseDate.slice(0, 10)
        : (exp.createdAt ? exp.createdAt.slice(0, 10) : todayISO()),
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditExpense(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const handleFormChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  /* ─────────────────────── submit ─────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.expenseDate) {
      setFormError('Please select an expense date.');
      return;
    }
    const amount = parseFloat(form.amount);
    if (!form.amount || isNaN(amount) || amount <= 0) {
      setFormError('Enter a valid amount greater than zero.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = { ...form, amount };
      if (editExpense) {
        await api.put(
          `/biz/businesses/${bizId}/expenses/${editExpense._id}`,
          payload,
        );
      } else {
        await api.post(`/biz/businesses/${bizId}/expenses`, payload);
      }
      closeModal();
      fetchExpenses();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ─────────────────────── delete ─────────────────────── */
  const handleDelete = async (exp) => {
    const label = exp.description || categoryLabel(exp.category);
    if (!window.confirm(`Delete expense "${label}"?\nThis cannot be undone.`)) return;
    try {
      await api.delete(`/biz/businesses/${bizId}/expenses/${exp._id}`);
      fetchExpenses();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    }
  };

  /* ─────────────────────── formatters ─────────────────────── */
  const fmt = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(n ?? 0);

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');

  /* ─────────────────────── derived ─────────────────────── */
  const categorySummary = CATEGORIES.reduce((acc, cat) => {
    const sum = expenses
      .filter((e) => e.category === cat)
      .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    if (sum > 0) acc.push({ cat, sum });
    return acc;
  }, []).sort((a, b) => b.sum - a.sum);

  /* ══════════════════════════════════════════════════════════ */
  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 rounded-xl">
            <FaMoneyBillWave className="text-emerald-600 text-lg" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">Expenses</h1>
            {biz?.name && <p className="text-sm text-gray-400">{biz.name}</p>}
          </div>
        </div>

        {/* Summary card */}
        <div className="flex items-center gap-4 ml-auto">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-3 text-center">
            <p className="text-xs text-emerald-500 font-semibold uppercase tracking-wide mb-0.5">
              Total
            </p>
            <p className="text-xl font-bold text-emerald-700">{fmt(totalAmount)}</p>
            <p className="text-xs text-emerald-400">{expenses.length} entries</p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-emerald-200"
          >
            <FaPlus className="text-xs" />
            Add Expense
          </button>
        </div>
      </div>

      {/* ── Category mini-summary bar ── */}
      {categorySummary.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {categorySummary.slice(0, 6).map(({ cat, sum }) => (
            <div
              key={cat}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                CATEGORY_STYLES[cat] || 'bg-gray-100 text-gray-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${CATEGORY_DOT[cat] || 'bg-gray-400'}`}
              />
              {categoryLabel(cat)}: {fmt(sum)}
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">From</label>
            <input
              type="date"
              name="from"
              value={filters.from}
              onChange={handleFilterChange}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">To</label>
            <input
              type="date"
              name="to"
              value={filters.to}
              onChange={handleFilterChange}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Category</label>
            <select
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-transparent bg-white"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{categoryLabel(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Search</label>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input
                type="text"
                name="search"
                placeholder="Description / Vendor"
                value={filters.search}
                onChange={handleFilterChange}
                className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
            >
              Clear Filters
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
            <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading expenses…</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <FaMoneyBillWave className="text-4xl mb-2 opacity-20" />
            <p className="text-sm font-medium">No expenses found</p>
            <p className="text-xs mt-1">Adjust your filters or add a new expense</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Date', 'Category', 'Description', 'Vendor', 'Amount', 'Actions'].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {expenses.map((exp) => (
                  <tr
                    key={exp._id}
                    className="hover:bg-gray-50/60 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {fmtDate(exp.expenseDate || exp.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          CATEGORY_STYLES[exp.category] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            CATEGORY_DOT[exp.category] || 'bg-gray-400'
                          }`}
                        />
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[220px] truncate">
                      {exp.description || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {exp.vendor || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {fmt(exp.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(exp)}
                          title="Edit"
                          className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <FaEdit className="text-xs" />
                        </button>
                        <button
                          onClick={() => handleDelete(exp)}
                          title="Delete"
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-3 text-sm font-bold text-gray-700 text-right"
                  >
                    Period Total
                  </td>
                  <td className="px-4 py-3 font-bold text-emerald-700 text-sm">
                    {fmt(totalAmount)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════ Add / Edit Modal ══════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 rounded-lg">
                  <FaMoneyBillWave className="text-emerald-600 text-sm" />
                </div>
                <h2 className="text-base font-bold text-gray-900">
                  {editExpense ? 'Edit Expense' : 'Add New Expense'}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg text-lg font-bold transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    Category <span className="text-red-400">*</span>
                  </label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleFormChange}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{categoryLabel(c)}</option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    Amount (₹) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={form.amount}
                    onChange={handleFormChange}
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Description
                </label>
                <input
                  type="text"
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  placeholder="Brief description of the expense"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Vendor */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    Vendor / Payee
                  </label>
                  <input
                    type="text"
                    name="vendor"
                    value={form.vendor}
                    onChange={handleFormChange}
                    placeholder="Vendor name"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    Expense Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    name="expenseDate"
                    value={form.expenseDate}
                    onChange={handleFormChange}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
              </div>

              {/* Actions */}
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
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving…' : editExpense ? 'Update Expense' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
