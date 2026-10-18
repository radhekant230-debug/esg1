import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../utils/axios";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
    FaProjectDiagram,
    FaTasks,
    FaClipboardCheck,
    FaBell,
    FaUsers,
    FaArrowRight,
    FaClock,
    FaUserTie,
    FaChartLine,
    FaBuilding,
    FaThLarge,
    FaCalendarAlt,
    FaCalendarWeek,
    FaCloudUploadAlt,
    FaFire,
    FaHistory,
    FaWhatsapp,
    FaUserFriends,
} from "react-icons/fa";
import PlannerOverview from "../components/planner/PlannerOverview";
import ScheduleCalendar from "../components/planner/ScheduleCalendar";
import QuarterPlanner from "../components/planner/QuarterPlanner";
import ActivityListPanel from "../components/planner/ActivityListPanel";
import RemindersPanel from "../components/planner/RemindersPanel";
import EscalationsPanel from "../components/planner/EscalationsPanel";
import MonthlyAnalytics from "../components/sales/MonthlyAnalytics";
import ImportHistoryPanel from "../components/sales/ImportHistoryPanel";
import ExcelUploadModal from "../components/sales/ExcelUploadModal";
import ClientWhatsAppPanel from "../components/planner/ClientWhatsAppPanel";
import ManagerEnquiries from "../components/sales/ManagerEnquiries";

// Manager portal sections (order = navigation order).
const PORTAL_TABS = [
    { id: "overview", label: "Overview", icon: FaThLarge },
    { id: "whatsapp", label: "Client WhatsApp Contacts", icon: FaWhatsapp },
    { id: "analytics", label: "Monthly Analytics", icon: FaChartLine },
    { id: "calendar", label: "Manager Calendar", icon: FaCalendarAlt },
    { id: "quarter", label: "Quarterly Planner", icon: FaCalendarWeek },
    { id: "uploads", label: "Scheduled Uploads", icon: FaCloudUploadAlt },
    { id: "reminders", label: "Reminders & Notifications", icon: FaBell },
    { id: "approvals", label: "Pending Approvals", icon: FaClipboardCheck, badgeKey: "pendingApprovals" },
    { id: "escalations", label: "Escalated Tasks", icon: FaFire, badgeKey: "escalated" },
    { id: "enquiries", label: "Leads & Enquiries", icon: FaUserFriends },
    { id: "imports", label: "Sales Import History", icon: FaHistory },
    { id: "projects", label: "Collab", icon: FaProjectDiagram },
];

const ManagerDashboard = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [searchParams, setSearchParams] = useSearchParams();
    const requestedTab = searchParams.get("tab");
    const portalTab = PORTAL_TABS.some((t) => t.id === requestedTab) ? requestedTab : "overview";
    const focusActivityId = searchParams.get("activity") || "";
    const setPortalTab = (tabId) => {
        const params = new URLSearchParams(searchParams);
        params.set("tab", tabId);
        params.delete("activity");
        setSearchParams(params);
    };
    const [plannerRefresh, setPlannerRefresh] = useState(0);
    const [plannerBadges, setPlannerBadges] = useState({});
    const [globalUploadOpen, setGlobalUploadOpen] = useState(false);
    const bumpPlanner = () => setPlannerRefresh((n) => n + 1);

    useEffect(() => {
        let cancelled = false;
        api.get("/planner/summary")
            .then((res) => {
                if (cancelled) return;
                setPlannerBadges({
                    pendingApprovals: res.data.pendingApprovals?.length || 0,
                    escalated: res.data.escalated?.length || 0,
                });
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [plannerRefresh]);
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [approvals, setApprovals] = useState([]);
    const [notifications, setNotifications] = useState([]);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || (user.role !== "manager" && user.role !== "admin")) {
            navigate("/manager/login");
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
                "Error loading manager dashboard:",
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

    const getStatusStyle = (status) => {
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

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto py-20 text-center">
                <div className="inline-block w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-4" />

                <p className="text-gray-600 font-semibold">
                    Loading manager dashboard...
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">

            {/* TOP PORTAL NAVIGATION TABS (scrolls horizontally on mobile) */}
            <nav
                aria-label="Manager portal sections"
                className="bg-white p-2 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-2"
            >
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1" role="tablist">
                    {PORTAL_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const active = portalTab === tab.id;
                        const badge = tab.badgeKey ? plannerBadges[tab.badgeKey] : 0;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setPortalTab(tab.id)}
                                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                                    active
                                        ? "bg-gray-900 text-white shadow-md"
                                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                                }`}
                            >
                                <Icon className={active ? "text-amber-400" : "text-gray-400"} />
                                {tab.label}
                                {badge > 0 && (
                                    <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] flex items-center justify-center ${tab.id === "escalations" ? "bg-rose-600 text-white" : "bg-amber-500 text-white"}`}>
                                        {badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-2 pr-2 shrink-0">
                    <button
                        type="button"
                        id="manager-nav-import-sales-btn"
                        onClick={() => setGlobalUploadOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow transition cursor-pointer"
                        title="Upload sales data for any date range (CSV, Excel)"
                    >
                        <FaCloudUploadAlt />
                        <span className="hidden md:inline">Import Sales</span>
                    </button>
                    <div className="hidden xl:flex items-center gap-2 pl-1 text-xs font-mono text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Manager Active
                    </div>
                </div>
            </nav>

            <ExcelUploadModal
                isOpen={globalUploadOpen}
                onClose={() => setGlobalUploadOpen(false)}
                onSuccess={() => {
                    setGlobalUploadOpen(false);
                    bumpPlanner();
                }}
            />

            {portalTab === "overview" && (
                <PlannerOverview onNavigate={setPortalTab} refreshKey={plannerRefresh} onDataChanged={bumpPlanner} />
            )}
            {portalTab === "whatsapp" && <ClientWhatsAppPanel />}
            {portalTab === "analytics" && <MonthlyAnalytics refreshKey={plannerRefresh} />}
            {portalTab === "calendar" && (
                <ScheduleCalendar title="Manager calendar" refreshKey={plannerRefresh} onDataChanged={bumpPlanner} />
            )}
            {portalTab === "quarter" && <QuarterPlanner refreshKey={plannerRefresh} onDataChanged={bumpPlanner} />}
            {portalTab === "uploads" && (
                <ActivityListPanel
                    title="Scheduled uploads"
                    subtitle="Content/news uploads with their exact date, time (IST), manager, client and status. Reminders go to the assigned manager one day before."
                    presetType="Scheduled Upload"
                    refreshKey={plannerRefresh}
                    onDataChanged={bumpPlanner}
                    openActivityId={focusActivityId}
                    emptyText="No scheduled uploads yet."
                />
            )}
            {portalTab === "reminders" && <RemindersPanel refreshKey={plannerRefresh} />}
            {portalTab === "approvals" && (
                <ActivityListPanel
                    title="Pending approvals"
                    subtitle="Activities waiting for the client's approval."
                    presetStatus="Pending Approval"
                    allowCreate={false}
                    refreshKey={plannerRefresh}
                    onDataChanged={bumpPlanner}
                    openActivityId={focusActivityId}
                    emptyText="Nothing is waiting for client approval."
                />
            )}
            {portalTab === "escalations" && (
                <EscalationsPanel refreshKey={plannerRefresh} onDataChanged={bumpPlanner} openActivityId={focusActivityId} />
            )}
            {portalTab === "imports" && <ImportHistoryPanel refreshKey={plannerRefresh} onImported={bumpPlanner} />}

            {portalTab === "enquiries" && <ManagerEnquiries />}
            {portalTab === "projects" && (
                <div className="space-y-8">
                    {/* HEADER */}
                    <div className="bg-black text-white rounded-2xl p-6 sm:p-8 shadow-lg">

                <p className="text-gray-400 text-sm font-semibold mb-2">
                    MANAGER PORTAL
                </p>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">

                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">
                            Welcome, {user?.name}
                        </h1>

                        <p className="text-gray-300">
                            Manage your assigned projects,
                            tasks and client work.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-gray-800 px-4 py-3 rounded-lg">

                        <FaUserTie />

                        <div>
                            <p className="text-xs text-gray-400">
                                Role
                            </p>

                            <p className="text-sm font-bold">
                                Project Manager
                            </p>
                        </div>

                    </div>
                </div>
            </div>

            {/* STATISTICS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">

                {/* PROJECTS */}
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

                {/* TASKS */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">

                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                            Active Tasks
                        </p>

                        <h3 className="text-3xl font-black text-gray-900">
                            {activeTasks.length}
                        </h3>

                        <p className="text-xs text-gray-500 mt-1">
                            Assigned to you
                        </p>
                    </div>

                    <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center text-xl">
                        <FaTasks />
                    </div>
                </div>

                {/* APPROVALS */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">

                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                            Approvals
                        </p>

                        <h3 className="text-3xl font-black text-gray-900">
                            {pendingApprovals.length}
                        </h3>

                        <p className="text-xs text-gray-500 mt-1">
                            Waiting for client
                        </p>
                    </div>

                    <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-xl flex items-center justify-center text-xl">
                        <FaClipboardCheck />
                    </div>
                </div>

                {/* NOTIFICATIONS */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">

                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
                            Notifications
                        </p>

                        <h3 className="text-3xl font-black text-gray-900">
                            {unreadNotifications.length}
                        </h3>

                        <p className="text-xs text-gray-500 mt-1">
                            Unread notifications
                        </p>
                    </div>

                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center text-xl">
                        <FaBell />
                    </div>
                </div>
            </div>

            {/* PROJECTS + QUICK ACTIONS */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">

                {/* PROJECTS */}
                <div className="xl:col-span-2">

                    <div className="flex items-center justify-between mb-5">

                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                My Projects
                            </h2>

                            <p className="text-sm text-gray-500 mt-1">
                                Projects assigned to you
                            </p>
                        </div>

                        <button
                            type="button"
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
                                                            {project.name}
                                                        </h3>

                                                        {project.projectId && (
                                                            <span className="text-xs text-gray-400">
                                                                {project.projectId}
                                                            </span>
                                                        )}

                                                    </div>

                                                    <p className="text-sm text-gray-500 line-clamp-1">
                                                        {project.description}
                                                    </p>

                                                    <div className="flex flex-wrap items-center gap-3 mt-3">

                                                        <span
                                                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusStyle(
                                                                project.status
                                                            )}`}
                                                        >
                                                            {project.status}
                                                        </span>

                                                        <span className="text-xs text-gray-500">
                                                            Client:{" "}
                                                            <strong className="text-gray-700">
                                                                {project.client?.name ||
                                                                    "Not available"}
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
                                                            {project.progress || 0}%
                                                        </p>

                                                    </div>

                                                    <button
                                                        type="button"
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
                                                        {project.status}
                                                    </span>

                                                    <span className="font-semibold text-gray-700">
                                                        {project.progress || 0}%
                                                    </span>

                                                </div>

                                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">

                                                    <div
                                                        className="h-full bg-gray-900 rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${Math.min(
                                                                Math.max(
                                                                    project.progress || 0,
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

                {/* QUICK ACTIONS */}
                <div>

                    <h2 className="text-2xl font-bold text-gray-900 mb-5">
                        Quick Actions
                    </h2>

                    <div className="space-y-3">

                        <button
                            type="button"
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
                                    Manage assigned projects
                                </p>
                            </div>

                            <FaArrowRight className="text-gray-400" />
                        </button>

                        <button
                            type="button"
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
                                    Manage Tasks
                                </h3>

                                <p className="text-xs text-gray-500">
                                    Update task progress
                                </p>
                            </div>

                            <FaArrowRight className="text-gray-400" />
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                navigate("/approvals")
                            }
                            className="w-full bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition text-left"
                        >
                            <div className="w-11 h-11 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center">
                                <FaClipboardCheck />
                            </div>

                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900">
                                    Client Approvals
                                </h3>

                                <p className="text-xs text-gray-500">
                                    {pendingApprovals.length} pending
                                </p>
                            </div>

                            <FaArrowRight className="text-gray-400" />
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                navigate("/messages")
                            }
                            className="w-full bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition text-left"
                        >
                            <div className="w-11 h-11 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                <FaUsers />
                            </div>

                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900">
                                    Client Messages
                                </h3>

                                <p className="text-xs text-gray-500">
                                    Communicate with clients
                                </p>
                            </div>

                            <FaArrowRight className="text-gray-400" />
                        </button>

                        <button
                            type="button"
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

                    </div>
                </div>

            </div>

            {/* TASKS */}
            <div className="mb-8">

                <div className="flex items-center justify-between mb-5">

                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                            Recent Tasks
                        </h2>

                        <p className="text-sm text-gray-500 mt-1">
                            Tasks requiring your attention
                        </p>
                    </div>

                    <button
                        type="button"
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
                                No tasks assigned yet.
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
                                                            {task.taskId}
                                                        </span>
                                                    )}

                                                </div>

                                                <p className="text-sm text-gray-500 mt-1">
                                                    Project:{" "}
                                                    <span className="font-semibold text-gray-700">
                                                        {task.project?.name ||
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
                                                    {task.status}
                                                </span>

                                                <div className="flex items-center gap-2">

                                                    <FaClock className="text-gray-400 text-xs" />

                                                    <span className="text-xs text-gray-500">
                                                        {task.dueDate
                                                            ? new Date(
                                                                task.dueDate
                                                            ).toLocaleDateString(
                                                                "en-IN",
                                                                {
                                                                    day: "2-digit",
                                                                    month: "short",
                                                                }
                                                            )
                                                            : "No due date"}
                                                    </span>

                                                </div>

                                                <span className="text-sm font-bold text-gray-900">
                                                    {task.progress || 0}%
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
                                                                task.progress || 0,
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

            {/* APPROVALS */}
            <div>

                <div className="flex items-center justify-between mb-5">

                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                            Pending Approvals
                        </h2>

                        <p className="text-sm text-gray-500 mt-1">
                            Requests waiting for client action
                        </p>
                    </div>

                    <button
                        type="button"
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
                                                    {approval.project?.name ||
                                                        approval.projectName ||
                                                        "Project"}
                                                </p>

                                                <p className="text-xs text-gray-400 mt-2">
                                                    Client:{" "}
                                                    <span className="font-semibold text-gray-600">
                                                        {approval.client?.name ||
                                                            approval.requestedBy
                                                                ?.name ||
                                                            "Client"}
                                                    </span>
                                                </p>

                                            </div>

                                            <button
                                                type="button"
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
            </div>
            )}
        </div>
    );
};

export default ManagerDashboard;