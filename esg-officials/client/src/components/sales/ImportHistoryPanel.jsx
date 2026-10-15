import React, { useCallback, useEffect, useState } from "react";
import { FaUpload, FaDownload, FaFileDownload } from "react-icons/fa";
import api from "../../utils/axios";
import ExcelUploadModal from "./ExcelUploadModal";
import { Card, Spinner, EmptyState, Alert, btn, errorMessage, downloadBlob, formatINR } from "../planner/plannerUi";

const STATUS = {
  completed: ["Completed", "bg-emerald-100 text-emerald-800"],
  partial: ["Partial (rows rejected)", "bg-amber-100 text-amber-800"],
  rejected: ["All rows rejected", "bg-red-100 text-red-700"],
  failed: ["Failed — rolled back", "bg-red-100 text-red-700"],
  pending: ["Previewed, not confirmed", "bg-slate-100 text-slate-700"],
  processing: ["Processing", "bg-blue-100 text-blue-700"],
  cancelled: ["Cancelled", "bg-gray-100 text-gray-500"],
  expired: ["Expired", "bg-gray-100 text-gray-500"],
};

export default function ImportHistoryPanel({ refreshKey = 0, onImported }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/sales/import-history", { params: { limit: 100 } });
      setJobs(Array.isArray(res.data) ? res.data : []);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Failed to load import history."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const downloadOriginal = async (job) => {
    try {
      const res = await api.get(`/sales/upload/${job._id}/file`, { responseType: "blob" });
      downloadBlob(res, job.filename);
    } catch (err) {
      setError(errorMessage(err, "The original file is not available."));
    }
  };

  const downloadInvalid = async (job) => {
    try {
      const res = await api.get(`/sales/upload/${job._id}/invalid-rows`, { responseType: "blob" });
      downloadBlob(res, `${job.filename}_invalid_rows.csv`);
    } catch (err) {
      setError(errorMessage(err, "Download failed."));
    }
  };

  return (
    <Card
      title="Sales import history"
      subtitle="Every upload with its reporting month, upload time (IST), uploader, status and counts. The original file and an error report are kept for each import."
      actions={
        <button type="button" className={btn.primary} onClick={() => setUploadOpen(true)}>
          <FaUpload /> Import Excel / CSV
        </button>
      }
    >
      {error && <Alert tone="error" className="mb-3">{error}</Alert>}
      {loading && !jobs.length ? (
        <Spinner />
      ) : jobs.length === 0 ? (
        <EmptyState title="No imports yet." />
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wider text-gray-600">
              <tr>
                <th className="px-3 py-2">Uploaded (IST)</th>
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Reporting month</th>
                <th className="px-3 py-2">Business → client portal</th>
                <th className="px-3 py-2">By</th>
                <th className="px-3 py-2 text-right">Rows</th>
                <th className="px-3 py-2 text-right">Imported</th>
                <th className="px-3 py-2 text-right">Replaced</th>
                <th className="px-3 py-2 text-right">Kept</th>
                <th className="px-3 py-2 text-right">Rejected</th>
                <th className="px-3 py-2 text-right">Sales saved</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((j) => {
                const [label, cls] = STATUS[j.status] || [j.status, "bg-gray-100"];
                const rejected = j.rejectedCount || (j.status === "pending" ? j.invalidCount : j.failedCount) || 0;
                return (
                  <tr key={j._id}>
                    <td className="px-3 py-2 whitespace-nowrap">{j.createdAtLabel}</td>
                    <td className="px-3 py-2 font-semibold max-w-[220px] truncate" title={j.filename}>{j.filename}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{j.periods?.length ? j.periods.join(", ") : "—"}</td>
                    <td className="px-3 py-2 min-w-[180px]">
                      {(j.businesses || []).map((b) => `${b.name} (${b.city})`).join(", ") || "—"}
                      {j.affectedClients?.length > 0 && (
                        <span className="block text-[11px] text-emerald-700">→ {j.affectedClients.map((c) => c.companyName || c.name).join(", ")}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{j.uploaderName || j.uploadedBy?.name}</td>
                    <td className="px-3 py-2 text-right font-mono">{j.totalRows}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-700 font-bold">{j.successCount || 0}</td>
                    <td className="px-3 py-2 text-right font-mono text-blue-700">{j.updatedCount || 0}</td>
                    <td className="px-3 py-2 text-right font-mono">{j.skippedCount || 0}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-600">{rejected}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatINR(j.totalRevenue || 0)}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap ${cls}`}>{label}</span></td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {j.hasOriginalFile && (
                        <button type="button" className={btn.ghost} onClick={() => downloadOriginal(j)} title="Download the original uploaded file">
                          <FaFileDownload /> Original
                        </button>
                      )}
                      {j.hasInvalidRows && (
                        <button type="button" className={btn.ghost} onClick={() => downloadInvalid(j)} title="Download invalid rows with reasons">
                          <FaDownload /> Invalid rows
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ExcelUploadModal
        isOpen={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          load();
        }}
        onSuccess={() => {
          load();
          onImported && onImported();
        }}
      />
    </Card>
  );
}
