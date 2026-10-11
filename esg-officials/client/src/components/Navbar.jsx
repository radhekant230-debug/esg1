import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import {
    FaUserCircle,
    FaSignOutAlt,
    FaTachometerAlt,
    FaUsers,
    FaUserTie,
} from "react-icons/fa";

const Navbar = () => {
    const { user, logout, isAdmin, isManager, isClient } =
        useContext(AuthContext);

    const navigate = useNavigate();

    const handleLogout = () => {
        const wasAdmin = isAdmin;
        const wasManager = isManager;
        logout();
        if (wasAdmin) navigate("/admin/login");
        else if (wasManager) navigate("/manager/login");
        else navigate("/client/login");
    };

    const getDashboardPath = () => {
        if (isAdmin) return "/admin/dashboard";
        if (isManager) return "/manager/dashboard";
        if (isClient) return "/client/dashboard";

        return "/client/login";
    };

    const renderRoleBadge = (role) => {
        const r = String(role || "").toLowerCase();
        if (r === "admin") {
            return (
                <span
                    id="user-role-badge"
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-widest uppercase bg-gradient-to-r from-amber-500/25 via-yellow-500/30 to-amber-600/25 text-amber-300 border border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.3)] font-mono"
                    title="Administrator Account"
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    ADMIN
                </span>
            );
        }
        if (r === "manager") {
            return (
                <span
                    id="user-role-badge"
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-purple-900/40 text-purple-300 border border-purple-700/60 font-mono shadow-sm"
                    title="Account Manager Account"
                >
                    MANAGER
                </span>
            );
        }
        if (r === "client") {
            return (
                <span
                    id="user-role-badge"
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-900/40 text-emerald-300 border border-emerald-700/60 font-mono shadow-sm"
                    title="Client Account"
                >
                    CLIENT
                </span>
            );
        }
        return (
            <span
                id="user-role-badge"
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-gray-800 text-gray-300 border border-gray-700"
            >
                {role?.toUpperCase() || "USER"}
            </span>
        );
    };

    return (
        <nav className="bg-gray-900 shadow-lg border-b border-gray-800">
            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row justify-between items-center py-4 gap-4">

                    {/* Logo & Public Link */}
                    <div className="flex items-center gap-4">
                        <Link
                            to={getDashboardPath()}
                            className="text-white text-2xl font-bold flex items-center gap-2"
                        >
                            <FaTachometerAlt />
                            Client Portal
                        </Link>
                        <Link
                            to="/"
                            className="text-xs text-gray-400 hover:text-white transition font-mono border border-gray-700 rounded px-2.5 py-1"
                            title="Visit ESG Officials Public Website"
                        >
                            &larr; ESG Officials
                        </Link>
                    </div>

                    {/* Navigation */}
                    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">

                        {user ? (
                            <>
                                {/* Non-Admin Dashboard Link */}
                                {!isAdmin && (
                                    <Link
                                        to={getDashboardPath()}
                                        className="text-gray-200 hover:text-white transition flex items-center gap-2 text-sm font-medium"
                                    >
                                        <FaTachometerAlt />
                                        Dashboard
                                    </Link>
                                )}

                                {/* Admin-Only Navigation Section */}
                                {isAdmin && (
                                    <div className="flex flex-wrap items-center gap-2 border-l border-r border-gray-800 px-3 py-1 bg-stone-950/40 rounded-lg">
                                        <span className="text-[10px] font-mono tracking-widest text-amber-400/90 uppercase font-black mr-1 hidden lg:inline">
                                            ADMIN:
                                        </span>
                                        <Link
                                            to="/admin/dashboard"
                                            className="text-stone-200 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 shadow-sm"
                                            title="Admin Control Center"
                                        >
                                            <FaTachometerAlt className="text-amber-400 text-xs" />
                                            Admin Dashboard
                                        </Link>
                                        <Link
                                            to="/clients"
                                            className="text-stone-200 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 shadow-sm"
                                            title="Client Management (Add, View, Edit, Activate/Deactivate Clients)"
                                        >
                                            <FaUsers className="text-amber-400 text-xs" />
                                            Client Management
                                        </Link>
                                        <Link
                                            to="/managers"
                                            className="text-stone-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded hover:bg-stone-800 hidden sm:flex"
                                            title="Manage Account Managers"
                                        >
                                            <FaUserTie className="text-stone-400 text-xs" />
                                            Managers
                                        </Link>
                                    </div>
                                )}

                                {/* Client Portals overview (accessible by Admin & Manager) */}
                                {(isAdmin || isManager) && (
                                    <Link
                                        to="/dashboard"
                                        className="text-amber-400 hover:text-amber-300 transition flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded bg-amber-950/40 border border-amber-800/50"
                                        title="View Client Marketing & Performance Portals"
                                    >
                                        Client Portals
                                    </Link>
                                )}

                                {/* User Information with Distinct Role Badge */}
                                <div className="flex items-center gap-2.5 text-gray-200 pl-1 sm:pl-2">
                                    <FaUserCircle className={`text-lg ${isAdmin ? "text-amber-400" : "text-gray-400"}`} />

                                    <span className="text-sm font-semibold text-white">
                                        {user.name}
                                    </span>

                                    {renderRoleBadge(user.role)}
                                </div>

                                {/* Logout */}
                                <button
                                    onClick={handleLogout}
                                    className="bg-gray-800 hover:bg-black text-gray-200 hover:text-white px-3.5 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 border border-gray-700"
                                >
                                    <FaSignOutAlt />
                                    Logout
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Login */}
                                <Link
                                    to="/login"
                                    className="text-gray-200 hover:text-white transition cursor-pointer"
                                >
                                    Login
                                </Link>

                                {/* Register */}
                                <Link
                                    to="/register"
                                    className="bg-white text-gray-900 hover:bg-gray-100 px-4 py-2 rounded-md font-semibold transition"
                                >
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;