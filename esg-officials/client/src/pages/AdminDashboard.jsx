import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../utils/axios";
import { useNavigate } from "react-router-dom";

import {
    FaProjectDiagram,
    FaUsers,
    FaUserTie,
    FaTasks,
    FaClipboardCheck,
    FaBell,
    FaArrowRight,
    FaPlus,
    FaTachometerAlt,
} from "react-icons/fa";

const AdminDashboard = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [projects, setProjects] = useState([]);
    const [clients, setClients] = useState([]);
    const [managers, setManagers] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [approvals, setApprovals] = useState([]);
    const [notifications, setNotifications] = useState([]);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || user.role !== "admin") {
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
                api.get("/clients"),
                api.get("/clients/managers/all"),
                api.get("/tasks"),
                api.get("/approvals"),
                api.get("/notifications"),
            ]);

            const getData = (result) => {
                if (result.status !== "fulfilled") return [];

                const data = result.value.data;

                if (Array.isArray(data)) return data;

                return (
                    data?.projects ||
                    data?.clients ||
                    data?.managers ||
                    data?.tasks ||
                    data?.approvals ||
                    data?.notifications ||
                    []
                );
            };

            setProjects(getData(results[0]));
            setClients(getData(results[1]));
            setManagers(getData(results[2]));
            setTasks(getData(results[3]));
            setApprovals(getData(results[4]));
            setNotifications(getData(results[5]));
        } catch (error) {
            console.error(
                "Error fetching admin dashboard:",
                error
            );
        } finally {
            setLoading(false);
        }
    };

    const pendingApprovals = approvals.filter(
        (approval) =>
            String(approval.status || "").toLowerCase() ===
            "pending"
    );

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

    const unreadNotifications = notifications.filter(
        (notification) =>
            notification.isRead === false ||
            notification.read === false
    );

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto py-20 text-center">
                <div className="inline-block w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-4" />

                <p className="text-gray-600 font-semibold">
                    Loading admin dashboard...
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">

            {/* ==========================================
                HEADER
            ========================================== */}

            <div className="bg-stone-900 text-white rounded-2xl p-6 sm:p-8 mb-8 border border-stone-800 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">

                <div>
                    <div className="flex items-center gap-2.5 mb-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-amber-400/20 text-amber-300 border border-amber-400/60 font-mono shadow-[0_0_10px_rgba(245,158,11,0.25)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            ADMIN
                        </span>
                        <span className="text-stone-400 text-xs font-mono tracking-widest uppercase font-semibold">
                            EXECUTIVE CONTROL PANEL
                        </span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-2 tracking-tight">
                        Admin Dashboard
                    </h1>

                    <p className="text-stone-300 text-sm max-w-xl">
                        Welcome back, <span className="font-semibold text-white">{user?.name}</span>. Manage clients, onboard new accounts, assign account managers, and monitor agency performance from your central administration hub.
                    </p>

                    {/* Admin-only Navigation Section */}
                    <div className="flex flex-wrap items-center gap-2.5 mt-5 pt-4 border-t border-stone-800">
                        <span className="text-[11px] font-mono uppercase text-amber-400/90 font-bold tracking-wider mr-1">
                            Admin Controls:
                        </span>
                        <button
                            onClick={() => navigate("/clients")}
                            className="px-3.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white text-xs font-semibold border border-stone-700 transition flex items-center gap-1.5"
                        >
                            <FaUsers className="text-amber-400" />
                            Client Management
                        </button>
                        <button
                            onClick={() => navigate("/clients?action=add")}
                            className="px-3.5 py-1.5 rounded-lg bg-[#C5A880] hover:bg-[#B39369] text-stone-900 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                        >
                            <FaPlus />
                            + Add New Client
                        </button>
                        <button
                            onClick={() => navigate("/managers")}
                            className="px-3.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white text-xs font-semibold border border-stone-700 transition flex items-center gap-1.5"
                        >
                            <FaUserTie className="text-stone-400" />
                            Manage Managers
                        </button>
                        <button
                            onClick={() => navigate("/dashboard")}
                            className="px-3.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white text-xs font-semibold border border-stone-700 transition flex items-center gap-1.5"
                        >
                            <FaTachometerAlt className="text-amber-400" />
                            Client Portals
                        </button>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                    <button
                        onClick={() => navigate("/clients?action=add")}
                        className="bg-[#C5A880] hover:bg-[#B39369] text-stone-900 font-bold py-3 px-5 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm"
                    >
                        <FaPlus />
                        Add New Client
                    </button>
                    <button
                        onClick={() => navigate("/projects/create")}
                        className="bg-stone-800 hover:bg-stone-700 text-white font-bold py-3 px-5 rounded-xl transition border border-stone-700 shadow-md flex items-center justify-center gap-2 text-sm"
                    >
                        <FaPlus />
                        Create Project
                    </button>
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
                            Total Projects
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

                {/* Clients */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                            Clients
                        </p>

                        <h3 className="text-3xl font-black text-gray-900">
                            {clients.length}
                        </h3>

                        <p className="text-xs text-gray-500 mt-1">
                            Registered clients
                        </p>
                    </div>

                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-xl">
                        <FaUsers />
                    </div>
                </div>

                {/* Managers */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                            Managers
                        </p>

                        <h3 className="text-3xl font-black text-gray-900">
                            {managers.length}
                        </h3>

                        <p className="text-xs text-gray-500 mt-1">
                            Project managers
                        </p>
                    </div>

                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-xl">
                        <FaUserTie />
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
                            Currently active
                        </p>
                    </div>

                    <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center text-xl">
                        <FaTasks />
                    </div>
                </div>
            </div>

            {/* ==========================================
                SECONDARY STATS
            ========================================== */}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Completed Projects
                    </p>

                    <div className="flex items-end justify-between mt-2">
                        <h3 className="text-2xl font-black text-green-600">
                            {completedProjects.length}
                        </h3>

                        <span className="text-xs text-gray-500">
                            completed
                        </span>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Pending Approvals
                    </p>

                    <div className="flex items-end justify-between mt-2">
                        <h3 className="text-2xl font-black text-yellow-600">
                            {pendingApprovals.length}
                        </h3>

                        <span className="text-xs text-gray-500">
                            require attention
                        </span>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Notifications
                    </p>

                    <div className="flex items-end justify-between mt-2">
                        <h3 className="text-2xl font-black text-red-600">
                            {unreadNotifications.length}
                        </h3>

                        <span className="text-xs text-gray-500">
                            unread
                        </span>
                    </div>
                </div>
            </div>

            {/* ==========================================
                MAIN CONTENT
            ========================================== */}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* ======================================
                    PROJECTS
                ====================================== */}

                <div className="xl:col-span-2">

                    <div className="flex items-center justify-between mb-5">

                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                Recent Projects
                            </h2>

                            <p className="text-sm text-gray-500 mt-1">
                                Latest projects in the system
                            </p>
                        </div>

                        <button
                            onClick={() => navigate("/projects")}
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
                                    No projects created yet.
                                </p>

                                <button
                                    onClick={() =>
                                        navigate(
                                            "/projects/create"
                                        )
                                    }
                                    className="mt-4 bg-gray-900 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-black transition"
                                >
                                    Create First Project
                                </button>
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

                                                        <span className="text-xs text-gray-400">
                                                            {
                                                                project.projectId
                                                            }
                                                        </span>
                                                    </div>

                                                    <p className="text-sm text-gray-500 line-clamp-1">
                                                        {
                                                            project.description
                                                        }
                                                    </p>

                                                    <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-500">

                                                        <span>
                                                            Client:{" "}
                                                            <strong className="text-gray-700">
                                                                {project.client
                                                                    ?.name ||
                                                                    "Not assigned"}
                                                            </strong>
                                                        </span>

                                                        <span>
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
                                                        className="h-full bg-gray-900 rounded-full transition-all"
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

                {/* ======================================
                    QUICK ACTIONS
                ====================================== */}

                <div>

                    <h2 className="text-2xl font-bold text-gray-900 mb-5">
                        Quick Actions
                    </h2>

                    <div className="space-y-3">

                        <button
                            onClick={() =>
                                navigate("/clients")
                            }
                            className="w-full bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-4 hover:shadow-md hover:border-gray-200 transition text-left"
                        >
                            <div className="w-11 h-11 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                <FaUsers />
                            </div>

                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900">
                                    Manage Clients
                                </h3>

                                <p className="text-xs text-gray-500">
                                    View and assign clients
                                </p>
                            </div>

                            <FaArrowRight className="text-gray-400" />
                        </button>

                        <button
                            onClick={() =>
                                navigate("/managers")
                            }
                            className="w-full bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-4 hover:shadow-md hover:border-gray-200 transition text-left"
                        >
                            <div className="w-11 h-11 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                                <FaUserTie />
                            </div>

                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900">
                                    Manage Managers
                                </h3>

                                <p className="text-xs text-gray-500">
                                    Manage your team
                                </p>
                            </div>

                            <FaArrowRight className="text-gray-400" />
                        </button>

                        <button
                            onClick={() =>
                                navigate("/tasks")
                            }
                            className="w-full bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-4 hover:shadow-md hover:border-gray-200 transition text-left"
                        >
                            <div className="w-11 h-11 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                                <FaTasks />
                            </div>

                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900">
                                    Manage Tasks
                                </h3>

                                <p className="text-xs text-gray-500">
                                    Track project tasks
                                </p>
                            </div>

                            <FaArrowRight className="text-gray-400" />
                        </button>

                        <button
                            onClick={() =>
                                navigate("/approvals")
                            }
                            className="w-full bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-4 hover:shadow-md hover:border-gray-200 transition text-left"
                        >
                            <div className="w-11 h-11 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center">
                                <FaClipboardCheck />
                            </div>

                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900">
                                    Review Approvals
                                </h3>

                                <p className="text-xs text-gray-500">
                                    {pendingApprovals.length} pending
                                    requests
                                </p>
                            </div>

                            <FaArrowRight className="text-gray-400" />
                        </button>

                        <button
                            onClick={() =>
                                navigate("/notifications")
                            }
                            className="w-full bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-4 hover:shadow-md hover:border-gray-200 transition text-left"
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
                    </div>
                </div>
            </div>

            {/* ==========================================
                RECENT TASKS
            ========================================== */}

            <div className="mt-8">

                <div className="flex items-center justify-between mb-5">

                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                            Recent Tasks
                        </h2>

                        <p className="text-sm text-gray-500 mt-1">
                            Latest activity across projects
                        </p>
                    </div>

                    <button
                        onClick={() => navigate("/tasks")}
                        className="text-sm font-bold text-gray-900 hover:text-gray-500 transition flex items-center gap-2"
                    >
                        View All
                        <FaArrowRight className="text-xs" />
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

                    {tasks.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No tasks available.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">

                            {tasks
                                .slice(0, 5)
                                .map((task) => (
                                    <div
                                        key={task._id}
                                        className="p-5 hover:bg-gray-50 transition"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="font-bold text-gray-900 truncate">
                                                        {task.title}
                                                    </h3>

                                                    <span className="text-xs text-gray-400">
                                                        {
                                                            task.taskId
                                                        }
                                                    </span>
                                                </div>

                                                <p className="text-sm text-gray-500 mt-1">
                                                    Project:{" "}
                                                    <span className="font-medium text-gray-700">
                                                        {task.project
                                                            ?.name ||
                                                            "Unknown"}
                                                    </span>
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-4">

                                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                                                    {
                                                        task.status
                                                    }
                                                </span>

                                                <span className="text-sm font-bold text-gray-900">
                                                    {
                                                        task.progress
                                                    }
                                                    %
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;