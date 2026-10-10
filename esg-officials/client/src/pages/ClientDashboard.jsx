import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../utils/axios";
import { useNavigate } from "react-router-dom";

import {
    FaProjectDiagram,
    FaTasks,
    FaClipboardCheck,
    FaBell,
    FaUserTie,
    FaArrowRight,
    FaCalendarAlt,
    FaComments,
} from "react-icons/fa";

const ClientDashboard = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [approvals, setApprovals] = useState([]);
    const [notifications, setNotifications] = useState([]);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || user.role !== "client") {
            navigate("/login");
            return;
        }

        fetchDashboardData();
    }, [user, navigate]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            const results = await Promise.allSettled([
                api.get("/projects"),
                api.get("/tasks"),
                api.get("/approvals"),
                api.get("/notifications"),
            ]);

            const extractData = (result, key) => {
                if (result.status !== "fulfilled") {
                    return [];
                }

                const data = result.value.data;

                if (Array.isArray(data)) {
                    return data;
                }

                return data?.[key] || [];
            };

            setProjects(
                extractData(results[0], "projects")
            );

            setTasks(
                extractData(results[1], "tasks")
            );

            setApprovals(
                extractData(results[2], "approvals")
            );

            setNotifications(
                extractData(results[3], "notifications")
            );
        } catch (error) {
            console.error(
                "Error loading client dashboard:",
                error
            );
        } finally {
            setLoading(false);
        }
    };

    const activeProjects = projects.filter(
        (project) =>
            !["Completed", "Cancelled"].includes(
                project.status
            )
    );

    const completedProjects = projects.filter(
        (project) => project.status === "Completed"
    );

    const activeTasks = tasks.filter(
        (task) =>
            !["Completed", "Rejected"].includes(
                task.status
            )
    );

    const pendingApprovals = approvals.filter(
        (approval) =>
            String(approval.status || "").toLowerCase() ===
            "pending"
    );

    const unreadNotifications = notifications.filter(
        (notification) =>
            notification.isRead === false ||
            notification.read === false
    );

    const getProjectStatusStyle = (status) => {
        switch (status) {
            case "Completed":
                return "bg-green-100 text-green-700";

            case "In Progress":
                return "bg-blue-100 text-blue-700";

            case "Planning":
                return "bg-yellow-100 text-yellow-700";

            case "Waiting for Client":
                return "bg-orange-100 text-orange-700";

            case "On Hold":
                return "bg-gray-200 text-gray-700";

            case "Cancelled":
                return "bg-red-100 text-red-700";

            default:
                return "bg-gray-100 text-gray-600";
        }
    };

    const getTaskStatusStyle = (status) => {
        switch (status) {
            case "Completed":
            case "Approved":
                return "bg-green-100 text-green-700";

            case "In Progress":
                return "bg-blue-100 text-blue-700";

            case "Review":
                return "bg-purple-100 text-purple-700";

            case "Waiting for Approval":
                return "bg-orange-100 text-orange-700";

            case "Rejected":
                return "bg-red-100 text-red-700";

            default:
                return "bg-gray-100 text-gray-600";
        }
    };

    const formatDate = (date) => {
        if (!date) return "Not set";

        return new Date(date).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto py-20 text-center">
                <div className="inline-block w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-4" />

                <p className="text-gray-600 font-semibold">
                    Loading your dashboard...
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">

            {/* ==========================================
                HEADER
            ========================================== */}

            <div className="bg-black text-white rounded-2xl p-6 sm:p-8 mb-8 shadow-lg">

                <p className="text-gray-400 text-sm font-semibold mb-2">
                    CLIENT PORTAL
                </p>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">
                            Welcome, {user?.name}
                        </h1>

                        <p className="text-gray-300">
                            Track your projects, tasks and
                            approvals from one place.
                        </p>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-4 min-w-[220px]">

                        <p className="text-xs text-gray-400 mb-1">
                            Client ID
                        </p>

                        <p className="text-lg font-bold tracking-wide">
                            {user?.clientId ||
                                "Not assigned"}
                        </p>

                        {user?.companyName && (
                            <p className="text-xs text-gray-400 mt-1">
                                {user.companyName}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* ==========================================
                STATISTICS
            ========================================== */}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">

                {/* Projects */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">

                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                            My Projects
                        </p>

                        <h3 className="text-3xl font-black text-gray-900">
                            {projects.length}
                        </h3>

                        <p className="text-xs text-gray-500 mt-1">
                            {activeProjects.length} active
                        </p>
                    </div>

                    <div className="w-12 h-12 bg-gray-100 text-gray-700 rounded-xl flex items-center justify-center text-xl">
                        <FaProjectDiagram />
                    </div>
                </div>

                {/* Tasks */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">

                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                            Active Tasks
                        </p>

                        <h3 className="text-3xl font-black text-gray-900">
                            {activeTasks.length}
                        </h3>

                        <p className="text-xs text-gray-500 mt-1">
                            Across your projects
                        </p>
                    </div>

                    <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center text-xl">
                        <FaTasks />
                    </div>
                </div>

                {/* Approvals */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">

                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                            Pending Approvals
                        </p>

                        <h3 className="text-3xl font-black text-gray-900">
                            {pendingApprovals.length}
                        </h3>

                        <p className="text-xs text-gray-500 mt-1">
                            Require your action
                        </p>
                    </div>

                    <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-xl flex items-center justify-center text-xl">
                        <FaClipboardCheck />
                    </div>
                </div>

                {/* Notifications */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">

                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                            Notifications
                        </p>

                        <h3 className="text-3xl font-black text-gray-900">
                            {unreadNotifications.length}
                        </h3>

                        <p className="text-xs text-gray-500 mt-1">
                            Unread updates
                        </p>
                    </div>

                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center text-xl">
                        <FaBell />
                    </div>
                </div>
            </div>

            {/* ==========================================
                PROJECTS + PROFILE
            ========================================== */}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">

                {/* Projects */}
                <div className="xl:col-span-2">

                    <div className="flex items-center justify-between mb-5">

                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                My Projects
                            </h2>

                            <p className="text-sm text-gray-500 mt-1">
                                Current projects and progress
                            </p>
                        </div>

                        <button
                            onClick={() =>
                                navigate("/projects")
                            }
                            className="text-sm font-bold text-gray-900 hover:text-gray-500 transition flex items-center gap-2"
                        >
                            View All
                            <FaArrowRight className="text-xs" />
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

                        {projects.length === 0 ? (
                            <div className="p-10 text-center">

                                <FaProjectDiagram className="mx-auto text-3xl text-gray-300 mb-3" />

                                <p className="text-gray-500 font-medium">
                                    No projects assigned yet.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">

                                {projects
                                    .slice(0, 5)
                                    .map((project) => (
                                        <div
                                            key={project._id}
                                            className="p-5 hover:bg-gray-50 transition"
                                        >

                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                                                <div className="min-w-0">

                                                    <div className="flex items-center gap-3 mb-1">

                                                        <h3 className="font-bold text-gray-900 truncate">
                                                            {
                                                                project.name
                                                            }
                                                        </h3>

                                                        {project.projectId && (
                                                            <span className="text-xs text-gray-400">
                                                                {
                                                                    project.projectId
                                                                }
                                                            </span>
                                                        )}
                                                    </div>

                                                    <p className="text-sm text-gray-500 line-clamp-1">
                                                        {
                                                            project.description
                                                        }
                                                    </p>

                                                    <div className="flex flex-wrap items-center gap-3 mt-3">

                                                        <span
                                                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getProjectStatusStyle(
                                                                project.status
                                                            )}`}
                                                        >
                                                            {
                                                                project.status
                                                            }
                                                        </span>

                                                        <span className="text-xs text-gray-500">
                                                            Manager:{" "}
                                                            <strong className="text-gray-700">
                                                                {project.assignedManager
                                                                    ?.name ||
                                                                    "Not assigned"}
                                                            </strong>
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 shrink-0">

                                                    <div className="text-right">
                                                        <p className="text-xs text-gray-400">
                                                            Progress
                                                        </p>

                                                        <p className="font-bold text-gray-900">
                                                            {
                                                                project.progress
                                                            }
                                                            %
                                                        </p>
                                                    </div>

                                                    <button
                                                        onClick={() =>
                                                            navigate(
                                                                `/projects/${project._id}`
                                                            )
                                                        }
                                                        className="w-9 h-9 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-900 hover:text-white transition flex items-center justify-center"
                                                    >
                                                        <FaArrowRight className="text-xs" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-4">

                                                <div className="flex justify-between text-xs mb-1">

                                                    <span className="text-gray-400">
                                                        {
                                                            project.status
                                                        }
                                                    </span>

                                                    <span className="font-semibold text-gray-700">
                                                        {
                                                            project.progress
                                                        }
                                                        %
                                                    </span>
                                                </div>

                                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">

                                                    <div
                                                        className="h-full bg-gray-900 rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${Math.min(
                                                                Math.max(
                                                                    project.progress ||
                                                                        0,
                                                                    0
                                                                ),
                                                                100
                                                            )}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Client Information */}
                <div>

                    <h2 className="text-2xl font-bold text-gray-900 mb-5">
                        My Account
                    </h2>

                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

                        <div className="bg-gray-900 p-6 text-white">

                            <div className="w-14 h-14 bg-white text-gray-900 rounded-full flex items-center justify-center text-xl font-black mb-4">
                                {user?.name
                                    ?.charAt(0)
                                    ?.toUpperCase() || "C"}
                            </div>

                            <h3 className="text-lg font-bold">
                                {user?.name}
                            </h3>

                            <p className="text-sm text-gray-400 mt-1">
                                {user?.email}
                            </p>
                        </div>

                        <div className="p-5 space-y-4">

                            <div>
                                <p className="text-xs text-gray-400">
                                    Client ID
                                </p>

                                <p className="text-sm font-bold text-gray-800 mt-1">
                                    {user?.clientId ||
                                        "Not assigned"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-gray-400">
                                    Company
                                </p>

                                <p className="text-sm font-bold text-gray-800 mt-1">
                                    {user?.companyName ||
                                        "Not provided"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-gray-400">
                                    Phone
                                </p>

                                <p className="text-sm font-bold text-gray-800 mt-1">
                                    {user?.phone ||
                                        "Not provided"}
                                </p>
                            </div>

                            <button
                                onClick={() =>
                                    navigate("/profile")
                                }
                                className="w-full mt-2 bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-black transition"
                            >
                                View Profile
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ==========================================
                TASKS
            ========================================== */}

            <div className="mb-8">

                <div className="flex items-center justify-between mb-5">

                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                            Recent Tasks
                        </h2>

                        <p className="text-sm text-gray-500 mt-1">
                            Track work happening on your projects
                        </p>
                    </div>

                    <button
                        onClick={() =>
                            navigate("/tasks")
                        }
                        className="text-sm font-bold text-gray-900 hover:text-gray-500 transition flex items-center gap-2"
                    >
                        View All
                        <FaArrowRight className="text-xs" />
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

                    {tasks.length === 0 ? (
                        <div className="p-8 text-center">

                            <FaTasks className="mx-auto text-3xl text-gray-300 mb-3" />

                            <p className="text-gray-500">
                                No tasks available.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">

                            {tasks
                                .slice(0, 6)
                                .map((task) => (
                                    <div
                                        key={task._id}
                                        className="p-5 hover:bg-gray-50 transition"
                                    >

                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                                            <div className="min-w-0">

                                                <div className="flex items-center gap-3">

                                                    <h3 className="font-bold text-gray-900 truncate">
                                                        {task.title}
                                                    </h3>

                                                    {task.taskId && (
                                                        <span className="text-xs text-gray-400">
                                                            {
                                                                task.taskId
                                                            }
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-sm text-gray-500 mt-1">
                                                    Project:{" "}
                                                    <span className="font-semibold text-gray-700">
                                                        {task.project
                                                            ?.name ||
                                                            "Unknown"}
                                                    </span>
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-4">

                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-semibold ${getTaskStatusStyle(
                                                        task.status
                                                    )}`}
                                                >
                                                    {
                                                        task.status
                                                    }
                                                </span>

                                                <div className="flex items-center gap-2">

                                                    <FaCalendarAlt className="text-gray-400 text-xs" />

                                                    <span className="text-xs text-gray-500">
                                                        {formatDate(
                                                            task.dueDate
                                                        )}
                                                    </span>
                                                </div>

                                                <span className="text-sm font-bold text-gray-900">
                                                    {
                                                        task.progress
                                                    }
                                                    %
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-4">

                                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">

                                                <div
                                                    className="h-full bg-gray-900 rounded-full transition-all"
                                                    style={{
                                                        width: `${Math.min(
                                                            Math.max(
                                                                task.progress ||
                                                                    0,
                                                                0
                                                            ),
                                                            100
                                                        )}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ==========================================
                APPROVALS + QUICK ACTIONS
            ========================================== */}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* Approvals */}
                <div className="xl:col-span-2">

                    <div className="flex items-center justify-between mb-5">

                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                Approval Requests
                            </h2>

                            <p className="text-sm text-gray-500 mt-1">
                                Requests waiting for your response
                            </p>
                        </div>

                        <button
                            onClick={() =>
                                navigate("/approvals")
                            }
                            className="text-sm font-bold text-gray-900 hover:text-gray-500 transition flex items-center gap-2"
                        >
                            View All
                            <FaArrowRight className="text-xs" />
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

                        {pendingApprovals.length === 0 ? (
                            <div className="p-8 text-center">

                                <FaClipboardCheck className="mx-auto text-3xl text-gray-300 mb-3" />

                                <p className="text-gray-500 font-medium">
                                    No pending approvals.
                                </p>

                                <p className="text-xs text-gray-400 mt-1">
                                    You're all caught up.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">

                                {pendingApprovals
                                    .slice(0, 5)
                                    .map((approval) => (
                                        <div
                                            key={approval._id}
                                            className="p-5 hover:bg-gray-50 transition"
                                        >

                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                                                <div className="min-w-0">

                                                    <h3 className="font-bold text-gray-900">
                                                        {approval.title ||
                                                            approval.subject ||
                                                            "Approval Request"}
                                                    </h3>

                                                    <p className="text-sm text-gray-500 mt-1">
                                                        {approval.project
                                                            ?.name ||
                                                            approval.projectName ||
                                                            "Project"}
                                                    </p>

                                                    <p className="text-xs text-gray-400 mt-2">
                                                        Requested by{" "}
                                                        <span className="font-semibold text-gray-600">
                                                            {approval.requestedBy
                                                                ?.name ||
                                                                "Project Manager"}
                                                        </span>
                                                    </p>
                                                </div>

                                                <button
                                                    onClick={() =>
                                                        navigate(
                                                            `/approvals/${approval._id}`
                                                        )
                                                    }
                                                    className="shrink-0 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-black transition flex items-center justify-center gap-2"
                                                >
                                                    Review
                                                    <FaArrowRight className="text-xs" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div>

                    <h2 className="text-2xl font-bold text-gray-900 mb-5">
                        Quick Actions
                    </h2>

                    <div className="space-y-3">

                        <button
                            onClick={() =>
                                navigate("/projects")
                            }
                            className="w-full bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition text-left"
                        >
                            <div className="w-11 h-11 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
                                <FaProjectDiagram />
                            </div>

                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900">
                                    My Projects
                                </h3>

                                <p className="text-xs text-gray-500">
                                    View project progress
                                </p>
                            </div>

                            <FaArrowRight className="text-gray-400" />
                        </button>

                        <button
                            onClick={() =>
                                navigate("/tasks")
                            }
                            className="w-full bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition text-left"
                        >
                            <div className="w-11 h-11 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                                <FaTasks />
                            </div>

                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900">
                                    My Tasks
                                </h3>

                                <p className="text-xs text-gray-500">
                                    Track assigned work
                                </p>
                            </div>

                            <FaArrowRight className="text-gray-400" />
                        </button>

                        <button
                            onClick={() =>
                                navigate("/messages")
                            }
                            className="w-full bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition text-left"
                        >
                            <div className="w-11 h-11 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                <FaComments />
                            </div>

                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900">
                                    Messages
                                </h3>

                                <p className="text-xs text-gray-500">
                                    Contact your manager
                                </p>
                            </div>

                            <FaArrowRight className="text-gray-400" />
                        </button>

                        <button
                            onClick={() =>
                                navigate("/notifications")
                            }
                            className="w-full bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition text-left"
                        >
                            <div className="w-11 h-11 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                                <FaBell />
                            </div>

                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900">
                                    Notifications
                                </h3>

                                <p className="text-xs text-gray-500">
                                    {unreadNotifications.length} unread
                                </p>
                            </div>

                            <FaArrowRight className="text-gray-400" />
                        </button>

                        <button
                            onClick={() =>
                                navigate("/profile")
                            }
                            className="w-full bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition text-left"
                        >
                            <div className="w-11 h-11 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
                                <FaUserTie />
                            </div>

                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900">
                                    My Profile
                                </h3>

                                <p className="text-xs text-gray-500">
                                    Manage account details
                                </p>
                            </div>

                            <FaArrowRight className="text-gray-400" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientDashboard;