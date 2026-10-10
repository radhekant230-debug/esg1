import React, { useState, useContext } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import AdminSidebar from "./AdminSidebar";
import AdminUniversalDataModal from "./AdminUniversalDataModal";
import {
  FaBars,
  FaPlus,
  FaDatabase,
  FaShieldAlt,
  FaBell,
  FaUserCircle,
  FaArrowRight,
} from "react-icons/fa";

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Determine page title based on current path
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/admin" || path === "/admin/") return "Executive Overview";
    if (path.startsWith("/admin/clients")) return "Client Management";
    if (path.startsWith("/admin/sales")) return "Sales & Revenue Performance";
    if (path.startsWith("/admin/campaigns")) return "Advertising & Campaigns";
    if (path.startsWith("/admin/leads")) return "Leads & Enquiries Pipeline";
    if (path.startsWith("/admin/orders")) return "Orders & Reservations";
    if (path.startsWith("/admin/social")) return "Social Media Performance";
    if (path.startsWith("/admin/seo")) return "Website & SEO Analytics";
    if (path.startsWith("/admin/expenses")) return "Expenses & Agency Retainers";
    if (path.startsWith("/admin/reports")) return "Reports & Monthly Insights";
    if (path.startsWith("/admin/approvals")) return "Content Approvals Queue";
    if (path.startsWith("/admin/documents")) return "Documents & Brand Assets";
    if (path.startsWith("/admin/managers")) return "Account Managers";
    if (path.startsWith("/admin/notifications")) return "Internal Notifications";
    if (path.startsWith("/admin/settings")) return "Portal Settings";
    return "Admin Portal";
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#1A1918] flex flex-col antialiased">
      {/* Dedicated Admin Sidebar */}
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-[#161514] text-[#F5F0E8] border-b border-[#2C2A27] px-4 sm:px-6 py-3 shadow-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-stone-300 hover:text-white hover:bg-stone-800 transition"
              aria-label="Open navigation menu"
            >
              <FaBars className="text-lg" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest uppercase text-[#C5A880] font-bold">
                  ADMIN PORTAL
                </span>
                <span className="text-stone-500 text-xs">/</span>
                <span className="text-xs font-semibold text-white tracking-wide">
                  {getPageTitle()}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Data Entry Button */}
            <button
              id="btn-admin-add-data"
              onClick={() => setDataModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-[#C5A880] border border-stone-700 transition shadow-xs"
              title="Add Sales, Campaign, Lead, or Order data directly"
            >
              <FaDatabase className="text-xs" />
              + Enter Business Data
            </button>

            {/* Add New Client Button */}
            <button
              id="btn-admin-add-client"
              onClick={() => navigate("/admin/clients?action=add")}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#C5A880] hover:bg-[#B39369] text-stone-950 transition shadow-xs"
              title="Onboard New Agency Client"
            >
              <FaPlus className="text-xs" />
              + Add Client
            </button>

            {/* Admin User Chip with Gold Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-stone-800">
              <div className="w-8 h-8 rounded-full bg-stone-800 border border-amber-400/50 flex items-center justify-center text-amber-400 font-bold text-xs">
                {user?.name?.[0] || "A"}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-white leading-tight">{user?.name || "Admin"}</p>
                <span className="inline-flex items-center gap-1 text-[9px] font-mono font-black uppercase tracking-widest text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  ADMIN
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Global Universal Data Entry Modal for Admin */}
      <AdminUniversalDataModal
        isOpen={dataModalOpen}
        onClose={() => setDataModalOpen(false)}
        onSuccess={() => {
          // Trigger custom event or page reload if needed
          window.dispatchEvent(new CustomEvent("esg-admin-data-updated"));
        }}
      />
    </div>
  );
}
