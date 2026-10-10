import React, { useContext, useEffect, useState } from "react";
import {
    FaCheck,
    FaClipboardCheck,
    FaClock,
    FaEye,
    FaTimes,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import api from "../utils/axios";
import { AuthContext } from "../context/AuthContext";

const Approvals = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!user) {
            navigate("/login");
            return;
        }

        fetchApprovals();
    }, [user, navigate]);

    const fetchApprovals = async () => {
        try {
            setLoading(true);
            setError("");

            const { data } = await api.get("/approvals");

            if (Array.isArray(data)) {
                setApprovals(data);
            } else {
                setApprovals(data?.approvals || []);
            }
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Unable to load approvals."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleApproval = async (id, status) => {
        try {
            setProcessingId(id);
            setError("");

            const action = status === "Approved" ? "approve" : "reject";
            await api.put(`/approvals/${id}/${action}`);

            setApprovals((previous) =>
                previous.map((approval) =>
                    approval._id === id
                        ? {
                              ...approval,
                              status,
                          }
                        : approval
                )
            );
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Unable to update approval."
            );
        } finally {
            setProcessingId(null);
        }
    };

    const getStatusStyle = (status) => {
        switch (String(status || "").toLowerCase()) {
            case "approved":
                return "bg-green-100 text-green-700";

            case "rejected":
                return "bg-red-100 text-red-700";

            case "pending":
                return "bg-yellow-100 text-yellow-700";

            default:
                return "bg-gray-100 text-gray-600";
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

    const pendingApprovals = approvals.filter(
        (approval) =>
            String(approval.status || "").toLowerCase() ===
            "pending"
    );

    const completedApprovals = approvals.filter(
        (approval) =>
            String(approval.status || "").toLowerCase() !==
            "pending"
    );

    const canRespond =
        user?.role === "client";

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto py-20 text-center">
                <div className="inline-block w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />

                <p className="text-gray-600 font-semibold mt-4">
                    Loading approvals...
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">

            {/* Header */}
            <div className="bg-gray-900 text-white rounded-2xl p-6 sm:p-8 mb-8 shadow-lg">

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">

                    <div>
                        <p className="text-gray-400 text-sm font-semibold mb-2">
                            APPROVAL CENTER
                        </p>

                        <h1 className="text-2xl sm:text-3xl font-extrabold">
                            Approvals
                        </h1>

                        <p className="text-gray-300 mt-2 text-sm sm:text-base">
                            Review and manage project approval requests.
                        </p>
                    </div>

                    <div className="w-14 h-14 bg-white text-gray-900 rounded-xl flex items-center justify-center text-xl">
                        <FaClipboardCheck />
                    </div>

                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 text-red-600 border border-red-100 rounded-xl p-4 mb-6">
                    {error}
                </div>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between">

                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">
                                Total Requests
                            </p>

                            <p className="text-3xl font-black text-gray-900 mt-2">
                                {approvals.length}
                            </p>
                        </div>

                        <div className="w-11 h-11 bg-gray-100 text-gray-700 rounded-lg flex items-center justify-center">
                            <FaClipboardCheck />
                        </div>

                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between">

                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">
                                Pending
                            </p>

                            <p className="text-3xl font-black text-gray-900 mt-2">
                                {pendingApprovals.length}
                            </p>
                        </div>

                        <div className="w-11 h-11 bg-yellow-100 text-yellow-600 rounded-lg flex items-center justify-center">
                            <FaClock />
                        </div>

                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between">

                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">
                                Completed
                            </p>

                            <p className="text-3xl font-black text-gray-900 mt-2">
                                {completedApprovals.length}
                            </p>
                        </div>

                        <div className="w-11 h-11 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                            <FaCheck />
                        </div>

                    </div>
                </div>

            </div>

            {/* Approval List */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

                <div className="px-5 sm:px-6 py-5 border-b border-gray-100">

                    <h2 className="text-xl font-bold text-gray-900">
                        Approval Requests
                    </h2>

                    <p className="text-sm text-gray-500 mt-1">
                        {pendingApprovals.length > 0
                            ? `${pendingApprovals.length} request${
                                  pendingApprovals.length === 1
                                      ? ""
                                      : "s"
                              } waiting for action`
                            : "No pending requests"}
                    </p>

                </div>

                {approvals.length === 0 ? (
                    <div className="p-12 text-center">

                        <FaClipboardCheck className="mx-auto text-4xl text-gray-300 mb-4" />

                        <h3 className="text-lg font-bold text-gray-900">
                            No Approval Requests
                        </h3>

                        <p className="text-sm text-gray-500 mt-2">
                            There are currently no approval requests.
                        </p>

                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">

                        {approvals.map((approval) => {

                            const isPending =
                                String(
                                    approval.status || ""
                                ).toLowerCase() === "pending";

                            const isProcessing =
                                processingId ===
                                approval._id;

                            return (
                                <div
                                    key={approval._id}
                                    className="p-5 sm:p-6 hover:bg-gray-50 transition"
                                >

                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">

                                        {/* Information */}
                                        <div className="min-w-0">

                                            <div className="flex flex-wrap items-center gap-3 mb-2">

                                                <h3 className="text-lg font-bold text-gray-900">
                                                    {approval.title ||
                                                        approval.subject ||
                                                        "Approval Request"}
                                                </h3>

                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(
                                                        approval.status
                                                    )}`}
                                                >
                                                    {approval.status ||
                                                        "Pending"}
                                                </span>

                                            </div>

                                            <p className="text-sm text-gray-600 leading-relaxed">
                                                {approval.description ||
                                                    approval.message ||
                                                    "No description available."}
                                            </p>

                                            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-xs text-gray-500">

                                                <span>
                                                    Project:{" "}
                                                    <strong className="text-gray-700">
                                                        {approval.project
                                                            ?.name ||
                                                            approval.projectName ||
                                                            "Not specified"}
                                                    </strong>
                                                </span>

                                                <span>
                                                    Requested by:{" "}
                                                    <strong className="text-gray-700">
                                                        {approval.requestedBy
                                                            ?.name ||
                                                            "Manager"}
                                                    </strong>
                                                </span>

                                                {approval.createdAt && (
                                                    <span>
                                                        {formatDate(
                                                            approval.createdAt
                                                        )}
                                                    </span>
                                                )}

                                            </div>

                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-wrap items-center gap-2 shrink-0">

                                            {approval.project?._id && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        navigate(`/projects/${approval.project._id}`)
                                                    }
                                                    className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-100 transition flex items-center gap-2"
                                                >
                                                    <FaEye />
                                                    View Project
                                                </button>
                                            )}

                                            {isPending &&
                                                canRespond && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            disabled={
                                                                isProcessing
                                                            }
                                                            onClick={() =>
                                                                handleApproval(
                                                                    approval._id,
                                                                    "Approved"
                                                                )
                                                            }
                                                            className="px-4 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black transition flex items-center gap-2 disabled:opacity-50"
                                                        >
                                                            <FaCheck />
                                                            Approve
                                                        </button>

                                                        <button
                                                            type="button"
                                                            disabled={
                                                                isProcessing
                                                            }
                                                            onClick={() =>
                                                                handleApproval(
                                                                    approval._id,
                                                                    "Rejected"
                                                                )
                                                            }
                                                            className="px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition flex items-center gap-2 disabled:opacity-50"
                                                        >
                                                            <FaTimes />
                                                            Reject
                                                        </button>
                                                    </>
                                                )}

                                        </div>

                                    </div>

                                </div>
                            );
                        })}

                    </div>
                )}

            </div>

        </div>
    );
};

export default Approvals;