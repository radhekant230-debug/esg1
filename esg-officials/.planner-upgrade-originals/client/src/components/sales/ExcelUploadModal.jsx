import React, { useState, useRef } from "react";
import api from "../../utils/axios";
import {
  FaTimes,
  FaFileExcel,
  FaUpload,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSpinner,
  FaDownload,
  FaArrowRight,
  FaSyncAlt,
  FaShieldAlt,
} from "react-icons/fa";

export default function ExcelUploadModal({ isOpen, onClose, onSuccess, userScope }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [updateExisting, setUpdateExisting] = useState(true);
  const [commitResult, setCommitResult] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const resetState = () => {
    setFile(null);
    setPreviewData(null);
    setErrorMsg("");
    setCommitResult(null);
    setLoadingPreview(false);
    setCommitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
      setErrorMsg("Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.");
      return;
    }
    setFile(selectedFile);
    setErrorMsg("");
    setCommitResult(null);
    setPreviewData(null);
    handlePreviewUpload(selectedFile);
  };

  const handlePreviewUpload = async (fileToUpload) => {
    try {
      setLoadingPreview(true);
      setErrorMsg("");
      const formData = new FormData();
      formData.append("file", fileToUpload);

      const res = await api.post("/sales/upload/preview", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setPreviewData(res.data);
    } catch (err) {
      console.error("Preview upload error:", err);
      setErrorMsg(
        err.response?.data?.message ||
        "Failed to read and validate the Excel file. Please verify file columns and format."
      );
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || !previewData.validRows || previewData.validRows.length === 0) {
      setErrorMsg("No valid rows available to import.");
      return;
    }

    try {
      setCommitting(true);
      setErrorMsg("");

      const payload = {
        filename: previewData.filename || file?.name || "sales_data.xlsx",
        rows: previewData.validRows,
        updateExisting,
      };

      const res = await api.post("/sales/upload/commit", payload);
      setCommitResult(res.data);
      if (onSuccess) {
        onSuccess(res.data);
      }
    } catch (err) {
      console.error("Commit import error:", err);
      setErrorMsg(
        err.response?.data?.message ||
        "An error occurred while saving sales records to the database."
      );
    } finally {
      setCommitting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get("/sales/template", { responseType: "blob" });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Sales_Upload_Template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Template download error:", err);
      alert("Failed to download template. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-100 flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="bg-[#18181B] text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xl shadow-inner">
              <FaFileExcel />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Upload Sales Excel / CSV</h2>
              <p className="text-xs text-gray-400">
                Automatic data ingestion, validation & storage for assigned businesses
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition"
          >
            <FaTimes />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* USER SCOPE REMINDER */}
          {userScope && (
            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-center justify-between text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <FaShieldAlt className="text-amber-600 text-sm flex-shrink-0" />
                <span>
                  <strong>Authorized Scope:</strong>{" "}
                  {userScope.primaryState} ({userScope.assignedCities?.join(", ") || userScope.primaryCity})
                </span>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 text-amber-700 hover:text-amber-900 font-semibold underline ml-2 cursor-pointer"
              >
                <FaDownload className="text-xs" />
                Download Sample Excel Template
              </button>
            </div>
          )}

          {/* ERROR ALERT */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-start gap-3">
              <FaExclamationTriangle className="text-red-500 text-lg flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Import Issue Detected</p>
                <p className="text-xs mt-0.5 text-red-600">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* STEP 1: FILE DROP AREA (WHEN NO PREVIEW OR RESULT YET) */}
          {!previewData && !commitResult && (
            <div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? "border-amber-500 bg-amber-50/50"
                    : "border-gray-300 hover:border-gray-500 bg-gray-50/60 hover:bg-gray-50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-gray-100 flex items-center justify-center text-3xl text-emerald-600">
                  {loadingPreview ? (
                    <FaSpinner className="animate-spin text-amber-600" />
                  ) : (
                    <FaUpload />
                  )}
                </div>

                {loadingPreview ? (
                  <div>
                    <h4 className="text-base font-bold text-gray-800">Reading and Validating File...</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Verifying column headers, numerical values, and manager permissions.
                    </p>
                  </div>
                ) : (
                  <div>
                    <h4 className="text-base font-bold text-gray-800">
                      Drag & Drop your Sales Spreadsheet here
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Supports <span className="font-semibold text-gray-700">.xlsx, .xls</span>, and{" "}
                      <span className="font-semibold text-gray-700">.csv</span> up to 15 MB
                    </p>
                    <button
                      type="button"
                      className="mt-4 px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-black transition shadow-sm"
                    >
                      Browse File From Computer
                    </button>
                  </div>
                )}
              </div>

              {/* COLUMN FORMAT GUIDE */}
              <div className="mt-5 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Expected Excel Columns:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-gray-600">
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-400 block text-[10px]">Column 1</span>
                    <strong>Month</strong>
                    <span className="text-gray-400 block text-[10px]">e.g. October 2026</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-400 block text-[10px]">Column 2</span>
                    <strong>State</strong>
                    <span className="text-gray-400 block text-[10px]">e.g. Jharkhand</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-400 block text-[10px]">Column 3</span>
                    <strong>City</strong>
                    <span className="text-gray-400 block text-[10px]">e.g. Ranchi</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-400 block text-[10px]">Column 4</span>
                    <strong>Business Name</strong>
                    <span className="text-gray-400 block text-[10px]">e.g. Hotel Royal</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-400 block text-[10px]">Column 5</span>
                    <strong>Total Sales</strong>
                    <span className="text-gray-400 block text-[10px]">e.g. 280000</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-400 block text-[10px]">Column 6</span>
                    <strong>Orders</strong>
                    <span className="text-gray-400 block text-[10px]">e.g. 135</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-400 block text-[10px]">Column 7</span>
                    <strong>Target</strong>
                    <span className="text-gray-400 block text-[10px]">e.g. 300000</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <span className="text-gray-400 block text-[10px]">Column 8</span>
                    <strong>Remarks</strong>
                    <span className="text-gray-400 block text-[10px]">e.g. Good</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & VALIDATION SUMMARY TABLE */}
          {previewData && !commitResult && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                    <FaFileExcel className="text-emerald-600 text-base" />
                    {previewData.filename}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Detected {previewData.totalRows} data rows
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1.5">
                    <FaCheckCircle /> {previewData.validCount} Valid
                  </span>
                  {previewData.invalidCount > 0 && (
                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold flex items-center gap-1.5">
                      <FaExclamationTriangle /> {previewData.invalidCount} Invalid
                    </span>
                  )}
                  <button
                    onClick={resetState}
                    className="text-xs text-gray-600 hover:text-gray-900 underline ml-2 cursor-pointer"
                  >
                    Upload Different File
                  </button>
                </div>
              </div>

              {/* INVALID ROWS WARNING */}
              {previewData.invalidCount > 0 && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
                  <h5 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FaExclamationTriangle className="text-amber-600" />
                    Rows Requiring Attention ({previewData.invalidCount})
                  </h5>
                  <div className="max-h-40 overflow-y-auto divide-y divide-amber-200/60 text-xs">
                    {previewData.invalidRows.map((inv, idx) => (
                      <div key={idx} className="py-2 flex items-start justify-between gap-3">
                        <div>
                          <span className="font-bold text-amber-950">
                            Row {inv.rowNumber}: {inv.businessName} ({inv.city}, {inv.state})
                          </span>
                          <span className="text-gray-500 ml-2">Month: {inv.month}</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {inv.errors?.map((err, eIdx) => (
                              <span
                                key={eIdx}
                                className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[11px] font-medium"
                              >
                                {err}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-amber-800 mt-2">
                    * Invalid rows will be skipped during import. Only the {previewData.validCount} valid rows will be saved to the database.
                  </p>
                </div>
              )}

              {/* VALID ROWS PREVIEW TABLE */}
              <div>
                <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Preview of Valid Rows ({previewData.validCount})
                </h5>
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 text-gray-700 uppercase font-bold sticky top-0 border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Month</th>
                        <th className="py-2.5 px-3">Business</th>
                        <th className="py-2.5 px-3">Location</th>
                        <th className="py-2.5 px-3 text-right">Total Sales</th>
                        <th className="py-2.5 px-3 text-right">Orders</th>
                        <th className="py-2.5 px-3 text-right">Target</th>
                        <th className="py-2.5 px-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewData.validRows.slice(0, 15).map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/80">
                          <td className="py-2 px-3 font-mono text-gray-400">{row.rowNumber}</td>
                          <td className="py-2 px-3 font-medium text-gray-800">{row.monthName}</td>
                          <td className="py-2 px-3 font-bold text-gray-900">{row.businessName}</td>
                          <td className="py-2 px-3 text-gray-600">{row.city}, {row.state}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700">
                            ₹{Number(row.totalSales).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-gray-700">{row.orders}</td>
                          <td className="py-2 px-3 text-right font-mono text-gray-600">
                            ₹{Number(row.target).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-gray-500 truncate max-w-[120px]">
                            {row.remarks || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewData.validRows.length > 15 && (
                  <p className="text-[11px] text-gray-500 mt-1.5 text-right">
                    Showing first 15 of {previewData.validRows.length} valid rows
                  </p>
                )}
              </div>

              {/* DUPLICATE STRATEGY CHECKBOX */}
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 flex items-center gap-3">
                <input
                  id="update-existing-checkbox"
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500 cursor-pointer"
                />
                <label
                  htmlFor="update-existing-checkbox"
                  className="text-xs text-gray-700 cursor-pointer select-none"
                >
                  <strong className="text-gray-900">Update existing records:</strong> If a sales record for the same Business and Month already exists, update its sales, orders, and target values instead of skipping.
                </label>
              </div>
            </div>
          )}

          {/* STEP 3: COMMIT RESULT SUMMARY */}
          {commitResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto">
                <FaCheckCircle />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-emerald-900">
                  Data Successfully Imported & Saved!
                </h3>
                <p className="text-xs text-emerald-700 mt-1">
                  Database updated. All dashboard totals, KPI cards, and charts have been refreshed.
                </p>
              </div>

              {/* SUMMARY STATS GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left pt-2">
                <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">New Records</p>
                  <p className="text-xl font-black text-emerald-600">
                    {commitResult.summary?.successCount || 0}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Updated Records</p>
                  <p className="text-xl font-black text-blue-600">
                    {commitResult.summary?.updatedCount || 0}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Skipped</p>
                  <p className="text-xl font-black text-gray-600">
                    {commitResult.summary?.skippedCount || 0}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Total Sales Volume</p>
                  <p className="text-xl font-black text-gray-900">
                    ₹{Number(commitResult.summary?.totalRevenue || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            {commitResult ? "Close" : "Cancel"}
          </button>

          <div className="flex items-center gap-3">
            {previewData && !commitResult && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={committing || previewData.validCount === 0}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer"
              >
                {committing ? (
                  <>
                    <FaSpinner className="animate-spin text-sm" /> Saving to Database...
                  </>
                ) : (
                  <>
                    <FaCheckCircle /> Confirm & Import {previewData.validCount} Rows
                  </>
                )}
              </button>
            )}

            {commitResult && (
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition shadow-md cursor-pointer"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
