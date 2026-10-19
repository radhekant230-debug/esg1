import React, { useState } from "react";
import api from "../../utils/axios";
import { FaFileUpload, FaCheckCircle } from "react-icons/fa";

const inr = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const DEFAULT_SOURCES = ["Meta Ads", "Google Ads", "Website Enquiry", "Instagram DM", "Walk-in", "Referral", "Other"];

/**
 * Upload a customer list (e.g. Petpooja "Customer List" CSV) or an enquiry
 * sheet into Leads & Enquiries: choose file → preview what will happen →
 * confirm. Existing customers (same phone/email) are updated, not duplicated.
 */
export default function LeadImportModal({ clientId = "", sources = [], onClose, onImported }) {
  const availableSources = Array.isArray(sources) && sources.length > 0 ? sources : DEFAULT_SOURCES;
  const [file, setFile] = useState(null);
  const [source, setSource] = useState(availableSources.includes("Walk-in") ? "Walk-in" : availableSources[0] || "Walk-in");
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const validateFile = (candidate) => {
    if (!candidate) return "Choose a CSV or Excel file to upload.";
    const name = (candidate.name || "").toLowerCase();
    const isValid = name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls");
    if (!isValid) return "Invalid file format. Please upload a CSV (.csv) or Excel (.xlsx, .xls) file.";
    return null;
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0] || null;
    setPreview(null);
    setResult(null);
    setError("");

    if (!selected) {
      setFile(null);
      return;
    }

    const validationError = validateFile(selected);
    if (validationError) {
      setFile(null);
      setError(validationError);
      e.target.value = "";
      return;
    }

    setFile(selected);
  };

  const handleSourceChange = (e) => {
    setSource(e.target.value);
    setPreview(null);
    setError("");
  };

  const send = async (mode) => {
    const fileError = validateFile(file);
    if (fileError) {
      setError(fileError);
      return;
    }

    const body = new FormData();
    body.append("file", file);
    body.append("source", source);
    const qs = new URLSearchParams({ mode });
    if (clientId) qs.set("clientId", clientId);

    setBusy(true);
    setError("");

    try {
      const { data } = await api.post(`/portal/leads/import?${qs.toString()}`, body, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 180000,
      });

      if (mode === "preview") {
        setPreview(data.summary);
      } else {
        setResult(data.result);
        if (onImported) onImported();
      }
    } catch (err) {
      console.error("Lead import error:", err);
      const serverMsg = err.response?.data?.message;
      if (serverMsg) {
        setError(serverMsg);
      } else if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
        setError("Import timed out. The file might be too large or the server is busy.");
      } else if (err.response?.status === 413) {
        setError("The file exceeds the maximum allowed upload size (15 MB).");
      } else {
        setError(err.message || "Failed to process the file. Please check the format and try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const s = preview;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-[#E7DFD5] space-y-4 text-xs max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-serif text-base font-bold text-stone-900">Import customers / enquiries</h4>
            <p className="text-stone-500 mt-0.5">
              CSV or Excel. Works with POS customer lists (name, phone, email, last visit, total spent, visits, RFM segment…) and simple enquiry sheets.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700 text-lg cursor-pointer font-bold" aria-label="Close">&times;</button>
        </div>

        {error && (
          <div role="alert" className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="font-bold ml-2 text-rose-600 hover:text-rose-900 cursor-pointer">&times;</button>
          </div>
        )}

        {result ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
              <p className="font-bold text-sm">Import complete</p>
              <p className="mt-1">
                {result.created.toLocaleString("en-IN")} added · {result.updated.toLocaleString("en-IN")} updated · {result.unchanged.toLocaleString("en-IN")} already up to date · {result.skipped.toLocaleString("en-IN")} skipped
              </p>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="px-4 py-1.5 font-semibold bg-[#1A1A1A] text-white rounded-lg cursor-pointer">Done</button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block font-semibold text-stone-700 mb-1">File (.csv, .xlsx, .xls)</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileChange}
                  className="w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-stone-100 file:text-stone-800 cursor-pointer"
                />
                {file && (
                  <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1 font-medium">
                    <FaCheckCircle className="w-3 h-3 text-emerald-600 inline shrink-0" />
                    <span className="truncate">{file.name}</span>
                    <span className="text-stone-400 font-mono">({(file.size / 1024).toFixed(1)} KB)</span>
                  </p>
                )}
              </label>
              <label className="block">
                <span className="block font-semibold text-stone-700 mb-1">Source (when the file has none)</span>
                <select value={source} onChange={handleSourceChange} className="w-full p-2 rounded-lg border border-[#E0D8CE] bg-white text-stone-800">
                  {availableSources.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </label>
            </div>

            {s && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    ["Rows in file", s.rows.toLocaleString("en-IN")],
                    ["New customers", s.toCreate.toLocaleString("en-IN")],
                    ["Already in list (update)", s.toUpdate.toLocaleString("en-IN")],
                    ["Skipped", s.skipped.toLocaleString("en-IN")],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-[#E7DFD5] p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">{k}</p>
                      <p className="text-base font-bold font-mono text-stone-900">{v}</p>
                    </div>
                  ))}
                </div>
                <p className="text-stone-600">
                  Source applied: <strong className="text-stone-800">{s.defaultSource}</strong> · Total value (spent / estimated): <strong>{inr(s.totalValue)}</strong> · Stages:{" "}
                  {Object.entries(s.byStatus).map(([k, v]) => `${k} ${v.toLocaleString("en-IN")}`).join(", ")} · Columns used: {s.columns.join(", ")}
                </p>
                <div className="overflow-x-auto border border-[#E7DFD5] rounded-lg">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-[#FAF7F2] text-stone-600">
                      <tr>
                        {["Name", "Phone", "Email", "Source", "Last visit", "Value", "Stage", "Segment"].map((h) => (
                          <th key={h} className="px-2.5 py-1.5 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFE9E0]">
                      {s.sample.map((r, i) => (
                        <tr key={i}>
                          <td className="px-2.5 py-1.5 font-semibold text-stone-900">{r.name}</td>
                          <td className="px-2.5 py-1.5 font-mono">{r.phone || "—"}</td>
                          <td className="px-2.5 py-1.5">{r.email || "—"}</td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap text-stone-700 font-medium">{r.source || "—"}</td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap">{r.enquiryDate ? new Date(r.enquiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                          <td className="px-2.5 py-1.5 font-mono">{inr(r.estimatedValue)}</td>
                          <td className="px-2.5 py-1.5">{r.status}</td>
                          <td className="px-2.5 py-1.5">{r.campaign || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {s.skippedRows && s.skippedRows.length > 0 && (
                  <details className="text-stone-600">
                    <summary className="cursor-pointer font-semibold text-amber-800">Skipped rows ({s.skipped})</summary>
                    <ul className="mt-1 list-disc pl-5">
                      {s.skippedRows.map((r) => (
                        <li key={r.rowNumber}>Row {r.rowNumber}: {r.reason}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <p className="text-stone-500">Customers already in the list keep their stage and name; their value, latest visit and missing contact details are updated. Visit details are saved as a note on new entries.</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer">Cancel</button>
              {!s ? (
                <button
                  type="button"
                  disabled={!file || busy}
                  onClick={() => send("preview")}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 font-semibold bg-[#1A1A1A] hover:bg-stone-800 text-white rounded-lg cursor-pointer disabled:opacity-50"
                >
                  <FaFileUpload className="w-3 h-3 text-[#D4AF37]" />
                  {busy ? "Reading file…" : "Preview"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || s.toCreate + s.toUpdate === 0}
                  onClick={() => send("commit")}
                  className="px-4 py-1.5 font-semibold bg-[#1A1A1A] hover:bg-stone-800 text-white rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {busy ? "Importing…" : `Import ${(s.toCreate + s.toUpdate).toLocaleString("en-IN")} customers`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

