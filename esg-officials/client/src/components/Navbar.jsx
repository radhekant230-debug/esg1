import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import {
    FaUserCircle,
    FaSignOutAlt,
    FaTachometerAlt,
} from "react-icons/fa";

const Navbar = () => {
    const { user, logout, isAdmin, isManager, isClient } =
        useContext(AuthContext);

    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const getDashboardPath = () => {
        if (isAdmin) return "/admin";
        if (isManager) return "/manager";
        if (isClient) return "/dashboard";

        return "/login";
    };

    return (
        <nav className="bg-gray-900 shadow-lg">
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
                    <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">

                        {user ? (
                            <>
                                {/* Dashboard */}
                                <Link
                                    to={getDashboardPath()}
                                    className="text-gray-200 hover:text-white transition flex items-center gap-2"
                                >
                                    <FaTachometerAlt />
                                    Dashboard
                                </Link>

                                {isAdmin && (
                                    <Link
                                        to="/clients"
                                        className="text-stone-200 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded bg-stone-800 border border-stone-700 shadow-sm"
                                        title="Manage Agency Clients & Accounts"
                                    >
                                        Client Management
                                    </Link>
                                )}

                                {(isAdmin || isManager) && (
                                    <Link
                                        to="/dashboard"
                                        className="text-amber-400 hover:text-amber-300 transition flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded bg-amber-950/40 border border-amber-800/50"
                                        title="View Client Marketing & Performance Portals"
                                    >
                                        Client Portals
                                    </Link>
                                )}

                                {/* User Information */}
                                <div className="flex items-center gap-2 text-gray-200">
                                    <FaUserCircle className="text-lg" />

                                    <span className="text-sm font-medium">
                                        {user.name}
                                    </span>

                                    <span className="text-xs bg-gray-700 px-2 py-1 rounded-md capitalize">
                                        {user.role}
                                    </span>
                                </div>

                                {/* Logout */}
                                <button
                                    onClick={handleLogout}
                                    className="bg-gray-700 hover:bg-black text-white px-4 py-2 rounded-md transition flex items-center gap-2"
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