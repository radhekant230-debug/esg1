import React, { useContext, useEffect, useRef, useState } from "react";
import {
    FaDownload,
    FaFileAlt,
    FaFolderOpen,
    FaSearch,
    FaTimes,
    FaTrash,
    FaUpload,
} from "react-icons/fa";
import api from "../utils/axios";
import { AuthContext } from "../context/AuthContext";

const Documents = () => {
    const { user } = useContext(AuthContext);
    const canManage = user?.role === "admin" || user?.role === "manager";

    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

    // Upload modal state
    const [showUpload, setShowUpload] = useState(false);
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [uploadForm, setUploadForm] = useState({
        project: "",
        task: "",
        name: "",
        description: "",
    });
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const fileInputRef = useRef(null);

    // Delete confirmation
    const [deleting, setDeleting] = useState(null);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            setLoading(true);
            setError("");
            const { data } = await api.get("/documents");
            setDocuments(Array.isArray(data) ? data : data?.documents || []);
        } catch (err) {
            setError(err.response?.data?.message || "Unable to load documents.");
        } finally {
            setLoading(false);
        }
    };

    const openUploadModal = async () => {
        setUploadError("");
        setUploadForm({ project: "", task: "", name: "", description: "" });
        setSelectedFile(null);
        setTasks([]);
        try {
            const { data } = await api.get("/projects");
            setProjects(Array.isArray(data) ? data : data?.projects || []);
        } catch {
            setProjects([]);
        }
        setShowUpload(true);
    };

    const handleProjectChange = async (projectId) => {
        setUploadForm((f) => ({ ...f, project: projectId, task: "" }));
        if (!projectId) { setTasks([]); return; }
        try {
            const { data } = await api.get(`/tasks?project=${projectId}`);
            setTasks(Array.isArray(data) ? data : data?.tasks || []);
        } catch {
            setTasks([]);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setSelectedFile(file);
        if (!uploadForm.name) {
            setUploadForm((f) => ({ ...f, name: file.name.replace(/\.[^.]+$/, "") }));
        }
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        setUploadError("");
        if (!uploadForm.project) { setUploadError("Please select a project."); return; }
        if (!uploadForm.name.trim()) { setUploadError("Please enter a document name."); return; }
        if (!selectedFile) { setUploadError("Please select a file to upload."); return; }

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("project", uploadForm.project);
        formData.append("name", uploadForm.name.trim());
        formData.append("description", uploadForm.description.trim());
        if (uploadForm.task) formData.append("task", uploadForm.task);

        try {
            setUploading(true);
            await api.post("/documents", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setShowUpload(false);
            fetchDocuments();
        } catch (err) {
            setUploadError(err.response?.data?.message || "Upload failed. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (docId, docName) => {
        if (!window.confirm(`Delete "${docName}"? This cannot be undone.`)) return;
        setDeleting(docId);
        try {
            await api.delete(`/documents/${docId}`);
            setDocuments((prev) => prev.filter((d) => d._id !== docId));
        } catch (err) {
            alert(err.response?.data?.message || "Failed to delete document.");
        } finally {
            setDeleting(null);
        }
    };

    const formatDate = (date) => {
        if (!date) return "Not available";
        return new Date(date).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const getFileName = (document) =>
        document.name || document.fileName || document.title || "Untitled Document";

    const getFileType = (document) => {
        if (document.fileType) {
            const parts = document.fileType.split("/");
            return parts[parts.length - 1].toUpperCase();
        }
        if (document.mimeType) return document.mimeType.split("/").pop().toUpperCase();
        const name = getFileName(document);
        const ext = name.split(".").pop();
        return ext !== name ? ext.toUpperCase() : "FILE";
    };

    const filteredDocuments = documents.filter((document) => {
        const s = search.toLowerCase();
        return (
            getFileName(document).toLowerCase().includes(s) ||
            String(document.project?.name || "").toLowerCase().includes(s) ||
            String(document.description || "").toLowerCase().includes(s)
        );
    });

    const handleDownload = (document) => {
        const url = document.url || document.fileUrl || document.downloadUrl;
        if (url) window.open(url, "_blank", "noopener,noreferrer");
    };

    return (
        <div className="max-w-7xl mx-auto">

            {/* Header */}
            <div className="bg-gray-900 text-white rounded-2xl p-6 sm:p-8 mb-8 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                    <div>
                        <p className="text-gray-400 text-sm font-semibold mb-2">DOCUMENT CENTER</p>
                        <h1 className="text-2xl sm:text-3xl font-extrabold">Documents</h1>
                        <p className="text-gray-300 mt-2 text-sm sm:text-base">
                            Access and manage your project documents.
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        {canManage && (
                            <button
                                onClick={openUploadModal}
                                className="flex items-center gap-2 bg-white text-gray-900 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-100 transition shrink-0"
                            >
                                <FaUpload />
                                Upload Document
                            </button>
                        )}
                        <div className="w-14 h-14 bg-white text-gray-900 rounded-xl flex items-center justify-center text-xl shrink-0">
                            <FaFolderOpen />
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
                <div className="relative">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search documents..."
                        className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-gray-700 transition"
                    />
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 text-red-600 border border-red-100 rounded-xl p-4 mb-6">
                    {error}
                </div>
            )}

            {/* Documents */}
            {loading ? (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 text-center">
                    <div className="inline-block w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                    <p className="text-gray-600 font-semibold mt-4">Loading documents...</p>
                </div>
            ) : filteredDocuments.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
                    <FaFolderOpen className="mx-auto text-4xl text-gray-300 mb-4" />
                    <h2 className="text-xl font-bold text-gray-900">
                        {search ? "No Documents Found" : "No Documents Available"}
                    </h2>
                    <p className="text-gray-500 text-sm mt-2">
                        {search
                            ? "Try a different search term."
                            : canManage
                            ? "Upload the first document using the button above."
                            : "There are currently no documents available."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredDocuments.map((document) => {
                        const fileName = getFileName(document);
                        const fileType = getFileType(document);
                        const canDownload = document.url || document.fileUrl || document.downloadUrl;

                        return (
                            <div
                                key={document._id}
                                className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-lg transition duration-300 overflow-hidden"
                            >
                                <div className="p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="w-12 h-12 shrink-0 bg-gray-900 text-white rounded-lg flex items-center justify-center">
                                            <FaFileAlt />
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold uppercase">
                                            {fileType}
                                        </span>
                                    </div>

                                    <h3 className="font-bold text-gray-900 mt-5 truncate">{fileName}</h3>
                                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                                        {document.description || "No description available."}
                                    </p>

                                    <div className="mt-4 space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-400">Project</span>
                                            <span className="font-semibold text-gray-700 truncate ml-4">
                                                {document.project?.name || document.projectName || "Not specified"}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-400">Uploaded by</span>
                                            <span className="font-semibold text-gray-700 truncate ml-4">
                                                {document.uploadedBy?.name || document.createdBy?.name || "Unknown"}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-400">Date</span>
                                            <span className="font-semibold text-gray-700">
                                                {formatDate(document.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex gap-2">
                                    {canDownload ? (
                                        <button
                                            type="button"
                                            onClick={() => handleDownload(document)}
                                            className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-black transition"
                                        >
                                            <FaDownload />
                                            Download
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled
                                            className="flex-1 flex items-center justify-center gap-2 bg-gray-200 text-gray-400 py-2.5 rounded-lg text-sm font-semibold cursor-not-allowed"
                                        >
                                            File Unavailable
                                        </button>
                                    )}

                                    {canManage && (
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(document._id, fileName)}
                                            disabled={deleting === document._id}
                                            className="w-10 h-10 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition disabled:opacity-50"
                                            title="Delete document"
                                        >
                                            {deleting === document._id ? (
                                                <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                                            ) : (
                                                <FaTrash className="text-sm" />
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Upload Modal */}
            {showUpload && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

                        {/* Modal header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-900 text-white rounded-lg flex items-center justify-center">
                                    <FaUpload />
                                </div>
                                <h2 className="text-lg font-extrabold text-gray-900">Upload Document</h2>
                            </div>
                            <button
                                onClick={() => setShowUpload(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        {/* Modal body */}
                        <form onSubmit={handleUploadSubmit} className="p-6 space-y-5">

                            {uploadError && (
                                <div className="bg-red-50 text-red-600 border border-red-100 rounded-lg p-3 text-sm">
                                    {uploadError}
                                </div>
                            )}

                            {/* Project select */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Project <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={uploadForm.project}
                                    onChange={(e) => handleProjectChange(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-700 transition"
                                >
                                    <option value="">Select a project...</option>
                                    {projects.map((p) => (
                                        <option key={p._id} value={p._id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Task select (optional) */}
                            {tasks.length > 0 && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Task <span className="text-gray-400 font-normal">(optional)</span>
                                    </label>
                                    <select
                                        value={uploadForm.task}
                                        onChange={(e) => setUploadForm((f) => ({ ...f, task: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-700 transition"
                                    >
                                        <option value="">No specific task</option>
                                        {tasks.map((t) => (
                                            <option key={t._id} value={t._id}>
                                                {t.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* File picker */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    File <span className="text-red-500">*</span>
                                </label>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition"
                                >
                                    {selectedFile ? (
                                        <div>
                                            <p className="font-semibold text-gray-900 text-sm truncate">
                                                {selectedFile.name}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                            </p>
                                        </div>
                                    ) : (
                                        <div>
                                            <FaUpload className="mx-auto text-2xl text-gray-300 mb-2" />
                                            <p className="text-sm text-gray-500">
                                                Click to select a file
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                PDF, Word, Excel, PowerPoint, images, ZIP — max 20 MB
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    onChange={handleFileChange}
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.jpg,.jpeg,.png,.gif,.webp"
                                />
                            </div>

                            {/* Document name */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Document Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={uploadForm.name}
                                    onChange={(e) => setUploadForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Q3 Sustainability Report"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-700 transition"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Description <span className="text-gray-400 font-normal">(optional)</span>
                                </label>
                                <textarea
                                    value={uploadForm.description}
                                    onChange={(e) => setUploadForm((f) => ({ ...f, description: e.target.value }))}
                                    placeholder="Brief description of the document..."
                                    rows={3}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-700 transition resize-none"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowUpload(false)}
                                    className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black transition flex items-center justify-center gap-2 disabled:opacity-60"
                                >
                                    {uploading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <FaUpload />
                                            Upload
                                        </>
                                    )}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Documents;
