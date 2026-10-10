import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBiz } from '../../context/BizContext';
import {
  FaSearch,
  FaPlus,
  FaMinus,
  FaTrash,
  FaShoppingCart,
  FaCheck,
  FaTimes,
} from 'react-icons/fa';
import api from '../../utils/axios';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online' },
];

export default function NewSale() {
  const { bizId } = useParams();
  const navigate = useNavigate();
  const { business } = useBiz();

  const defaultTaxRate = Number(business?.defaultTaxRate ?? 0);

  /* ── State ── */
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const [cart, setCart] = useState([]);
  const [productSearch, setProductSearch] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successSale, setSuccessSale] = useState(null);
  const [error, setError] = useState(null);

  /* ── Fetch products ── */
  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const res = await api.get(
        `/biz/businesses/${bizId}/products?active=true&limit=200`
      );
      setProducts(res.data?.data || res.data || []);
    } catch {
      /* non-fatal; show empty grid */
    } finally {
      setProductsLoading(false);
    }
  }, [bizId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  /* ── Filtered products ── */
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.category?.name?.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  /* ── Cart helpers ── */
  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product === product._id);
      if (existing) {
        return prev.map((item) =>
          item.product === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product: product._id,
          productName: product.name,
          quantity: 1,
          unitPrice: Number(product.sellingPrice) || 0,
          costPrice: Number(product.costPrice) || 0,
          discount: 0,
          taxRate: defaultTaxRate,
          variant: '',
          variantLabel: '',
        },
      ];
    });
  };

  const updateCartItem = (productId, field, value) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product === productId ? { ...item, [field]: value } : item
      )
    );
  };

  const incrementQty = (productId) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const decrementQty = (productId) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product === productId
          ? { ...item, quantity: Math.max(1, item.quantity - 1) }
          : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product !== productId));
  };

  /* ── Order totals ── */
  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0
  );
  const totalDiscount = cart.reduce(
    (sum, item) => sum + (Number(item.discount) || 0) * item.quantity,
    0
  );
  const taxableAmount = subtotal - totalDiscount;
  const taxAmount = (taxableAmount * defaultTaxRate) / 100;
  const total = taxableAmount + taxAmount;
  const paid = Number(amountPaid) || 0;
  const balanceDue = total - paid;

  /* ── Item line total ── */
  const lineTotal = (item) =>
    Number(item.unitPrice) * item.quantity -
    (Number(item.discount) || 0) * item.quantity;

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (cart.length === 0) {
      setError('Cart is empty. Add at least one product.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        items: cart.map((item) => ({
          product: item.product,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          costPrice: Number(item.costPrice),
          discount: Number(item.discount) || 0,
          taxRate: Number(item.taxRate),
          variant: item.variant,
          variantLabel: item.variantLabel,
        })),
        customerName,
        customerPhone,
        paymentMethod,
        amountPaid: paid,
        notes,
        subtotal,
        totalDiscount,
        taxAmount,
        total,
      };
      const res = await api.post(
        `/biz/businesses/${bizId}/sales`,
        payload
      );
      setSuccessSale(res.data?.data || res.data || {});
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to create sale. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Reset for new sale ── */
  const handleNewSale = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setPaymentMethod('cash');
    setAmountPaid('');
    setNotes('');
    setSuccessSale(null);
    setError(null);
  };

  /* ══════════════════════════════════════════════
     SUCCESS RECEIPT SCREEN
  ══════════════════════════════════════════════ */
  if (successSale) {
    const receiptSubtotal = Number(successSale.subtotal ?? subtotal);
    const receiptDiscount = Number(successSale.totalDiscount ?? totalDiscount);
    const receiptTax = Number(successSale.taxAmount ?? taxAmount);
    const receiptTotal = Number(successSale.total ?? total);
    const receiptPaid = Number(successSale.amountPaid ?? paid);

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-gray-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          {/* Green header */}
          <div className="bg-green-500 px-6 py-8 flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md">
              <FaCheck className="text-green-500 text-3xl" />
            </div>
            <h2 className="text-2xl font-bold text-white">Sale Completed!</h2>
            {successSale.invoiceNumber && (
              <span className="text-green-100 text-sm font-mono">
                #{successSale.invoiceNumber}
              </span>
            )}
          </div>

          {/* Receipt body */}
          <div className="px-6 py-5 space-y-4">
            {(successSale.customerName || customerName) && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Customer</span>
                <span className="font-medium text-gray-800">
                  {successSale.customerName || customerName}
                </span>
              </div>
            )}

            <div className="border-t border-dashed border-gray-200 pt-3 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>₹{receiptSubtotal.toFixed(2)}</span>
              </div>
              {receiptDiscount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Discount</span>
                  <span>-₹{receiptDiscount.toFixed(2)}</span>
                </div>
              )}
              {receiptTax > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Tax ({defaultTaxRate}%)</span>
                  <span>₹{receiptTax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2">
                <span>Total</span>
                <span>₹{receiptTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Payment</span>
                <span className="capitalize">
                  {successSale.paymentMethod || paymentMethod}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Amount Paid</span>
                <span>₹{receiptPaid.toFixed(2)}</span>
              </div>
              {receiptPaid - receiptTotal > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Change</span>
                  <span>₹{(receiptPaid - receiptTotal).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Items summary */}
            {(successSale.items || cart).length > 0 && (
              <div className="border-t border-dashed border-gray-200 pt-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Items
                </p>
                <ul className="space-y-1 text-xs text-gray-600">
                  {(successSale.items || cart).map((item, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span>
                        {item.productName} × {item.quantity}
                      </span>
                      <span>
                        ₹
                        {(
                          Number(item.unitPrice) * item.quantity -
                          (Number(item.discount) || 0) * item.quantity
                        ).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleNewSale}
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all mt-2"
            >
              <FaShoppingCart />
              New Sale
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════
     POS MAIN LAYOUT
  ══════════════════════════════════════════════ */
  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center gap-3 shrink-0 shadow-sm">
        <FaShoppingCart className="text-indigo-600 text-xl" />
        <h1 className="text-xl font-bold text-gray-800">Point of Sale</h1>
        {business?.name && (
          <span className="text-sm text-gray-400 font-normal">
            — {business.name}
          </span>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ══ LEFT: Product browser ══ */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-200 bg-gray-50">
          {/* Search bar */}
          <div className="px-4 py-3 bg-white border-b border-gray-200 shrink-0">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
              <input
                type="text"
                placeholder="Search products by name, SKU or category…"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {productSearch && (
                <button
                  onClick={() => setProductSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <FaTimes className="text-xs" />
                </button>
              )}
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {productsLoading ? (
              <div className="flex justify-center items-center h-48 text-gray-400 text-sm">
                Loading products…
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm gap-2">
                <FaSearch className="text-3xl text-gray-300" />
                <span>No products found.</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                {filteredProducts.map((product) => {
                  const inCart = cart.find(
                    (c) => c.product === product._id
                  );
                  const isOutOfStock =
                    product.trackStock && (product.currentStock ?? 0) <= 0;

                  return (
                    <button
                      key={product._id}
                      onClick={() => !isOutOfStock && addToCart(product)}
                      disabled={isOutOfStock}
                      className={`relative text-left rounded-xl p-3 shadow-sm transition-all group border ${
                        isOutOfStock
                          ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                          : inCart
                          ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-100 hover:shadow-md'
                          : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md'
                      }`}
                    >
                      {inCart && (
                        <span className="absolute top-2 right-2 bg-indigo-600 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold shadow">
                          {inCart.quantity}
                        </span>
                      )}
                      {isOutOfStock && (
                        <span className="absolute top-2 left-2 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded font-medium">
                          Out
                        </span>
                      )}

                      {/* Product icon placeholder */}
                      <div className="w-full h-10 bg-indigo-50 rounded-lg flex items-center justify-center mb-2 group-hover:bg-indigo-100 transition-colors">
                        <FaShoppingCart className="text-indigo-300 text-lg" />
                      </div>

                      <p className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2 min-h-[2.5rem]">
                        {product.name}
                      </p>
                      {product.category?.name && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {product.category.name}
                        </p>
                      )}
                      <p className="text-sm font-bold text-indigo-700 mt-1.5">
                        ₹{Number(product.sellingPrice || 0).toFixed(2)}
                      </p>
                      {product.trackStock && (
                        <p className="text-xs text-gray-400">
                          Stock: {product.currentStock ?? 0}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT: Cart + checkout ══ */}
        <div className="w-80 xl:w-96 flex flex-col bg-white overflow-hidden shrink-0">
          {/* Cart header */}
          <div className="px-4 py-3 border-b border-gray-200 shrink-0 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
              <FaShoppingCart className="text-indigo-500" />
              Cart
              {cart.length > 0 && (
                <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </h2>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 transition-colors"
              >
                <FaTimes className="text-xs" />
                Clear all
              </button>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs flex items-start justify-between gap-2">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="shrink-0 text-red-400 hover:text-red-600 mt-0.5"
              >
                <FaTimes />
              </button>
            </div>
          )}

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm gap-2">
                <FaShoppingCart className="text-4xl text-gray-200" />
                <span>No items in cart</span>
                <span className="text-xs text-gray-300">
                  Click a product to add
                </span>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product}
                  className="bg-gray-50 rounded-xl p-3 space-y-2.5 border border-gray-100"
                >
                  {/* Name + remove */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-gray-800 leading-tight flex-1 line-clamp-2">
                      {item.productName}
                    </p>
                    <button
                      onClick={() => removeFromCart(item.product)}
                      className="text-red-300 hover:text-red-600 p-0.5 shrink-0 transition-colors"
                      title="Remove"
                    >
                      <FaTrash className="text-xs" />
                    </button>
                  </div>

                  {/* Qty controls + line total */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => decrementQty(item.product)}
                        className="w-6 h-6 flex items-center justify-center bg-white border border-gray-300 rounded-md hover:bg-red-50 hover:border-red-300 text-gray-600 transition-colors"
                      >
                        <FaMinus className="text-xs" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-gray-800">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => incrementQty(item.product)}
                        className="w-6 h-6 flex items-center justify-center bg-white border border-gray-300 rounded-md hover:bg-green-50 hover:border-green-300 text-gray-600 transition-colors"
                      >
                        <FaPlus className="text-xs" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-indigo-700">
                      ₹{lineTotal(item).toFixed(2)}
                    </span>
                  </div>

                  {/* Price + discount overrides */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-400 mb-0.5">
                        Price ₹
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateCartItem(
                            item.product,
                            'unitPrice',
                            Number(e.target.value)
                          )
                        }
                        className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-400 mb-0.5">
                        Disc ₹/item
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.discount}
                        onChange={(e) =>
                          updateCartItem(
                            item.product,
                            'discount',
                            e.target.value
                          )
                        }
                        className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Checkout panel ── */}
          <div className="border-t border-gray-200 px-4 py-4 space-y-3 shrink-0 bg-white">
            {/* Customer info */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Customer Name
                </label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in"
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Phone
                </label>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+91…"
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>

            {/* Payment method tabs */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                Payment Method
              </label>
              <div className="grid grid-cols-4 gap-1">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPaymentMethod(m.value)}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                      paymentMethod === m.value
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Order summary */}
            <div className="bg-gray-50 rounded-xl px-3 py-3 space-y-1.5">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-xs text-red-500">
                  <span>Discount</span>
                  <span>-₹{totalDiscount.toFixed(2)}</span>
                </div>
              )}
              {defaultTaxRate > 0 && (
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Tax ({defaultTaxRate}%)</span>
                  <span>₹{taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-sm border-t border-gray-200 pt-1.5">
                <span>Total</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Amount paid + balance */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Amount Paid (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder={total.toFixed(2)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {balanceDue < 0 ? 'Change' : 'Balance Due'}
                </label>
                <div
                  className={`border rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                    amountPaid === ''
                      ? 'border-gray-200 bg-gray-50 text-gray-400'
                      : balanceDue > 0
                      ? 'border-red-300 bg-red-50 text-red-600'
                      : 'border-green-300 bg-green-50 text-green-700'
                  }`}
                >
                  {amountPaid === ''
                    ? '—'
                    : `₹${Math.abs(balanceDue).toFixed(2)}${balanceDue < 0 ? ' change' : ''}`}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={1}
                placeholder="Order notes…"
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={submitting || cart.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm"
            >
              {submitting ? (
                <span>Processing…</span>
              ) : (
                <>
                  <FaCheck className="text-xs" />
                  Complete Sale · ₹{total.toFixed(2)}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
