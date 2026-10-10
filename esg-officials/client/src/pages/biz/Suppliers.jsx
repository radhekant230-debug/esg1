import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/axios';
import { useBiz } from '../../context/BizContext';
import { FaTruck, FaPlus, FaEdit, FaSearch, FaHistory } from 'react-icons/fa';

/* ─── constants ─── */
const SUPPLIER_CATEGORIES = [
  'Electronics', 'Clothing', 'Food & Beverage', 'Pharmaceuticals',
  'Raw Materials', 'Stationery', 'Hardware', 'Software', 'Other',
];

const PAYMENT_METHODS = ['cash', 'card', 'upi', 'bank_transfer', 'cheque', 'credit', 'other'];

const PO_STATUSES = ['pending', 'received', 'partial', 'cancelled'];

const STATUS_STYLE = {
  pending:    'bg-amber-100 text-amber-700 border border-amber-200',
  received:   'bg-green-100 text-green-700 border border-green-200',
  partial:    'bg-blue-100 text-blue-700 border border-blue-200',
  cancelled:  'bg-red-100 text-red-700 border border-red-200',
};

const EMPTY_SUPPLIER_FORM = {
  name: '', phone: '', email: '', address: '', category: 'Other', notes: '',
};

const EMPTY_PURCHASE_FORM = {
  supplierId: '',
  items: [],
  paymentMethod: 'cash',
  notes: '',
  purchaseDate: '',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function Suppliers() {
  const { bizId } = useParams();
  const { biz } = useBiz();

  /* ── tab ── */
  const [activeTab, setActiveTab] = useState('suppliers'); // 'suppliers' | 'purchases'

  /* ── suppliers ── */
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersTotal, setSuppliersTotal] = useState(0);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliersError, setSuppliersError] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierSearchInput, setSupplierSearchInput] = useState('');

  /* ── supplier modal ── */
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER_FORM);
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [supplierFormError, setSupplierFormError] = useState('');

  /* ── purchases ── */
  const [purchases, setPurchases] = useState([]);
  const [purchasesTotal, setPurchasesTotal] = useState(0);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchasesError, setPurchasesError] = useState('');
  const [purchaseFilters, setPurchaseFilters] = useState({
    from: '', to: '', status: '', supplierId: '',
  });

  /* ── purchase modal ── */
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    ...EMPTY_PURCHASE_FORM, purchaseDate: todayISO(),
  });
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [purchaseFormError, setPurchaseFormError] = useState('');

  /* ── product search (inside purchase modal) ── */
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [productSearching, setProductSearching] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const supplierSearchTimeout = useRef(null);
  const productSearchTimeout = useRef(null);
  const productInputRef = useRef(null);

  /* ─────────────────────────────────────────────────────────────
     SUPPLIERS – fetch
  ──────────────────────────────────────────────────────────────*/
  const fetchSuppliers = useCallback(async () => {
    setSuppliersLoading(true);
    setSuppliersError('');
    try {
      const params = {};
      if (supplierSearch) params.search = supplierSearch;
      const { data } = await api.get(`/biz/businesses/${bizId}/suppliers`, { params });
      setSuppliers(data.suppliers ?? data ?? []);
      setSuppliersTotal(data.total ?? (data.suppliers ?? data ?? []).length);
    } catch (err) {
      setSuppliersError(err.response?.data?.message || 'Failed to load suppliers.');
    } finally {
      setSuppliersLoading(false);
    }
  }, [bizId, supplierSearch]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  /* ─────────────────────────────────────────────────────────────
     PURCHASES – fetch
  ──────────────────────────────────────────────────────────────*/
  const fetchPurchases = useCallback(async () => {
    setPurchasesLoading(true);
    setPurchasesError('');
    try {
      const params = { ...purchaseFilters };
      Object.keys(params).forEach((k) => !params[k] && delete params[k]);
      const { data } = await api.get(`/biz/businesses/${bizId}/purchases`, { params });
      setPurchases(data.purchases ?? data ?? []);
      setPurchasesTotal(data.total ?? (data.purchases ?? data ?? []).length);
    } catch (err) {
      setPurchasesError(err.response?.data?.message || 'Failed to load purchases.');
    } finally {
      setPurchasesLoading(false);
    }
  }, [bizId, purchaseFilters]);

  useEffect(() => {
    if (activeTab === 'purchases') fetchPurchases();
  }, [activeTab, fetchPurchases]);

  /* ─────────────────────────────────────────────────────────────
     SUPPLIER search debounce
  ──────────────────────────────────────────────────────────────*/
  const handleSupplierSearchChange = (e) => {
    const val = e.target.value;
    setSupplierSearchInput(val);
    clearTimeout(supplierSearchTimeout.current);
    supplierSearchTimeout.current = setTimeout(() => setSupplierSearch(val), 380);
  };

  /* ─────────────────────────────────────────────────────────────
     SUPPLIER modal helpers
  ──────────────────────────────────────────────────────────────*/
  const openAddSupplier = () => {
    setEditSupplier(null);
    setSupplierForm(EMPTY_SUPPLIER_FORM);
    setSupplierFormError('');
    setShowSupplierModal(true);
  };

  const openEditSupplier = (s) => {
    setEditSupplier(s);
    setSupplierForm({
      name: s.name || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      category: s.category || 'Other',
      notes: s.notes || '',
    });
    setSupplierFormError('');
    setShowSupplierModal(true);
  };

  const closeSupplierModal = () => {
    setShowSupplierModal(false);
    setEditSupplier(null);
    setSupplierForm(EMPTY_SUPPLIER_FORM);
    setSupplierFormError('');
  };

  const handleSupplierFormChange = (e) =>
    setSupplierForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSupplierSubmit = async (e) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) {
      setSupplierFormError('Supplier name is required.');
      return;
    }
    setSupplierSaving(true);
    setSupplierFormError('');
    try {
      if (editSupplier) {
        await api.put(
          `/biz/businesses/${bizId}/suppliers/${editSupplier._id}`,
          supplierForm,
        );
      } else {
        await api.post(`/biz/businesses/${bizId}/suppliers`, supplierForm);
      }
      closeSupplierModal();
      fetchSuppliers();
    } catch (err) {
      setSupplierFormError(err.response?.data?.message || 'Save failed.');
    } finally {
      setSupplierSaving(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     PURCHASE modal helpers
  ──────────────────────────────────────────────────────────────*/
  const openAddPurchase = () => {
    setPurchaseForm({ ...EMPTY_PURCHASE_FORM, purchaseDate: todayISO() });
    setProductQuery('');
    setProductResults([]);
    setShowProductDropdown(false);
    setPurchaseFormError('');
    setShowPurchaseModal(true);
  };

  const closePurchaseModal = () => {
    setShowPurchaseModal(false);
    setPurchaseForm({ ...EMPTY_PURCHASE_FORM, purchaseDate: todayISO() });
    setProductQuery('');
    setProductResults([]);
    setShowProductDropdown(false);
    setPurchaseFormError('');
  };

  const handlePurchaseFormChange = (e) =>
    setPurchaseForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  /* ─── product search (inside purchase modal) ─── */
  const handleProductQueryChange = (e) => {
    const val = e.target.value;
    setProductQuery(val);
    setShowProductDropdown(true);
    clearTimeout(productSearchTimeout.current);
    if (!val.trim()) {
      setProductResults([]);
      return;
    }
    productSearchTimeout.current = setTimeout(async () => {
      setProductSearching(true);
      try {
        const { data } = await api.get(`/biz/businesses/${bizId}/products`, {
          params: { search: val, limit: 10 },
        });
        setProductResults(data.products ?? data ?? []);
      } catch {
        setProductResults([]);
      } finally {
        setProductSearching(false);
      }
    }, 350);
  };

  const addProductToItems = (product) => {
    setPurchaseForm((f) => {
      const existing = f.items.findIndex((i) => i.productId === product._id);
      if (existing > -1) {
        const updated = [...f.items];
        updated[existing] = { ...updated[existing], qty: updated[existing].qty + 1 };
        return { ...f, items: updated };
      }
      return {
        ...f,
        items: [
          ...f.items,
          {
            productId: product._id,
            productName: product.name,
            qty: 1,
            costPrice: product.costPrice ?? product.purchasePrice ?? product.price ?? 0,
          },
        ],
      };
    });
    setProductQuery('');
    setProductResults([]);
    setShowProductDropdown(false);
    productInputRef.current?.focus();
  };

  const updateItem = (index, field, value) => {
    setPurchaseForm((f) => {
      const updated = [...f.items];
      updated[index] = {
        ...updated[index],
        [field]: field === 'qty' || field === 'costPrice' ? parseFloat(value) || 0 : value,
      };
      return { ...f, items: updated };
    });
  };

  const removeItem = (index) => {
    setPurchaseForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== index),
    }));
  };

  const purchaseTotal = purchaseForm.items.reduce(
    (sum, item) => sum + (item.qty || 0) * (item.costPrice || 0),
    0,
  );

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    if (!purchaseForm.supplierId) {
      setPurchaseFormError('Please select a supplier.');
      return;
    }
    if (!purchaseForm.purchaseDate) {
      setPurchaseFormError('Please select a purchase date.');
      return;
    }
    if (purchaseForm.items.length === 0) {
      setPurchaseFormError('Add at least one product.');
      return;
    }
    const invalidItem = purchaseForm.items.find((i) => !i.qty || i.qty <= 0 || i.costPrice < 0);
    if (invalidItem) {
      setPurchaseFormError(`Invalid qty or cost price for "${invalidItem.productName}".`);
      return;
    }
    setPurchaseSaving(true);
    setPurchaseFormError('');
    try {
      await api.post(`/biz/businesses/${bizId}/purchases`, purchaseForm);
      closePurchaseModal();
      fetchPurchases();
    } catch (err) {
      setPurchaseFormError(err.response?.data?.message || 'Save failed.');
    } finally {
      setPurchaseSaving(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     FORMATTERS
  ──────────────────────────────────────────────────────────────*/
  const fmt = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(n ?? 0);

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-100 rounded-xl">
            <FaTruck className="text-orange-600 text-lg" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">Suppliers</h1>
            {biz?.name && <p className="text-sm text-gray-400">{biz.name}</p>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {activeTab === 'suppliers' && (
            <button
              onClick={openAddSupplier}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-orange-200"
            >
              <FaPlus className="text-xs" /> Add Supplier
            </button>
          )}
          {activeTab === 'purchases' && (
            <button
              onClick={openAddPurchase}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-indigo-200"
            >
              <FaPlus className="text-xs" /> New Purchase
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-5 w-fit">
        {[
          { key: 'suppliers', label: 'Suppliers', icon: FaTruck },
          { key: 'purchases', label: 'Purchases', icon: FaHistory },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === key
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="text-xs" />
            {label}
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === key
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {key === 'suppliers' ? suppliersTotal : purchasesTotal}
            </span>
          </button>
        ))}
      </div>

      {/* ════════════════════════════ TAB 1: SUPPLIERS ════════════════════════════ */}
      {activeTab === 'suppliers' && (
        <>
          {/* Supplier search */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
            <div className="relative max-w-sm">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input
                type="text"
                placeholder="Search suppliers…"
                value={supplierSearchInput}
                onChange={handleSupplierSearchChange}
                className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
          </div>

          {suppliersError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
              {suppliersError}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {suppliersLoading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Loading suppliers…</p>
              </div>
            ) : suppliers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <FaTruck className="text-4xl mb-2 opacity-20" />
                <p className="text-sm font-medium">No suppliers found</p>
                <p className="text-xs mt-1 text-gray-400">Add your first supplier to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Supplier', 'Phone', 'Email', 'Category', 'Total Purchases (₹)', 'Actions'].map(
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
                    {suppliers.map((s) => (
                      <tr key={s._id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-gray-800">{s.name}</p>
                            {s.address && (
                              <p className="text-xs text-gray-400 truncate max-w-[160px]">
                                {s.address}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {s.phone || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {s.email ? (
                            <a
                              href={`mailto:${s.email}`}
                              className="text-orange-600 hover:underline"
                            >
                              {s.email}
                            </a>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block bg-orange-50 text-orange-700 border border-orange-100 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                            {s.category || 'Other'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {fmt(s.totalPurchases ?? s.purchasesTotal ?? 0)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openEditSupplier(s)}
                            title="Edit Supplier"
                            className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <FaEdit className="text-xs" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════ TAB 2: PURCHASES ════════════════════════════ */}
      {activeTab === 'purchases' && (
        <>
          {/* Purchase filters */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">From</label>
                <input
                  type="date"
                  name="from"
                  value={purchaseFilters.from}
                  onChange={(e) =>
                    setPurchaseFilters((f) => ({ ...f, from: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">To</label>
                <input
                  type="date"
                  name="to"
                  value={purchaseFilters.to}
                  onChange={(e) =>
                    setPurchaseFilters((f) => ({ ...f, to: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Status</label>
                <select
                  name="status"
                  value={purchaseFilters.status}
                  onChange={(e) =>
                    setPurchaseFilters((f) => ({ ...f, status: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  <option value="">All Statuses</option>
                  {PO_STATUSES.map((s) => (
                    <option key={s} value={s}>{cap(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Supplier</label>
                <select
                  name="supplierId"
                  value={purchaseFilters.supplierId}
                  onChange={(e) =>
                    setPurchaseFilters((f) => ({ ...f, supplierId: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  <option value="">All Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() =>
                  setPurchaseFilters({ from: '', to: '', status: '', supplierId: '' })
                }
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {purchasesError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
              {purchasesError}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {purchasesLoading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Loading purchases…</p>
              </div>
            ) : purchases.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <FaHistory className="text-4xl mb-2 opacity-20" />
                <p className="text-sm font-medium">No purchase records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Date', 'PO No', 'Supplier', 'Items', 'Total', 'Status', 'Method'].map(
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
                    {purchases.map((po) => (
                      <tr key={po._id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {fmtDate(po.purchaseDate || po.createdAt)}
                        </td>
                        <td className="px-4 py-3 font-mono text-indigo-600 font-semibold text-xs">
                          {po.poNo || po.purchaseNo || po._id?.slice(-6).toUpperCase()}
                        </td>
                        <td className="px-4 py-3 text-gray-800 font-medium">
                          {po.supplier?.name || po.supplierName || '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                            {po.items?.length ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {fmt(po.total ?? po.totalAmount ?? 0)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                              STATUS_STYLE[po.status] || 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {po.status || 'pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3 uppercase text-xs font-semibold text-gray-500">
                          {po.paymentMethod || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-700 text-right">
                        Total
                      </td>
                      <td className="px-4 py-3 font-bold text-indigo-700 text-sm">
                        {fmt(purchases.reduce((s, p) => s + (p.total ?? p.totalAmount ?? 0), 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════ ADD / EDIT SUPPLIER MODAL ══════════════════ */}
      {showSupplierModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={closeSupplierModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 rounded-lg">
                  <FaTruck className="text-orange-600 text-sm" />
                </div>
                <h2 className="text-base font-bold text-gray-900">
                  {editSupplier ? 'Edit Supplier' : 'Add New Supplier'}
                </h2>
              </div>
              <button
                onClick={closeSupplierModal}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg text-lg font-bold transition-colors"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSupplierSubmit} className="px-6 py-5 space-y-4">
              {supplierFormError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">
                  {supplierFormError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    Supplier Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={supplierForm.name}
                    onChange={handleSupplierFormChange}
                    placeholder="Supplier company name"
                    autoFocus
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={supplierForm.phone}
                    onChange={handleSupplierFormChange}
                    placeholder="+91 99999 99999"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={supplierForm.email}
                    onChange={handleSupplierFormChange}
                    placeholder="supplier@example.com"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Category</label>
                  <select
                    name="category"
                    value={supplierForm.category}
                    onChange={handleSupplierFormChange}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                  >
                    {SUPPLIER_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Address</label>
                  <textarea
                    name="address"
                    value={supplierForm.address}
                    onChange={handleSupplierFormChange}
                    rows={2}
                    placeholder="Street, City, State, PIN"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Notes</label>
                  <textarea
                    name="notes"
                    value={supplierForm.notes}
                    onChange={handleSupplierFormChange}
                    rows={2}
                    placeholder="Terms, lead time, contact person…"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeSupplierModal}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={supplierSaving}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {supplierSaving ? 'Saving…' : editSupplier ? 'Update Supplier' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════ ADD PURCHASE MODAL ══════════════════ */}
      {showPurchaseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={closePurchaseModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 rounded-lg">
                  <FaPlus className="text-indigo-600 text-sm" />
                </div>
                <h2 className="text-base font-bold text-gray-900">New Purchase Order</h2>
              </div>
              <button
                onClick={closePurchaseModal}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg text-lg font-bold transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {purchaseFormError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-xl">
                  {purchaseFormError}
                </div>
              )}

              {/* Row 1: Supplier + Date + Payment */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-3 sm:col-span-1">
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    Supplier <span className="text-red-400">*</span>
                  </label>
                  <select
                    name="supplierId"
                    value={purchaseForm.supplierId}
                    onChange={handlePurchaseFormChange}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  >
                    <option value="">Select supplier…</option>
                    {suppliers.map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    Purchase Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    name="purchaseDate"
                    value={purchaseForm.purchaseDate}
                    onChange={handlePurchaseFormChange}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    Payment Method
                  </label>
                  <select
                    name="paymentMethod"
                    value={purchaseForm.paymentMethod}
                    onChange={handlePurchaseFormChange}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product search */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Add Products <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                  <input
                    ref={productInputRef}
                    type="text"
                    value={productQuery}
                    onChange={handleProductQueryChange}
                    onFocus={() => productQuery && setShowProductDropdown(true)}
                    onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                    placeholder="Search products to add…"
                    className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />

                  {showProductDropdown && (productSearching || productResults.length > 0) && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
                      {productSearching ? (
                        <div className="px-4 py-3 text-sm text-gray-400 text-center">
                          Searching…
                        </div>
                      ) : (
                        productResults.map((p) => (
                          <button
                            key={p._id}
                            type="button"
                            onMouseDown={() => addProductToItems(p)}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 flex items-center justify-between border-b border-gray-50 last:border-0 transition-colors"
                          >
                            <div>
                              <p className="font-medium text-gray-800">{p.name}</p>
                              {p.sku && (
                                <p className="text-xs text-gray-400">SKU: {p.sku}</p>
                              )}
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                              <p className="font-semibold text-indigo-600 text-xs">
                                Cost:{' '}
                                {new Intl.NumberFormat('en-IN', {
                                  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
                                }).format(
                                  p.costPrice ?? p.purchasePrice ?? p.price ?? 0,
                                )}
                              </p>
                              {p.stock !== undefined && (
                                <p className="text-xs text-gray-400">Stock: {p.stock}</p>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                      {!productSearching && productResults.length === 0 && productQuery.trim() && (
                        <div className="px-4 py-3 text-sm text-gray-400 text-center">
                          No products found for "{productQuery}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Items table */}
              {purchaseForm.items.length > 0 && (
                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5">
                          Product
                        </th>
                        <th className="text-center text-xs font-semibold text-gray-500 px-3 py-2.5 w-24">
                          Qty
                        </th>
                        <th className="text-center text-xs font-semibold text-gray-500 px-3 py-2.5 w-32">
                          Cost Price (₹)
                        </th>
                        <th className="text-right text-xs font-semibold text-gray-500 px-4 py-2.5 w-28">
                          Total
                        </th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {purchaseForm.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-gray-800 font-medium">
                            {item.productName}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.qty}
                              onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                              className="w-full text-center border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.costPrice}
                              onChange={(e) => updateItem(idx, 'costPrice', e.target.value)}
                              className="w-full text-center border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-gray-900 text-sm">
                            {fmt((item.qty || 0) * (item.costPrice || 0))}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="w-6 h-6 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg transition-colors text-xs mx-auto"
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td colSpan={3} className="px-4 py-2.5 text-sm font-bold text-gray-700 text-right">
                          Grand Total
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-indigo-700">
                          {fmt(purchaseTotal)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Notes</label>
                <textarea
                  name="notes"
                  value={purchaseForm.notes}
                  onChange={handlePurchaseFormChange}
                  rows={2}
                  placeholder="Delivery instructions, reference number, etc."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                type="button"
                onClick={closePurchaseModal}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurchaseSubmit}
                disabled={purchaseSaving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {purchaseSaving
                  ? 'Creating…'
                  : `Create Purchase Order${purchaseForm.items.length > 0 ? ` · ${fmt(purchaseTotal)}` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
