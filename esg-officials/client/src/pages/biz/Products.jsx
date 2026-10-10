import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBiz } from '../../context/BizContext';
import { FaPlus, FaSearch, FaEdit, FaArchive, FaBox } from 'react-icons/fa';
import api from '../../utils/axios';

const ITEMS_PER_PAGE = 20;

const initialForm = {
  name: '',
  sku: '',
  sellingPrice: '',
  costPrice: '',
  category: '',
  unit: '',
  reorderLevel: '',
  description: '',
  openingStock: '',
  trackStock: true,
  isAvailable: true,
  metalType: '',
  purity: '',
  grossWeight: '',
  netWeight: '',
  brand: '',
};

export default function Products() {
  const { bizId } = useParams();
  const navigate = useNavigate();
  const { business, canManage } = useBiz();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get(`/biz/businesses/${bizId}/products`),
        api.get(`/biz/businesses/${bizId}/categories`),
      ]);
      setProducts(prodRes.data?.data || prodRes.data || []);
      setCategories(catRes.data?.data || catRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, [bizId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = products.filter((p) => {
    const matchSearch =
      search === '' ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase());
    const matchCat =
      selectedCategory === '' ||
      p.category === selectedCategory ||
      p.category?._id === selectedCategory;
    const matchActive = showInactive ? true : p.isActive !== false;
    return matchSearch && matchCat && matchActive;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const openCreate = () => {
    setEditProduct(null);
    setForm(initialForm);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (product) => {
    setEditProduct(product);
    setForm({
      name: product.name || '',
      sku: product.sku || '',
      sellingPrice: product.sellingPrice ?? '',
      costPrice: product.costPrice ?? '',
      category: product.category?._id || product.category || '',
      unit: product.unit || '',
      reorderLevel: product.reorderLevel ?? '',
      description: product.description || '',
      openingStock: product.openingStock ?? '',
      trackStock: product.trackStock !== false,
      isAvailable: product.isAvailable !== false,
      metalType: product.metalType || '',
      purity: product.purity || '',
      grossWeight: product.grossWeight ?? '',
      netWeight: product.netWeight ?? '',
      brand: product.brand || '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditProduct(null);
    setFormError(null);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      if (editProduct) {
        await api.put(
          `/biz/businesses/${bizId}/products/${editProduct._id}`,
          form
        );
      } else {
        await api.post(`/biz/businesses/${bizId}/products`, form);
      }
      closeModal();
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save product.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleArchive = async (product) => {
    if (!window.confirm(`Archive "${product.name}"? It will no longer appear in active listings.`))
      return;
    try {
      await api.put(`/biz/businesses/${bizId}/products/${product._id}`, {
        isActive: false,
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to archive product.');
    }
  };

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
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          Low
        </span>
      );
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        Critical
      </span>
    );
  };

  const isJewellery = business?.type === 'jewellery';
  const isCafeOrRestaurant =
    business?.type === 'cafe' || business?.type === 'restaurant';
  const isClothing = business?.type === 'clothing';

  /* ── page-number list helper (show max 7 numbers with ellipsis) ── */
  const pageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const left = Math.max(2, page - 1);
    const right = Math.min(totalPages - 1, page + 1);
    const pages = [1];
    if (left > 2) pages.push('...');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="p-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaBox className="text-indigo-600 text-xl" />
          <h1 className="text-2xl font-bold text-gray-800">Products</h1>
          <span className="text-sm text-gray-400 font-normal ml-1">
            ({filtered.length})
          </span>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
          >
            <FaPlus className="text-xs" />
            Add Product
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or SKU…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setPage(1);
          }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => {
              setShowInactive(e.target.checked);
              setPage(1);
            }}
            className="accent-indigo-600 w-4 h-4"
          />
          Show Inactive
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
          Loading products…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  'Name',
                  'SKU',
                  'Category',
                  'Cost (₹)',
                  'Price (₹)',
                  'Stock',
                  'Reorder',
                  'Status',
                  'Actions',
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
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-14 text-gray-400 text-sm"
                  >
                    No products found.
                  </td>
                </tr>
              ) : (
                paginated.map((p) => {
                  const catName =
                    p.category?.name ||
                    categories.find((c) => c._id === p.category)?.name ||
                    '-';
                  const stock = p.currentStock ?? 0;
                  const reorder = p.reorderLevel ?? 0;
                  return (
                    <tr
                      key={p._id}
                      className="hover:bg-indigo-50/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                        {p.sku || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {catName}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {Number(p.costPrice || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                        {Number(p.sellingPrice || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {stock} {p.unit || ''}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {reorder}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {stockBadge(stock, reorder)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {canManage && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEdit(p)}
                              title="Edit"
                              className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-100 transition-colors"
                            >
                              <FaEdit className="text-sm" />
                            </button>
                            <button
                              onClick={() => handleArchive(p)}
                              title="Archive"
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                              <FaArchive className="text-sm" />
                            </button>
                          </div>
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

      {/* ── Pagination ── */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Prev
          </button>
          {pageNumbers().map((n, idx) =>
            n === '...' ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 py-1.5 text-sm text-gray-400"
              >
                …
              </span>
            ) : (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                  n === page
                    ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {n}
              </button>
            )
          )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* ── Modal Side Panel ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />
          {/* Panel */}
          <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col h-full animate-slide-in-right">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <h2 className="text-lg font-semibold text-gray-800">
                {editProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {/* Panel body */}
            <form
              id="product-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
            >
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
                  {formError}
                </div>
              )}

              {/* Basic info */}
              <fieldset className="space-y-4">
                <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Basic Information
                </legend>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleFormChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      SKU
                    </label>
                    <input
                      name="sku"
                      value={form.sku}
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Unit
                    </label>
                    <input
                      name="unit"
                      value={form.unit}
                      onChange={handleFormChange}
                      placeholder="pcs, kg, L…"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Category
                  </label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleFormChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleFormChange}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  />
                </div>
              </fieldset>

              {/* Pricing */}
              <fieldset className="space-y-4">
                <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Pricing
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Cost Price (₹)
                    </label>
                    <input
                      name="costPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.costPrice}
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Selling Price (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="sellingPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.sellingPrice}
                      onChange={handleFormChange}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Stock */}
              <fieldset className="space-y-4">
                <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Stock
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Reorder Level
                    </label>
                    <input
                      name="reorderLevel"
                      type="number"
                      min="0"
                      value={form.reorderLevel}
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  {!editProduct && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Opening Stock
                      </label>
                      <input
                        name="openingStock"
                        type="number"
                        min="0"
                        value={form.openingStock}
                        onChange={handleFormChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-5">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="trackStock"
                      checked={form.trackStock}
                      onChange={handleFormChange}
                      className="accent-indigo-600 w-4 h-4"
                    />
                    Track Stock
                  </label>

                  {isCafeOrRestaurant && (
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        name="isAvailable"
                        checked={form.isAvailable}
                        onChange={handleFormChange}
                        className="accent-indigo-600 w-4 h-4"
                      />
                      Available on Menu
                    </label>
                  )}
                </div>
              </fieldset>

              {/* Jewellery-specific */}
              {isJewellery && (
                <fieldset className="space-y-4">
                  <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Jewellery Details
                  </legend>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Metal Type
                      </label>
                      <input
                        name="metalType"
                        value={form.metalType}
                        onChange={handleFormChange}
                        placeholder="Gold, Silver…"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Purity
                      </label>
                      <input
                        name="purity"
                        value={form.purity}
                        onChange={handleFormChange}
                        placeholder="22K, 925…"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Gross Weight (g)
                      </label>
                      <input
                        name="grossWeight"
                        type="number"
                        min="0"
                        step="0.001"
                        value={form.grossWeight}
                        onChange={handleFormChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Net Weight (g)
                      </label>
                      <input
                        name="netWeight"
                        type="number"
                        min="0"
                        step="0.001"
                        value={form.netWeight}
                        onChange={handleFormChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                  </div>
                </fieldset>
              )}

              {/* Clothing-specific */}
              {isClothing && (
                <fieldset className="space-y-4">
                  <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Clothing Details
                  </legend>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Brand
                    </label>
                    <input
                      name="brand"
                      value={form.brand}
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                </fieldset>
              )}
            </form>

            {/* Panel footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="product-form"
                disabled={formLoading}
                className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg font-medium disabled:opacity-50 transition-all"
              >
                {formLoading
                  ? 'Saving…'
                  : editProduct
                  ? 'Update Product'
                  : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
