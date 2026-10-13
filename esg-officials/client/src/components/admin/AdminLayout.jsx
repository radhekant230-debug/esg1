import React, { useState, useContext } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import AdminSidebar from "./AdminSidebar";
import AdminUniversalDataModal from "./AdminUniversalDataModal";
import {
  FaBars,
  FaPlus,
  FaShieldAlt,
  FaDatabase,
  FaBell,
  FaCalendarAlt,
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
    if (path === "/admin/dashboard" || path === "/admin" || path === "/admin/")
      return "Executive Dashboard";
    if (path.startsWith("/admin/risks")) return "Risk Management System";
    if (path.startsWith("/admin/calendar")) return "Calendar & Scheduling";
    if (path.startsWith("/admin/tasks")) return "Tasks & Follow-ups";
    if (path.startsWith("/admin/clients")) return "Client Management";
    if (path.startsWith("/admin/approvals")) return "Approvals Center";
    if (path.startsWith("/admin/reports")) return "Reports & Insights";
    if (path.startsWith("/admin/vault")) return "Resource Vault";
    if (path.startsWith("/admin/state-sales")) return "State-Wise Sales Ingestion";
    if (path.startsWith("/admin/sales")) return "Sales & Revenue Performance";
    if (path.startsWith("/admin/campaigns")) return "Advertising & Campaigns";
    if (path.startsWith("/admin/leads")) return "Leads & Enquiries Pipeline";
    if (path.startsWith("/admin/orders")) return "Orders & Reservations";
    if (path.startsWith("/admin/social")) return "Social Media Performance";
    if (path.startsWith("/admin/seo")) return "Website & SEO Analytics";
    if (path.startsWith("/admin/expenses")) return "Expenses & Retainers";
    if (path.startsWith("/admin/documents")) return "Documents & Brand Assets";
    if (path.startsWith("/admin/managers")) return "Account Managers";
    if (path.startsWith("/admin/notifications")) return "Notifications";
    if (path.startsWith("/admin/settings")) return "Settings";
    return "Operations Hub";
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#1A1816] flex flex-col antialiased">
      {/* Dedicated Light Cream / White Admin Sidebar */}
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex-1 flex flex-col min-w-0">
        {/* Top Header Bar with Crisp Cream & Gold Aesthetics */}
        <header className="sticky top-0 z-30 bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#E7DFD5] px-4 sm:px-6 lg:px-8 py-3.5 shadow-2xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-stone-600 hover:text-[#1A1816] hover:bg-[#F3EFE8] transition"
              aria-label="Open navigation menu"
            >
              <FaBars className="text-base" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest uppercase text-[#9C7A42] font-bold">
                  WORKSPACE
                </span>
                <span className="text-stone-300 text-xs">/</span>
                <span className="text-xs sm:text-sm font-serif font-bold text-[#1A1816] tracking-tight">
                  {getPageTitle()}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Action: Log Risk */}
            <Link
              to="/admin/risks?action=new"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#F5F0E6] hover:bg-[#EDE5D8] text-[#8C6D37] border border-[#DDD3C3] transition shadow-2xs"
              title="Log New Risk"
            >
              <FaShieldAlt className="text-xs" />
              + Log Risk
            </Link>

            {/* Quick Action: Schedule Event */}
            <Link
              to="/admin/calendar?action=schedule"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FFFFFF] hover:bg-[#F7F3EB] text-stone-700 border border-[#E7DFD5] transition shadow-2xs"
              title="Schedule Calendar Event"
            >
              <FaCalendarAlt className="text-xs text-[#9C7A42]" />
              Schedule Event
            </Link>

            {/* Quick Data Entry Button */}
            <button
              id="btn-admin-add-data"
              onClick={() => setDataModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FFFFFF] hover:bg-[#F7F3EB] text-stone-700 border border-[#E7DFD5] transition shadow-2xs"
              title="Add Business Performance Data"
            >
              <FaDatabase className="text-xs text-[#9C7A42]" />
              Enter Data
            </button>

            {/* Add New Client Button */}
            <button
              id="btn-admin-add-client"
              onClick={() => navigate("/admin/clients?action=add")}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#9C7A42] hover:bg-[#856734] text-white transition shadow-xs"
              title="Onboard New Agency Client"
            >
              <FaPlus className="text-xs" />
              <span className="hidden sm:inline">Add Client</span>
              <span className="sm:hidden">Client</span>
            </button>

            {/* Admin User Chip */}
            <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-[#E7DFD5]">
              <div className="w-8 h-8 rounded-full bg-[#F3EFE8] border border-[#D5C9B8] flex items-center justify-center text-[#8C6D37] font-serif font-bold text-xs shrink-0">
                {user?.name?.[0] || "A"}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-[#1A1816] leading-tight">
                  {user?.name || "Administrator"}
                </p>
                <span className="text-[9.5px] font-mono text-[#8C6D37] font-semibold">
                  Executive Suite
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

      {/* Universal Data Entry Modal (preserved for existing business functionality) */}
      <AdminUniversalDataModal
        isOpen={dataModalOpen}
        onClose={() => setDataModalOpen(false)}
      />
    </div>
  );
}
