import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import {
  FaUserCircle,
  FaSignOutAlt,
  FaHeadset,
  FaExternalLinkAlt,
  FaShieldAlt,
} from "react-icons/fa";

export default function ClientPortalLayout({ children }) {
  const { user, logout, isAdmin, isManager } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#1A1918] flex flex-col antialiased">
      {/* Client Portal Header */}
      <header className="sticky top-0 z-30 bg-[#161514] text-[#F5F0E8] border-b border-[#2C2A27] px-4 sm:px-6 lg:px-8 py-3.5 shadow-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/client/dashboard" className="flex items-center gap-2.5 group">
            <svg
              className="w-5 h-5 text-[#C5A880]"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect x="3.5" y="3.5" width="17" height="17" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M12 4 L12 20 M4 12 L20 12" stroke="currentColor" strokeWidth="0.9" />
              <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-white text-base tracking-tight">
                ESG Officials
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-800">
                CLIENT PORTAL
              </span>
            </div>
          </Link>
        </div>

        {/* User Details & Exit */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Admin Switcher Shortcut (if admin is previewing client portal) */}
          {isAdmin && (
            <Link
              to="/admin/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 transition"
              title="Return to Admin Portal"
            >
              <FaShieldAlt className="text-xs" />
              Return to Admin Portal
            </Link>
          )}

          {/* Client Identity Chip */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-300 font-bold text-xs shrink-0">
              {user?.name?.[0] || "C"}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-white leading-tight">
                {user?.companyName || user?.name || "Client"}
              </p>
              <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold tracking-wider uppercase text-emerald-400">
                {user?.role?.toUpperCase() || "CLIENT"}
              </span>
            </div>
          </div>

          <div className="h-5 w-px bg-stone-800 hidden sm:block" />

          {/* Return to Public Website */}
          <Link
            to="/"
            className="text-stone-400 hover:text-white text-xs font-mono transition hidden md:inline"
            title="Public Website"
          >
            Website
          </Link>

          {/* Logout */}
          <button
            onClick={() => {
              logout();
              navigate("/client/login");
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-300 hover:text-white hover:bg-stone-800 border border-stone-700/60 transition flex items-center gap-1.5"
            title="Log Out"
          >
            <FaSignOutAlt className="text-xs" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
        {children}
      </main>

      {/* Client Portal Footer */}
      <footer className="border-t border-stone-200 bg-white py-4 px-6 text-center text-xs text-stone-500 font-mono">
        ESG Officials Brand Strategy &amp; Client Growth Advisory • Client Portal Protected Environment
      </footer>
    </div>
  );
}
