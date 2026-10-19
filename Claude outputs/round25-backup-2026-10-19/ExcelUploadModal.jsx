import React, { useEffect, useRef, useState } from "react";
import {
  FaTimes,
  FaFileExcel,
  FaUpload,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSpinner,
  FaDownload,
  FaShieldAlt,
  FaFileCsv,
  FaUserCheck,
  FaUnlink,
} from "react-icons/fa";
import api from "../../utils/axios";
import { downloadBlob, formatINR } from "../planner/plannerUi";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const EXPECTED = [
  ["Month", "Yes*", "October 2026 · Oct-2026 · 2026-10"],
  ["Year", "No", "2026 (if Month has no year)"],
  ["Business Name", "Yes*", "Exactly as registered"],
  ["Location", "If name repeats", "City, e.g. Ranchi"],
  ["State", "No", "Jharkhand"],
  ["Total Sales", "Yes", "280000 or ₹2,80,000"],
  ["Sales Basis", "No", "Gross (default) / Net"],
  ["Orders", "No", "Whole number"],
  ["Target", "No", "Blank = business target"],
  ["Discount", "No", "Blank = not recorded"],
  ["Cost", "No", "Blank = not recorded"],
  ["Expenses", "No", "Blank = not recorded"],
  ["Profit/Loss", "No", "Negative = loss"],
  ["Remarks", "No", "Free text"],
];

const errText = (err, fallback) => err?.response?.data?.message || fallback;

/**
 * Sales Excel/CSV import: upload -> server-side validation preview -> confirm.
 * Nothing is saved until the user confirms, invalid rows are listed with the
 * reason, and the commit is all-or-nothing on the server.
 */
const money = (v) => (v === null || v === undefined ? "—" : formatINR(v));
const REPORT_COLS = [
  ["grossAmount", "My Amount"],
  ["discount", "Total Discount"],
  ["netSales", "Net Sales"],
  ["tax", "Total Tax"],
  ["serviceCharge", "Service Charge"],
  ["deliveryCharge", "Delivery"],
  ["containerCharge", "Container"],
  ["totalSales", "Total Sales"],
];

/** Restaurant day-wise report preview: metadata, per-restaurant summary totals, reconciliation. */
function renderReportSummary(preview) {
  const rep = preview.report;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 text-xs space-y-3">
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <p><span className="text-gray-500">Report:</span> <strong>{rep.reportName || "Day-wise sales report"}</strong></p>
        <p><span className="text-gray-500">Period:</span> <strong>{preview.reportPeriod?.label}</strong>{!rep.periodStart && <span className="text-amber-700"> (from the first/last date — no period line found)</span>}</p>
        <p><span className="text-gray-500">Header row:</span> {rep.headerRow}</p>
        <p><span className="text-gray-500">Daily rows:</span> <strong>{preview.validCount}</strong> valid{preview.invalidCount ? `, ${preview.invalidCount} invalid` : ""}</p>
      </div>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-[11px]">
          <thead className="bg-gray-50 text-left uppercase tracking-wider text-gray-600">
            <tr>
              <th className="px-2 py-1.5">Restaurant → business</th>
              <th className="px-2 py-1.5 text-right">Days</th>
              <th className="px-2 py-1.5 text-right">Bills</th>
              {REPORT_COLS.map(([k, l]) => (
                <th key={k} className="px-2 py-1.5 text-right whitespace-nowrap">{l} (Total row)</th>
              ))}
              <th className="px-2 py-1.5 text-right">Pax</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rep.restaurants.map((r) => (
              <tr key={r.restaurant}>
                <td className="px-2 py-1.5 min-w-[220px]">
                  <strong>{r.restaurant || "(unnamed)"}</strong>
                  <span className="block text-gray-500">
                    {r.businessName ? `→ ${r.businessName} (${r.city})` : <span className="text-red-700">{r.problem}</span>}
                    {r.nameDiffers ? " · name differs from the portal — check the selection" : ""}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right font-mono">{r.dailyRows}</td>
                <td className="px-2 py-1.5 text-right font-mono">{r.totals ? r.totals.bills ?? "—" : "—"}</td>
                {REPORT_COLS.map(([k]) => (
                  <td key={k} className="px-2 py-1.5 text-right font-mono whitespace-nowrap">{r.totals ? money(r.totals[k]) : "—"}</td>
                ))}
                <td className="px-2 py-1.5 text-right font-mono">{r.totals ? r.totals.pax ?? "—" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rep.subTotalRelation && <p className="text-gray-600">{rep.subTotalRelation.note}</p>}
      <details>
        <summary className="cursor-pointer font-semibold text-gray-800">
          Reconciliation checks ({rep.restaurants.reduce((n, r) => n + r.reconciliation.filter((c) => c.ok).length, 0)} passed,{" "}
          <span className={rep.restaurants.some((r) => r.reconciliation.some((c) => !c.ok)) ? "text-red-700" : ""}>
            {rep.restaurants.reduce((n, r) => n + r.reconciliation.filter((c) => !c.ok).length, 0)} need review
          </span>
          )
        </summary>
        <ul className="mt-1 space-y-0.5">
          {rep.restaurants.flatMap((r) =>
            r.reconciliation.map((c, i) => (
              <li key={`${r.restaurant}-${i}`} className={c.ok ? "text-gray-600" : "text-red-700 font-semibold"}>
                {c.ok ? "✓" : "✗"} {r.restaurant}: {c.check} — report {money(c.expected)}, rows {money(c.actual)}
                {c.ok ? "" : ` (difference ${money(c.difference)})`}
              </li>
            ))
          )}
        </ul>
      </details>
      {rep.warnings?.length > 0 && (
        <ul className="bg-amber-50 border border-amber-200 rounded-lg p-2 list-disc pl-5 text-amber-900 space-y-0.5">
          {rep.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-gray-500">
        Total, Min., Max., Avg. and Sub Total rows are used only to check the report; they are never imported as sales. Values are saved exactly as reported — differences are flagged, not corrected.
      </p>
    </div>
  );
}

export default function ExcelUploadModal({ isOpen, onClose, onSuccess, userScope, defaultBusinessId = "" }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [mappingNeeded, setMappingNeeded] = useState(null); // { columnInfo, message }
  const [mapping, setMapping] = useState({});
  const [showMapping, setShowMapping] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [duplicateMode, setDuplicateMode] = useState("add"); // "add" keeps existing months, "replace" overwrites them
  const [acknowledge, setAcknowledge] = useState(false);
  const [result, setResult] = useState(null);
  const [rowTab, setRowTab] = useState("invalid");
  const fileInputRef = useRef(null);

  // Upload target & period controls
  const [businesses, setBusinesses] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [targetBusinessId, setTargetBusinessId] = useState(defaultBusinessId);
  // Client portal chosen as the import target (its User _id); businesses come from /sales/import-targets
  const [targetClientId, setTargetClientId] = useState("");
  const [targets, setTargets] = useState(null);
  const [targetsError, setTargetsError] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkMsg, setLinkMsg] = useState("");
  const [newBiz, setNewBiz] = useState({ city: "", state: "", category: "Restaurant" });
  const [reportingPeriod, setReportingPeriod] = useState("auto");
  const [autoDetectDates, setAutoDetectDates] = useState(true);
  const [manualDateOverride, setManualDateOverride] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportingMonth, setReportingMonth] = useState("");
  const [reportingYear, setReportingYear] = useState("");

  // Re-read clients and businesses from the database every time the modal opens
  // (newly created clients appear without a page reload; no cached list)
  const loadTargets = () =>
    Promise.all([
      api.get("/sales/businesses", { params: { _: Date.now() } }).then((r) => setBusinesses(Array.isArray(r.data) ? r.data : [])).catch(() => setBusinesses([])),
      api
        .get("/sales/import-targets", { params: { _: Date.now() } })
        .then((r) => {
          setTargets(r.data);
          setTargetsError("");
        })
        .catch((err) => {
          setTargets(null);
          setTargetsError(errText(err, "Could not load clients."));
        }),
    ]);
  useEffect(() => {
    if (!isOpen) return;
    setLinkMsg("");
    loadTargets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // A preselected business that belongs to a client portal is shown under that client
  useEffect(() => {
    if (!targets || targetClientId || !targetBusinessId) return;
    const owner = targets.clients.find((c) => c.businesses.some((b) => b._id === targetBusinessId));
    if (owner) setTargetClientId(owner._id);
  }, [targets, targetBusinessId, targetClientId]);

  if (!isOpen) return null;

  // Filter businesses by location if location selected
  const availableLocations = [...new Set(businesses.map((b) => b.city).filter(Boolean))].sort();
  const filteredBusinesses = selectedLocation
    ? businesses.filter((b) => b.city?.toLowerCase() === selectedLocation.toLowerCase())
    : businesses;

  const selectedTarget = businesses.find((b) => b._id === targetBusinessId);
  const thisYear = new Date().getFullYear();
  const yearOptions = [thisYear - 2, thisYear - 1, thisYear, thisYear + 1];

  const resetState = () => {
    if (preview?.importJobId && !result) api.delete(`/sales/upload/${preview.importJobId}`).catch(() => {});
    setFile(null);
    setPreview(null);
    setMappingNeeded(null);
    setMapping({});
    setShowMapping(false);
    setErrorMsg("");
    setResult(null);
    setAcknowledge(false);
    setDuplicateMode("add");
    setLoadingPreview(false);
    setCommitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const runPreview = async (selectedFile, mappingOverride = null, overrides = {}) => {
    try {
      setLoadingPreview(true);
      setErrorMsg("");
      setPreview(null);
      setResult(null);
      setAcknowledge(false);
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (mappingOverride) formData.append("mapping", JSON.stringify(mappingOverride));
      
      const effectiveBizId = overrides.targetBusinessId !== undefined ? overrides.targetBusinessId : targetBusinessId;
      if (effectiveBizId) formData.append("targetBusinessId", effectiveBizId);
      const effectiveClientId = overrides.targetClientId !== undefined ? overrides.targetClientId : targetClientId;
      if (effectiveClientId) formData.append("targetClientId", effectiveClientId);

      const effectivePeriod = overrides.reportingPeriod !== undefined ? overrides.reportingPeriod : reportingPeriod;
      if (effectivePeriod && effectivePeriod !== "auto") formData.append("reportingPeriod", effectivePeriod);

      const effectiveAutoDetect = overrides.autoDetectDates !== undefined ? overrides.autoDetectDates : autoDetectDates;
      formData.append("autoDetect", effectiveAutoDetect ? "true" : "false");

      const effectiveManualOverride = overrides.manualDateOverride !== undefined ? overrides.manualDateOverride : manualDateOverride;
      formData.append("manualDateOverride", effectiveManualOverride ? "true" : "false");

      const effectiveStartDate = overrides.startDate !== undefined ? overrides.startDate : startDate;
      const effectiveEndDate = overrides.endDate !== undefined ? overrides.endDate : endDate;
      if (effectiveManualOverride || effectivePeriod === "custom" || effectivePeriod === "one_day" || effectivePeriod === "one_week" || effectivePeriod === "two_weeks") {
        if (effectiveStartDate) formData.append("startDate", effectiveStartDate);
        if (effectiveEndDate) formData.append("endDate", effectiveEndDate);
      }

      const effectiveMonth = overrides.reportingMonth !== undefined ? overrides.reportingMonth : reportingMonth;
      const effectiveYear = overrides.reportingYear !== undefined ? overrides.reportingYear : reportingYear;
      if (effectiveMonth && effectiveYear) {
        formData.append("reportingMonth", effectiveMonth);
        formData.append("reportingYear", effectiveYear);
      }
      const res = await api.post("/sales/upload/preview", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setPreview(res.data);
      // A corrected restaurant report for days that already exist needs an explicit choice
      setDuplicateMode(res.data.reportFormat && res.data.existingCount > 0 ? "" : "add");
      setMappingNeeded(null);
      setMapping(res.data.columnInfo?.mapping || {});
      setRowTab(res.data.invalidCount > 0 ? "invalid" : "valid");
    } catch (err) {
      if (err.response?.status === 422 && err.response.data?.needsMapping) {
        setMappingNeeded({ columnInfo: err.response.data.columnInfo, message: err.response.data.message });
        setMapping(err.response.data.columnInfo?.mapping || {});
      } else {
        setErrorMsg(errText(err, "Failed to read the file. Check the format and try again."));
      }
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
      setErrorMsg("Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.");
      return;
    }
    if ((reportingMonth && !reportingYear) || (!reportingMonth && reportingYear)) {
      setErrorMsg("Choose both the reporting month and year, or leave both empty.");
      return;
    }
    setFile(selectedFile);
    setMapping({});
    runPreview(selectedFile);
  };

  const selectedClientTarget = targets?.clients?.find((c) => c._id === targetClientId) || null;
  const knownStates = [...new Set(businesses.map((b) => b.state).filter(Boolean))].sort();

  const linkTarget = async (body) => {
    try {
      setLinkBusy(true);
      setLinkMsg("");
      const { data } = await api.post("/sales/import-targets/link", body);
      await loadTargets();
      setTargetBusinessId(data.businessId);
      setLinkMsg(data.message);
      if (file) runPreview(file, Object.keys(mapping).length ? mapping : null, { targetBusinessId: data.businessId, targetClientId: body.clientId });
    } catch (err) {
      setLinkMsg(errText(err, "Could not link the business."));
    } finally {
      setLinkBusy(false);
    }
  };

  // Warnings / setup for the chosen client portal
  const renderClientTargetNotes = () => {
    const c = selectedClientTarget;
    const unlinkedPick = !targetClientId && targetBusinessId && targets?.unlinkedBusinesses?.find((b) => b._id === targetBusinessId);
    return (
      <>
        {unlinkedPick && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {unlinkedPick.name} has no client portal: imported sales are stored for managers only and will not appear in any client dashboard.
          </p>
        )}
        {c && c.warnings.length > 0 && targetBusinessId && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {c.warnings.find((w) => w.includes(c.businesses.find((b) => b._id === targetBusinessId)?.name || "\u0000")) || ""}
          </p>
        )}
        {c && c.needsBusiness && (
          <div className="text-[11px] text-gray-800 bg-white border border-amber-200 rounded-lg px-3 py-2.5 space-y-2">
            <p>
              <strong>{c.name}</strong> exists as a client, but no sales business is linked to its client ID yet, so there is nowhere to store its sales.
            </p>
            {c.suggestedBusiness ? (
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  Found an unlinked business with the same name: <strong>{c.suggestedBusiness.name}</strong> ({c.suggestedBusiness.city}, {c.suggestedBusiness.code}).
                </span>
                <button type="button" disabled={linkBusy} onClick={() => linkTarget({ clientId: c._id, businessId: c.suggestedBusiness._id })} className="px-2.5 py-1 rounded-md bg-gray-900 text-white font-semibold disabled:opacity-50 cursor-pointer">
                  {linkBusy ? "Linking…" : `Link it to ${c.name}`}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <label className="space-y-0.5">
                  <span className="block font-semibold">City</span>
                  <input list="import-city-options" value={newBiz.city} onChange={(e) => setNewBiz({ ...newBiz, city: e.target.value })} className="px-2 py-1 rounded border border-gray-300" placeholder="e.g. Ranchi" />
                  <datalist id="import-city-options">{availableLocations.map((x) => <option key={x} value={x} />)}</datalist>
                </label>
                <label className="space-y-0.5">
                  <span className="block font-semibold">State</span>
                  <input list="import-state-options" value={newBiz.state} onChange={(e) => setNewBiz({ ...newBiz, state: e.target.value })} className="px-2 py-1 rounded border border-gray-300" placeholder="e.g. Jharkhand" />
                  <datalist id="import-state-options">{knownStates.map((x) => <option key={x} value={x} />)}</datalist>
                </label>
                <label className="space-y-0.5">
                  <span className="block font-semibold">Category</span>
                  <select value={newBiz.category} onChange={(e) => setNewBiz({ ...newBiz, category: e.target.value })} className="px-2 py-1 rounded border border-gray-300">
                    <option>Restaurant</option>
                    <option>Hotel</option>
                    <option>Service</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={linkBusy || !newBiz.city.trim() || !newBiz.state.trim()}
                  onClick={() => linkTarget({ clientId: c._id, create: newBiz })}
                  className="px-2.5 py-1.5 rounded-md bg-gray-900 text-white font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {linkBusy ? "Creating…" : `Create ${c.name}'s sales business`}
                </button>
              </div>
            )}
          </div>
        )}
        {linkMsg && <p className="text-[11px] text-gray-700">{linkMsg}</p>}
      </>
    );
  };

  // Target selection shown before upload and while reviewing (re-validates the same file)
  const renderTargetSelector = (compact = false) => (
    <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-xl p-3.5">
      <div className={`grid grid-cols-1 ${compact ? "md:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"} gap-2.5`}>
        {/* Client / Business */}
        <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
          Client / Business
          <select
            className="mt-1 w-full px-2.5 py-2 rounded-lg border border-gray-300 text-xs font-normal normal-case tracking-normal text-gray-900 bg-white"
            value={targetClientId ? `c|${targetClientId}|${targetBusinessId}` : targetBusinessId ? `b||${targetBusinessId}` : ""}
            onChange={(e) => {
              const [, clientId = "", bizId = ""] = e.target.value ? e.target.value.split("|") : [];
              setTargetClientId(clientId);
              setTargetBusinessId(bizId);
              setLinkMsg("");
              const b = businesses.find((x) => x._id === bizId);
              if (b?.city) setSelectedLocation(b.city);
              if (file && (bizId || !clientId)) {
                runPreview(file, Object.keys(mapping).length ? mapping : null, { targetBusinessId: bizId, targetClientId: clientId });
              }
            }}
          >
            <option value="">Detect from file's Business column</option>
            {targets?.clients?.length > 0 && (
              <optgroup label="Client portals">
                {targets.clients.map((c) =>
                  c.businesses.length ? (
                    c.businesses
                      .filter((b) => !selectedLocation || b.city?.toLowerCase() === selectedLocation.toLowerCase() || targetBusinessId === b._id)
                      .map((b) => (
                        <option key={`${c._id}-${b._id}`} value={`c|${c._id}|${b._id}`}>
                          {c.name}
                          {c.clientId ? ` (${c.clientId})` : ""} — {b.name}, {b.city}
                          {b.nameMatchesClient ? "" : " ⚠ check link"}
                        </option>
                      ))
                  ) : (
                    <option key={c._id} value={`c|${c._id}|`}>
                      {c.name}
                      {c.clientId ? ` (${c.clientId})` : ""} — no sales business linked yet
                    </option>
                  )
                )}
              </optgroup>
            )}
            {targets?.unlinkedBusinesses?.length > 0 && (
              <optgroup label="Businesses without a client portal">
                {targets.unlinkedBusinesses
                  .filter((b) => !selectedLocation || b.city?.toLowerCase() === selectedLocation.toLowerCase())
                  .map((b) => (
                    <option key={b._id} value={`b||${b._id}`}>
                      {b.name} ({b.city}) — no client portal
                    </option>
                  ))}
              </optgroup>
            )}
            {!targets &&
              filteredBusinesses.map((b) => (
                <option key={b._id} value={`b||${b._id}`}>
                  {b.name} ({b.city})
                </option>
              ))}
          </select>
        </label>

        {/* Location Filter */}
        <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
          Location (filter)
          <select
            className="mt-1 w-full px-2.5 py-2 rounded-lg border border-gray-300 text-xs font-normal normal-case tracking-normal text-gray-900 bg-white"
            value={selectedLocation}
            onChange={(e) => {
              setSelectedLocation(e.target.value);
              if (targetBusinessId) {
                const cur = businesses.find((b) => b._id === targetBusinessId);
                if (cur && e.target.value && cur.city?.toLowerCase() !== e.target.value.toLowerCase()) {
                  setTargetBusinessId("");
                  setTargetClientId("");
                }
              }
            }}
          >
            <option value="">All locations</option>
            {availableLocations.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </label>

        {/* Reporting Period */}
        <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
          Reporting Period
          <select
            className="mt-1 w-full px-2.5 py-2 rounded-lg border border-gray-300 text-xs font-normal normal-case tracking-normal text-gray-900 bg-white"
            value={reportingPeriod}
            onChange={(e) => setReportingPeriod(e.target.value)}
          >
            <option value="auto">Auto-detect from file (Default)</option>
            <option value="one_day">One day</option>
            <option value="one_week">One week</option>
            <option value="two_weeks">Two weeks</option>
            <option value="one_month">One month</option>
            <option value="one_quarter">A quarter</option>
            <option value="six_months">Six months</option>
            <option value="one_year">One year</option>
            <option value="custom">A custom date range</option>
          </select>
        </label>

        {/* Monthly Selectors (if monthly or auto) */}
        {reportingPeriod === "one_month" || reportingPeriod === "auto" ? (
          <div className="grid grid-cols-2 gap-1.5">
            <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
              Month
              <select
                className="mt-1 w-full px-2 py-2 rounded-lg border border-gray-300 text-xs font-normal normal-case tracking-normal text-gray-900 bg-white"
                value={reportingMonth}
                onChange={(e) => setReportingMonth(e.target.value)}
              >
                <option value="">From file</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m.slice(0, 3)}</option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
              Year
              <select
                className="mt-1 w-full px-2 py-2 rounded-lg border border-gray-300 text-xs font-normal normal-case tracking-normal text-gray-900 bg-white"
                value={reportingYear}
                onChange={(e) => setReportingYear(e.target.value)}
              >
                <option value="">From file</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>

      {/* Date controls: Auto-detect vs Manual Override */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-200/80 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={autoDetectDates}
              onChange={(e) => setAutoDetectDates(e.target.checked)}
              className="rounded text-emerald-600"
            />
            Auto-detect dates from uploaded file
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={manualDateOverride}
              onChange={(e) => setManualDateOverride(e.target.checked)}
              className="rounded text-amber-600"
            />
            Manual date override when necessary
          </label>
        </div>

        {(manualDateOverride || reportingPeriod === "custom" || reportingPeriod === "one_day" || reportingPeriod === "one_week" || reportingPeriod === "two_weeks") && (
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-gray-600">
              Start:
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="ml-1 px-2 py-1 rounded border border-gray-300 text-xs font-normal"
              />
            </label>
            <label className="text-[11px] font-bold text-gray-600">
              End:
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="ml-1 px-2 py-1 rounded border border-gray-300 text-xs font-normal"
              />
            </label>
          </div>
        )}
      </div>

      {targetsError && <p className="text-[11px] text-red-700">{targetsError}</p>}
      {renderClientTargetNotes()}

      <p className="text-[11px] text-gray-500">
        {selectedClientTarget && targetBusinessId
          ? `All rows will be saved for ${selectedTarget?.name || "the selected business"}${selectedTarget?.city ? ` (${selectedTarget.city})` : ""} under ${selectedClientTarget.name}'s client ID${selectedClientTarget.clientId ? ` ${selectedClientTarget.clientId}` : ""} and appear only in that client portal.`
          : selectedTarget
          ? selectedTarget.clientAccount
            ? `All rows will be saved for ${selectedTarget.name} (${selectedTarget.city}) and automatically synchronized with ${selectedTarget.clientAccount.companyName || selectedTarget.clientAccount.name}'s client portal.`
            : `${selectedTarget.name} is not linked to a client portal account yet — saved for managers, but no client will see it until linked.`
          : "Leave fields set to Auto-detect when the file contains Transaction Date / Month and Business Name columns. Do not force uploads into the current month."}
      </p>

      {file && compact && (
        <div className="flex justify-end pt-1">
          <button type="button" onClick={() => runPreview(file, Object.keys(mapping).length ? mapping : null)} className="px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-black">
            Re-validate with these settings
          </button>
        </div>
      )}
    </div>
  );

  const handleConfirmImport = async () => {
    if (!preview) return;
    try {
      setCommitting(true);
      setErrorMsg("");
      const res = await api.post("/sales/upload/commit", {
        importJobId: preview.importJobId,
        ...(duplicateMode ? { duplicateMode } : {}),
        acknowledgeInvalid: acknowledge,
      });
      setResult(res.data);
      onSuccess && onSuccess(res.data);
    } catch (err) {
      setErrorMsg(errText(err, "The import failed. Nothing was saved."));
    } finally {
      setCommitting(false);
    }
  };

  const downloadTemplate = async (format) => {
    try {
      const res = await api.get("/sales/template", { params: { format }, responseType: "blob" });
      downloadBlob(res, `ESG_Sales_Import_Template.${format}`);
    } catch (err) {
      setErrorMsg("Failed to download the template. Please try again.");
    }
  };

  const downloadInvalid = async () => {
    try {
      const res = await api.get(`/sales/upload/${preview.importJobId}/invalid-rows`, { responseType: "blob" });
      downloadBlob(res, "invalid_rows.csv");
    } catch (err) {
      setErrorMsg("Failed to download invalid rows.");
    }
  };

  const columnInfo = preview?.columnInfo || mappingNeeded?.columnInfo;
  const importableCount = preview ? preview.validCount - (duplicateMode === "add" ? preview.existingCount : 0) : 0;
  const canConfirm = preview && preview.validCount > 0 && !preview.identicalFile && Boolean(duplicateMode) && (preview.invalidCount === 0 || acknowledge);

  const renderMappingEditor = () => (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <p className="text-xs text-gray-700">
        Header row detected on <strong>sheet “{columnInfo.sheetName}”, row {columnInfo.headerRow}</strong>. Match your columns to the expected fields:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {columnInfo.expectedColumns.map((c) => (
          <label key={c.key} className="text-[11px] font-bold text-gray-600">
            {c.label} {c.required && <span className="text-red-600">*</span>}
            <select
              className="mt-0.5 w-full px-2 py-1.5 rounded-lg border border-gray-300 text-xs font-normal text-gray-900 bg-white"
              value={mapping[c.key] || ""}
              onChange={(e) => setMapping((m) => ({ ...m, [c.key]: e.target.value }))}
            >
              <option value="">— not in file —</option>
              {columnInfo.headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => runPreview(file, mapping)}
          className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black cursor-pointer"
        >
          Re-validate with this mapping
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border border-gray-100 flex flex-col max-h-[94vh]">
        {/* HEADER */}
        <div className="bg-[#18181B] text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xl">
              <FaFileExcel />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">Import Sales Excel / CSV</h2>
              <p className="text-xs text-gray-400">Validate → review every row → confirm. Nothing is saved before you confirm.</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition cursor-pointer" aria-label="Close">
            <FaTimes />
          </button>
        </div>

        {/* BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <FaShieldAlt className="text-amber-600 text-sm shrink-0" />
              <span>
                <strong>Authorized scope:</strong>{" "}
                {userScope ? `${userScope.primaryState} (${userScope.assignedCities?.join(", ") || userScope.primaryCity})` : "your assigned businesses"}
              </span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => downloadTemplate("xlsx")} className="inline-flex items-center gap-1.5 text-amber-800 hover:text-amber-950 font-semibold underline cursor-pointer">
                <FaDownload className="text-xs" /> Excel template
              </button>
              <button onClick={() => downloadTemplate("csv")} className="inline-flex items-center gap-1.5 text-amber-800 hover:text-amber-950 font-semibold underline cursor-pointer">
                <FaFileCsv className="text-xs" /> CSV template
              </button>
            </div>
          </div>

          {errorMsg && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-start gap-3">
              <FaExclamationTriangle className="text-red-500 text-lg shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Import issue</p>
                <p className="text-xs mt-0.5 text-red-600">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* STEP 1 — FILE */}
          {!preview && !result && !mappingNeeded && (
            <div className="space-y-4">
              {renderTargetSelector()}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                  isDragging ? "border-amber-500 bg-amber-50/50" : "border-gray-300 hover:border-gray-500 bg-gray-50/60 hover:bg-gray-50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) handleFileSelect(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
                <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-gray-100 flex items-center justify-center text-3xl text-emerald-600">
                  {loadingPreview ? <FaSpinner className="animate-spin text-amber-600" /> : <FaUpload />}
                </div>
                {loadingPreview ? (
                  <div>
                    <h4 className="text-base font-bold text-gray-800">Reading and validating {file?.name}...</h4>
                    <p className="text-xs text-gray-500 mt-1">Detecting the header row, mapping columns and checking every row.</p>
                  </div>
                ) : (
                  <div>
                    <h4 className="text-base font-bold text-gray-800">Drag & drop your sales spreadsheet here</h4>
                    <p className="text-xs text-gray-500 mt-1">.xlsx, .xls or .csv up to 15 MB · one row per business per month</p>
                    <span className="inline-block mt-4 px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg">Browse file</span>
                  </div>
                )}
              </div>

              <div className="mt-5 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Template columns (exact names)</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                  {EXPECTED.map(([name, req, eg]) => (
                    <div key={name} className="bg-white p-2 rounded border border-gray-200">
                      <strong className="font-mono">{name}</strong>
                      <span className={`ml-1 text-[10px] ${req === "Yes" ? "text-red-600 font-bold" : "text-gray-400"}`}>{req === "Yes" ? "required" : req === "No" ? "optional" : req.toLowerCase()}</span>
                      <span className="text-gray-400 block text-[10px]">{eg}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  Leave Discount / Cost / Expenses blank when unknown — they are reported as “Data unavailable”, never as zero. Use Sales Basis “Net” when Total Sales is already after discounts.
                </p>
              </div>
            </div>
          )}

          {/* MAPPING REQUIRED */}
          {mappingNeeded && !preview && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
                <p className="font-bold">Some required columns were not recognised</p>
                <p className="text-xs mt-0.5">{mappingNeeded.message}</p>
              </div>
              {renderTargetSelector(true)}
              {renderMappingEditor()}
              <button onClick={resetState} className="text-xs text-gray-600 underline cursor-pointer">Choose a different file</button>
            </div>
          )}

          {/* STEP 2 — PREVIEW */}
          {preview && !result && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                    <FaFileExcel className="text-emerald-600" /> {preview.filename}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {preview.columnInfo.sheets?.length > 1
                      ? `${preview.columnInfo.sheets.length} sheets read (${preview.columnInfo.sheets.map((sh) => `“${sh.sheetName}” header row ${sh.headerRow}`).join(", ")})`
                      : `Sheet “${preview.columnInfo.sheetName}”, header row ${preview.columnInfo.headerRow}`}{" "}
                    · {preview.totalRows} data rows
                    {preview.blankRowsIgnored ? ` · ${preview.blankRowsIgnored} blank rows ignored` : ""}
                  </p>
                  {preview.columnInfo.ignoredSheets?.length > 0 && (
                    <p className="text-[11px] text-gray-500">
                      Not imported: {preview.columnInfo.ignoredSheets.map((sh) => `“${sh.sheetName}” (${sh.reason})`).join("; ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1.5">
                    <FaCheckCircle /> {preview.validCount} valid
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${preview.invalidCount ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-500"}`}>
                    <FaExclamationTriangle /> {preview.invalidCount} invalid
                  </span>
                  {preview.existingCount > 0 && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">{preview.existingCount} already in database</span>
                  )}
                  <button onClick={resetState} className="text-xs text-gray-600 hover:text-gray-900 underline ml-1 cursor-pointer">
                    Upload different file
                  </button>
                </div>
              </div>

              {/* Time Period & Sync Banner */}
              <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-emerald-50/70 border border-blue-200/80 rounded-xl p-4 text-xs text-blue-950 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-200/80 text-blue-900">
                      {preview.recordType === "transaction" ? "Transaction-level records" : "Monthly summary records"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-200/80 text-indigo-900">
                      {preview.reportingPeriodLabel || preview.reportingPeriod || "Custom period"}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm text-gray-900">
                    Coverage: {preview.detectedDateRange ? `${preview.detectedDateRange.startDate} – ${preview.detectedDateRange.endDate} (${preview.detectedDateRange.totalDays} day${preview.detectedDateRange.totalDays === 1 ? "" : "s"})` : preview.periods?.join(", ") || "—"}
                  </h4>
                  <p className="text-gray-600 text-[11px] mt-0.5">
                    Single source of truth: confirming this import recalculates analytics and automatically synchronizes both Manager and Client Portals.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block">Valid Revenue</span>
                  <span className="text-lg font-black text-emerald-600 font-mono">{formatINR(preview.validTotalSales)}</span>
                </div>
              </div>

              {/* Where the data goes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white border border-gray-200 rounded-xl p-3 text-xs">
                  <p className="font-bold text-gray-900 mb-1">Reporting period{preview.periods?.length === 1 ? "" : "s"}</p>
                  <p className="text-gray-700">{preview.periods?.length ? preview.periods.join(", ") : "—"}</p>
                  {preview.target && <p className="text-gray-500 mt-1">Target business: {preview.target.name} ({preview.target.city})</p>}
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-3 text-xs">
                  <p className="font-bold text-gray-900 mb-1">Client portals updated after import</p>
                  {(preview.portalTargets || []).length === 0 ? (
                    <p className="text-gray-500">No valid rows yet.</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {preview.portalTargets.map((t) => (
                        <li key={t.businessId} className="flex items-center gap-1.5">
                          {t.clientName ? <FaUserCheck className="text-emerald-600 shrink-0" /> : <FaUnlink className="text-amber-600 shrink-0" />}
                          <span>
                            {t.businessName} ({t.city}) · {t.rows} row{t.rows === 1 ? "" : "s"} →{" "}
                            {t.clientName ? <strong>{t.clientName}</strong> : <span className="text-amber-700">not linked to a client portal (admin can link it)</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {preview.identicalFile && (
                <div role="alert" className="bg-red-50 border border-red-300 rounded-xl p-3 text-xs text-red-900">
                  <strong>This exact file was already imported</strong> on {preview.identicalFile.atLabel} by {preview.identicalFile.by}. Importing it again is blocked so sales are never counted twice. Upload the corrected report instead if values changed.
                </div>
              )}
              {preview.reportFormat && renderReportSummary(preview)}

              <div className="text-xs">
                <details>
                  <summary className="cursor-pointer text-gray-700 font-semibold">Change target business / reporting period and re-validate</summary>
                  <div className="mt-2">{renderTargetSelector(true)}</div>
                </details>
              </div>

              {preview.previouslyImported && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900">
                  This exact file was already imported on {preview.previouslyImported.atLabel} by {preview.previouslyImported.by}. The same data will not be added twice: existing records are kept unless you choose “Replace”.
                </div>
              )}

              {preview.columnInfo.notices?.length > 0 && (
                <ul className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-[11px] text-gray-700 list-disc pl-6 space-y-0.5">
                  {preview.columnInfo.notices.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}

              {!preview.reportFormat && (
              <div className="text-xs">
                <button onClick={() => setShowMapping((v) => !v)} className="text-gray-700 font-semibold underline cursor-pointer">
                  {showMapping ? "Hide" : "Review / adjust"} column mapping
                </button>
                <span className="text-gray-500 ml-2">
                  {Object.entries(preview.columnInfo.mapping).map(([k, v]) => `${v} → ${(preview.columnInfo.expectedColumns || []).find((c) => c.key === k)?.label || k}`).join(" · ")}
                </span>
                {preview.columnInfo.unmappedColumns?.length > 0 && (
                  <span className="block text-amber-700 mt-1">Ignored columns: {preview.columnInfo.unmappedColumns.join(", ")}</span>
                )}
              </div>
              )}
              {showMapping && !preview.reportFormat && renderMappingEditor()}

              <div className="flex gap-2 border-b border-gray-200">
                {[
                  ["invalid", `Invalid rows (${preview.invalidCount})`],
                  ["valid", `Valid rows (${preview.validCount})`],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setRowTab(k)}
                    className={`px-3 py-2 text-xs font-bold border-b-2 -mb-px cursor-pointer ${rowTab === k ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {rowTab === "invalid" &&
                (preview.invalidCount === 0 ? (
                  <p className="text-xs text-emerald-700 font-semibold">No invalid rows.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-red-700">Fix these rows in your file and upload again, or import only the valid rows (the invalid ones are rejected and listed in the import history).</p>
                      <button onClick={downloadInvalid} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 bg-white text-xs font-bold hover:bg-red-50 cursor-pointer">
                        <FaDownload /> Download invalid rows (CSV with reasons)
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto border border-red-200 rounded-xl divide-y divide-red-100">
                      {preview.invalidRows.map((r) => (
                        <div key={`${r.sheet}-${r.rowNumber}`} className="p-2.5 text-xs">
                          <p className="font-bold text-gray-900">
                            {r.rowLabel || `Row ${r.rowNumber}`}
                            <span className="font-normal text-gray-500 ml-2">
                              {Object.values(r.raw || {}).filter((v) => v !== "").slice(0, 4).join(" · ")}
                            </span>
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {r.errors.map((e) => (
                              <li key={e} className="text-red-700">• {e}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              {rowTab === "valid" && (
                <div className="border border-gray-200 rounded-xl overflow-auto max-h-72">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 text-gray-700 uppercase text-[10px] font-bold sticky top-0">
                      <tr>
                        <th className="py-2 px-2.5">Row</th>
                        <th className="py-2 px-2.5">Date / Period</th>
                        <th className="py-2 px-2.5">Business</th>
                        <th className="py-2 px-2.5 text-right">{preview.reportFormat ? "My Amount" : "Sales"}</th>
                        <th className="py-2 px-2.5">Basis</th>
                        <th className="py-2 px-2.5 text-right">{preview.reportFormat ? "Bills" : "Orders"}</th>
                        <th className="py-2 px-2.5 text-right">{preview.reportFormat ? "Net Sales (report)" : "Target"}</th>
                        <th className="py-2 px-2.5 text-right">Discount</th>
                        <th className="py-2 px-2.5 text-right">{preview.reportFormat ? "Total Tax" : "Cost"}</th>
                        <th className="py-2 px-2.5 text-right">{preview.reportFormat ? "Total Sales (report)" : "Expenses"}</th>
                        <th className="py-2 px-2.5">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.validRows.slice(0, 200).map((r) => {
                        const d = r.data;
                        const opt = (v) => (v === null || v === undefined ? <span className="text-gray-400">—</span> : formatINR(v));
                        return (
                          <tr key={`${r.sheet}-${r.rowNumber}`} className={r.existing ? "bg-blue-50/50" : ""}>
                            <td className="py-1.5 px-2.5 font-mono text-gray-400 whitespace-nowrap">{r.sheet && preview.columnInfo.sheets?.length > 1 ? `${r.sheet}:${r.rowNumber}` : r.rowNumber}</td>
                            <td className="py-1.5 px-2.5 whitespace-nowrap">
                              <span className="font-semibold text-gray-900">{d.dateStr || d.date || d.monthName}</span>
                              {d.invoiceRange ? <span className="block text-[10px] font-mono text-gray-500">Inv. {d.invoiceRange}</span> : null}
                              {d.transactionId && (
                                <span className="block text-[10px] font-mono text-gray-500">Txn: {d.transactionId}</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2.5 font-semibold">{d.businessName}<span className="block font-normal text-gray-500">{d.city}</span></td>
                            <td className="py-1.5 px-2.5 text-right font-mono">{formatINR(d.totalSales)}</td>
                            <td className="py-1.5 px-2.5 capitalize">{d.salesBasis}</td>
                            <td className="py-1.5 px-2.5 text-right">{d.orders}</td>
                            <td className="py-1.5 px-2.5 text-right">{preview.reportFormat ? opt(d.metrics?.netSales) : d.target ? formatINR(d.target) : <span className="text-gray-400">—</span>}</td>
                            <td className="py-1.5 px-2.5 text-right">{opt(d.discount)}</td>
                            <td className="py-1.5 px-2.5 text-right">{preview.reportFormat ? opt(d.metrics?.tax) : opt(d.cost)}</td>
                            <td className="py-1.5 px-2.5 text-right">{preview.reportFormat ? opt(d.metrics?.totalSales) : opt(d.expenses)}</td>
                            <td className="py-1.5 px-2.5 text-[11px] text-gray-600 min-w-[180px]">
                              {r.existing && <span className="block text-blue-700 font-semibold">Exists in database</span>}
                              {r.warnings.filter((w) => !w.includes("already has data")).map((w) => (
                                <span key={w} className="block">{w}</span>
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <fieldset className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-xs text-gray-700 space-y-1.5">
                  <legend className="font-bold text-gray-900 px-1">
                    Duplicate & Overlap Handling ({preview.existingCount} existing)
                    {preview.reportFormat && preview.existingCount > 0 && !duplicateMode && <span className="ml-1 text-red-700">— choose one</span>}
                  </legend>
                  {(preview.existingData || []).length > 0 && (
                    <p className="text-[11px] text-gray-600">
                      Already saved for this report period: {preview.existingData.map((x) => `${x.businessName}: ${x.days} day(s), ${formatINR(x.totalSales)}`).join("; ")}. Choose “Replace” for a corrected report.
                    </p>
                  )}
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="radio" name="dup" className="mt-0.5" checked={duplicateMode === "add"} onChange={() => setDuplicateMode("add")} />
                    <span><strong>Add new records only</strong> — keep the data already saved for those transactions/periods (safest).</span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="radio" name="dup" className="mt-0.5" checked={duplicateMode === "replace"} onChange={() => setDuplicateMode("replace")} />
                    <span>
                      <strong>Replace affected reporting-period data</strong> with this corrected file. Safe updates that never delete unrelated clients' records; previous values stay in audit history.
                    </span>
                  </label>
                  {preview.replacesImports?.length > 0 && (
                    <p className="text-[11px] text-gray-500">
                      Existing data came from: {preview.replacesImports.map((j) => `${j.filename} (${j.atLabel}, ${j.by})`).join("; ")}
                    </p>
                  )}
                </fieldset>
                {preview.invalidCount > 0 && (
                  <label className="bg-red-50 p-3.5 rounded-xl border border-red-200 text-xs text-red-900 flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="mt-0.5" checked={acknowledge} onChange={(e) => setAcknowledge(e.target.checked)} />
                    <span>
                      I understand <strong>{preview.invalidCount} invalid row(s) will NOT be imported</strong>. Import only the {preview.validCount} valid row(s).
                    </span>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* STEP 3 — RESULT */}
          {result && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 space-y-4">
              <div className="text-center">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl mx-auto">
                  <FaCheckCircle />
                </div>
                <h3 className="text-lg font-extrabold text-emerald-900 mt-2">Import complete</h3>
                <p className="text-xs text-emerald-800 mt-1">{result.message}</p>
                {result.summary.periods?.length > 0 && (
                  <p className="text-xs text-emerald-900 mt-1">
                    Reporting period: <strong>{result.summary.periods.join(", ")}</strong> · Client portals refreshed:{" "}
                    <strong>{result.summary.clientPortalsUpdated || 0}</strong> (clients see the data automatically — no re-upload needed)
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-left">
                {[
                  ["Imported (new)", result.summary.successCount, "text-emerald-600"],
                  ["Replaced", result.summary.updatedCount, "text-blue-600"],
                  ["Kept (existed)", result.summary.skippedCount, "text-gray-600"],
                  ["Rejected (invalid)", result.summary.rejectedCount, "text-red-600"],
                  ["Sales value saved", formatINR(result.summary.totalRevenue), "text-gray-900"],
                ].map(([k, v, cls]) => (
                  <div key={k} className="bg-white p-3 rounded-xl border border-emerald-100">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">{k}</p>
                    <p className={`text-xl font-black ${cls}`}>{v}</p>
                  </div>
                ))}
              </div>
              {result.rejectedRows?.length > 0 && (
                <div className="bg-white border border-red-200 rounded-xl p-3 text-xs max-h-40 overflow-y-auto">
                  <p className="font-bold text-red-800 mb-1">Rejected rows</p>
                  {result.rejectedRows.map((r) => (
                    <p key={`${r.sheet}-${r.rowNumber}`} className="text-red-700">{r.sheet ? `${r.sheet} ` : ""}Row {r.rowNumber}: {r.reason}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-4 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2">
          <button type="button" onClick={handleClose} className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition cursor-pointer">
            {result ? "Close" : "Cancel"}
          </button>
          {preview && !result && (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={committing || !canConfirm}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {committing ? (
                <>
                  <FaSpinner className="animate-spin" /> Saving (all-or-nothing)...
                </>
              ) : (
                <>
                  <FaCheckCircle /> Confirm import of {Math.max(0, importableCount)} row(s)
                  {duplicateMode === "replace" && preview.existingCount ? ` incl. ${preview.existingCount} replacement(s)` : ""}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
