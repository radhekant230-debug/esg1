import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../utils/axios";
import { useBiz } from "../../context/BizContext";
import { FaCog, FaSave, FaSpinner, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";

// ─── Constants ───────────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: "INR", label: "Indian Rupee (₹)" },
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "AED", label: "UAE Dirham (AED)" },
];

const TYPE_LABELS = {
  cafe: "Cafe",
  restaurant: "Restaurant",
  clothing: "Clothing Store",
  jewellery: "Jewellery Shop",
};

const INITIAL_FORM = {
  name: "",
  address: "",
  phone: "",
  email: "",
  currency: "INR",
  taxLabel: "GST",
  defaultTaxRate: 0,
  allowNegativeStock: false,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formFromBusiness(biz) {
  if (!biz) return INITIAL_FORM;
  return {
    name: biz.name ?? "",
    address: biz.address ?? "",
    phone: biz.phone ?? "",
    email: biz.email ?? "",
    currency: biz.currency ?? "INR",
    taxLabel: biz.taxLabel ?? "GST",
    defaultTaxRate: biz.defaultTaxRate ?? 0,
    allowNegativeStock: biz.allowNegativeStock ?? false,
  };
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

// ─── Form field ───────────────────────────────────────────────────────────────

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a] focus:border-transparent transition";

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Settings() {
  const { bizId } = useParams();
  const { business, loadBusiness, isOwnerOrAdmin } = useBiz();

  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [dirty, setDirty] = useState(false);

  // Seed form from context on mount / when business changes
  useEffect(() => {
    if (business) {
      setForm(formFromBusiness(business));
      setDirty(false);
    }
  }, [business]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "number" ? Number(value) : value,
    }));
    setDirty(true);
    setSuccessMsg("");
    setErrorMsg("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrorMsg("Business name is required.");
      return;
    }
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");
    try {
      await api.put(`/biz/businesses/${bizId}`, form);
      await loadBusiness(bizId);
      setSuccessMsg("Settings saved successfully.");
      setDirty(false);
    } catch (err) {
      setErrorMsg(err?.response?.data?.message ?? "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (business) {
      setForm(formFromBusiness(business));
      setDirty(false);
      setSuccessMsg("");
      setErrorMsg("");
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
          <FaCog className="text-slate-600 text-lg" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Business Settings</h1>
          <p className="text-sm text-gray-500">{business?.name}</p>
        </div>
      </div>

      {/* Success / Error banners */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm mb-5">
          <FaCheckCircle className="shrink-0 text-green-500" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-5">
          <FaExclamationCircle className="shrink-0 text-red-400" />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Business Type (readonly) ───────────────────────────── */}
        <Section title="Business Type">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-1">
                The business type cannot be changed after creation. If you need a different type, please create a new business.
              </p>
              <span className="inline-block mt-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-sm font-semibold px-3 py-1.5 rounded-lg capitalize">
                {TYPE_LABELS[business?.type] ?? business?.type ?? "—"}
              </span>
            </div>
          </div>
        </Section>

        {/* ── General Info ───────────────────────────────────────── */}
        <Section title="General Information">
          <Field label="Business Name" required>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Sunrise Jewellers"
              required
              disabled={!isOwnerOrAdmin}
              className={inputCls}
            />
          </Field>

          <Field label="Address">
            <textarea
              name="address"
              value={form.address}
              onChange={handleChange}
              rows={2}
              placeholder="Street, City, State, PIN"
              disabled={!isOwnerOrAdmin}
              className={`${inputCls} resize-none`}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Phone">
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                disabled={!isOwnerOrAdmin}
                className={inputCls}
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="shop@example.com"
                disabled={!isOwnerOrAdmin}
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        {/* ── Billing & Tax ─────────────────────────────────────── */}
        <Section title="Billing & Tax">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Currency">
              <select
                name="currency"
                value={form.currency}
                onChange={handleChange}
                disabled={!isOwnerOrAdmin}
                className={`${inputCls} bg-white`}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tax Label" hint="Shown on receipts, e.g. GST, VAT, Sales Tax">
              <input
                type="text"
                name="taxLabel"
                value={form.taxLabel}
                onChange={handleChange}
                placeholder="GST"
                disabled={!isOwnerOrAdmin}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Default Tax Rate (%)" hint="Applied automatically on new sales. Can be overridden per product.">
            <div className="relative">
              <input
                type="number"
                name="defaultTaxRate"
                value={form.defaultTaxRate}
                onChange={handleChange}
                min={0}
                max={100}
                step={0.01}
                disabled={!isOwnerOrAdmin}
                className={`${inputCls} pr-8`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">%</span>
            </div>
          </Field>
        </Section>

        {/* ── Inventory ─────────────────────────────────────────── */}
        <Section title="Inventory">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="allowNegativeStock"
              name="allowNegativeStock"
              checked={form.allowNegativeStock}
              onChange={handleChange}
              disabled={!isOwnerOrAdmin}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#0f172a] focus:ring-[#0f172a] cursor-pointer"
            />
            <label htmlFor="allowNegativeStock" className="cursor-pointer">
              <p className="text-sm font-semibold text-gray-800">Allow Negative Stock</p>
              <p className="text-xs text-gray-500 mt-0.5">
                When enabled, sales can be recorded even if inventory quantity drops below zero.
                Useful for pre-orders or when stock counts are not tracked in real-time.
              </p>
            </label>
          </div>
        </Section>

        {/* ── Actions ───────────────────────────────────────────── */}
        {isOwnerOrAdmin && (
          <div className="flex items-center gap-3 justify-end pt-1">
            {dirty && (
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-40"
              >
                Discard Changes
              </button>
            )}
            <button
              type="submit"
              disabled={saving || !dirty}
              className="flex items-center gap-2 bg-[#0f172a] text-white font-semibold px-6 py-2.5 rounded-lg text-sm hover:bg-[#1e293b] transition shadow disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <FaSpinner className="animate-spin text-xs" />
                  Saving…
                </>
              ) : (
                <>
                  <FaSave className="text-xs" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        )}

        {!isOwnerOrAdmin && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
            Only owners and admins can modify business settings.
          </div>
        )}
      </form>
    </div>
  );
}
