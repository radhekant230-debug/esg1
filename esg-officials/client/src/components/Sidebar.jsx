import React, { useContext } from "react";
import { NavLink } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

import {
    FaTachometerAlt,
    FaProjectDiagram,
    FaTasks,
    FaClipboardCheck,
    FaFileAlt,
    FaComments,
    FaBell,
    FaUsers,
    FaUserTie,
    FaHistory,
    FaTimes,
} from "react-icons/fa";

const Sidebar = ({ isOpen = true, onClose }) => {
    const { user, isAdmin, isManager, isClient } =
        useContext(AuthContext);

    const linkClasses = ({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg transition duration-200 ${
            isActive
                ? "bg-gray-900 text-white shadow-md"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`;

    const closeSidebar = () => {
        if (onClose) {
            onClose();
        }
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-30 lg:hidden"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed top-0 left-0 z-40
                    h-screen w-64
                    bg-white border-r border-gray-200
                    shadow-lg
                    transition-transform duration-300
                    flex flex-col
                    ${
                        isOpen
                            ? "translate-x-0"
                            : "-translate-x-full"
                    }
                    lg:translate-x-0
                `}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-5 border-b border-gray-200">
                    <div>
                        <h1 className="text-xl font-extrabold text-gray-900">
                            Client Portal
                        </h1>

                        <p className="text-xs text-gray-500 mt-1">
                            Management System
                        </p>
                    </div>

                    {/* Mobile Close */}
                    <button
                        type="button"
                        onClick={closeSidebar}
                        className="lg:hidden text-gray-500 hover:text-gray-900 transition"
                    >
                        <FaTimes />
                    </button>
                </div>

                {/* User Info */}
                {user && (
                    <div className="px-4 py-4 border-b border-gray-200">
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-sm font-bold text-gray-900 truncate">
                                {user.name}
                            </p>

                            <p className="text-xs text-gray-500 truncate mt-1">
                                {user.email}
                            </p>

                            <span className="inline-block mt-2 text-xs font-semibold bg-gray-900 text-white px-2.5 py-1 rounded-md capitalize">
                                {user.role}
                            </span>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 py-4">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-4 mb-3">
                        Main Menu
                    </p>

                    <div className="space-y-1">

                        {/* =====================================
                            COMMON DASHBOARD
                        ===================================== */}

                        <NavLink
                            to={
                                isAdmin
                                    ? "/admin"
                                    : isManager
                                    ? "/manager"
                                    : "/dashboard"
                            }
                            className={linkClasses}
                            onClick={closeSidebar}
                        >
                            <FaTachometerAlt />
                            <span>Dashboard</span>
                        </NavLink>

                        {/* =====================================
                            ADMIN MENU
                        ===================================== */}

                        {isAdmin && (
                            <>
                                <NavLink
                                    to="/projects"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaProjectDiagram />
                                    <span>Projects</span>
                                </NavLink>

                                <NavLink
                                    to="/clients"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaUsers />
                                    <span>Clients</span>
                                </NavLink>

                                <NavLink
                                    to="/managers"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaUserTie />
                                    <span>Managers</span>
                                </NavLink>

                                <NavLink
                                    to="/tasks"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaTasks />
                                    <span>Tasks</span>
                                </NavLink>

                                <NavLink
                                    to="/approvals"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaClipboardCheck />
                                    <span>Approvals</span>
                                </NavLink>

                                <NavLink
                                    to="/documents"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaFileAlt />
                                    <span>Documents</span>
                                </NavLink>

                                <NavLink
                                    to="/messages"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaComments />
                                    <span>Messages</span>
                                </NavLink>

                                <NavLink
                                    to="/notifications"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaBell />
                                    <span>Notifications</span>
                                </NavLink>

                                <NavLink
                                    to="/activity"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaHistory />
                                    <span>Activity Logs</span>
                                </NavLink>
                            </>
                        )}

                        {/* =====================================
                            MANAGER MENU
                        ===================================== */}

                        {isManager && (
                            <>
                                <NavLink
                                    to="/projects"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaProjectDiagram />
                                    <span>My Projects</span>
                                </NavLink>

                                <NavLink
                                    to="/tasks"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaTasks />
                                    <span>Tasks</span>
                                </NavLink>

                                <NavLink
                                    to="/approvals"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaClipboardCheck />
                                    <span>Approvals</span>
                                </NavLink>

                                <NavLink
                                    to="/documents"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaFileAlt />
                                    <span>Documents</span>
                                </NavLink>

                                <NavLink
                                    to="/messages"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaComments />
                                    <span>Messages</span>
                                </NavLink>

                                <NavLink
                                    to="/notifications"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaBell />
                                    <span>Notifications</span>
                                </NavLink>
                            </>
                        )}

                        {/* =====================================
                            CLIENT MENU
                        ===================================== */}

                        {isClient && (
                            <>
                                <NavLink
                                    to="/projects"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaProjectDiagram />
                                    <span>My Projects</span>
                                </NavLink>

                                <NavLink
                                    to="/tasks"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaTasks />
                                    <span>Tasks</span>
                                </NavLink>

                                <NavLink
                                    to="/approvals"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaClipboardCheck />
                                    <span>Approvals</span>
                                </NavLink>

                                <NavLink
                                    to="/documents"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaFileAlt />
                                    <span>Documents</span>
                                </NavLink>

                                <NavLink
                                    to="/messages"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaComments />
                                    <span>Contact Manager</span>
                                </NavLink>

                                <NavLink
                                    to="/notifications"
                                    className={linkClasses}
                                    onClick={closeSidebar}
                                >
                                    <FaBell />
                                    <span>Notifications</span>
                                </NavLink>
                            </>
                        )}
                    </div>
                </nav>

                {/* Footer */}
                <div className="border-t border-gray-200 px-4 py-4">
                    <p className="text-xs text-gray-400 text-center">
                        Client Management Portal
                    </p>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;