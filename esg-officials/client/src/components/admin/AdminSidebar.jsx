import React, { useContext } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import {
  FaTachometerAlt,
  FaUsers,
  FaDollarSign,
  FaBullhorn,
  FaUserFriends,
  FaCalendarCheck,
  FaShareAlt,
  FaChartLine,
  FaFileInvoiceDollar,
  FaFileAlt,
  FaCheckCircle,
  FaFolder,
  FaUserTie,
  FaBell,
  FaCog,
  FaSignOutAlt,
  FaTimes,
  FaExternalLinkAlt,
  FaShieldAlt,
} from "react-icons/fa";

export default function AdminSidebar({ isOpen, onClose }) {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const navSections = [
    {
      title: "EXECUTIVE",
      items: [
        { label: "1. Operations Hub", to: "/admin/dashboard", icon: FaTachometerAlt },
        { label: "2. Overview & Analytics", to: "/admin/overview", icon: FaChartLine },
        { label: "3. Client Management", to: "/admin/clients", icon: FaUsers },
      ],
    },
    {
      title: "BUSINESS PERFORMANCE",
      items: [
        { label: "State-Wise Sales & Excel", to: "/admin/state-sales", icon: FaChartLine },
        { label: "3. Sales & Revenue", to: "/admin/sales", icon: FaDollarSign },
        { label: "4. Advertising & Campaigns", to: "/admin/campaigns", icon: FaBullhorn },
        { label: "5. Leads & Enquiries", to: "/admin/leads", icon: FaUserFriends },
        { label: "6. Orders & Reservations", to: "/admin/orders", icon: FaCalendarCheck },
        { label: "7. Social Media Performance", to: "/admin/social", icon: FaShareAlt },
        { label: "8. Website & SEO Analytics", to: "/admin/seo", icon: FaChartLine },
      ],
    },
    {
      title: "AGENCY MANAGEMENT",
      items: [
        { label: "9. Expenses & Retainers", to: "/admin/expenses", icon: FaFileInvoiceDollar },
        { label: "10. Reports & Insights", to: "/admin/reports", icon: FaFileAlt },
        { label: "11. Content Approvals", to: "/admin/approvals", icon: FaCheckCircle },
        { label: "12. Documents & Brand Assets", to: "/admin/documents", icon: FaFolder },
        { label: "13. Account Managers", to: "/admin/managers", icon: FaUserTie },
      ],
    },
    {
      title: "SYSTEM",
      items: [
        { label: "14. Notifications", to: "/admin/notifications", icon: FaBell },
        { label: "15. Settings", to: "/admin/settings", icon: FaCog },
      ],
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-[#141312] text-[#E8E2D8] border-r border-[#2C2A27] flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-[#2C2A27] flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-[#C5A880]/15 border border-[#C5A880]/40 flex items-center justify-center text-[#C5A880] shadow-sm">
              <FaShieldAlt className="text-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-white text-base tracking-tight">
                  ESG Officials
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-widest bg-amber-400/20 text-amber-300 border border-amber-400/50">
                  ADMIN
                </span>
              </div>
              <p className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">
                Executive Control Hub
              </p>
            </div>
          </Link>

          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
              aria-label="Close sidebar"
            >
              <FaTimes />
            </button>
          )}
        </div>

        {/* User Card */}
        <div className="px-5 py-3.5 bg-[#1C1B19] border-b border-[#2C2A27] flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-stone-800 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs shrink-0">
              {user?.name?.[0] || "A"}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">{user?.name || "Administrator"}</p>
              <p className="text-[10px] font-mono text-stone-400 truncate">{user?.email}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            ADMIN
          </span>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar">
          {navSections.map((section, idx) => (
            <div key={idx}>
              <p className="px-3 mb-1.5 text-[10px] font-mono tracking-widest uppercase text-stone-500 font-bold">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item, itemIdx) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={itemIdx}
                      to={item.to}
                      end={item.end}
                      onClick={() => onClose && onClose()}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                          isActive
                            ? "bg-[#C5A880] text-[#141312] font-bold shadow-sm"
                            : "text-[#C9C3B8] hover:text-white hover:bg-stone-800/70"
                        }`
                      }
                    >
                      <Icon className="text-sm shrink-0 opacity-90" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-[#2C2A27] bg-[#141312] space-y-1">
          <Link
            to="/client/dashboard"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-stone-400 hover:text-white hover:bg-stone-800/60 transition"
            title="Preview Client Portal"
          >
            <span className="flex items-center gap-2">
              <FaExternalLinkAlt className="text-xs" />
              Client Portal View
            </span>
            <span className="text-[10px] font-mono bg-stone-800 px-1.5 py-0.5 rounded text-stone-300">
              /client/dashboard
            </span>
          </Link>

          <Link
            to="/"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-stone-400 hover:text-white hover:bg-stone-800/60 transition"
            title="Return to Public Homepage"
          >
            <span>ESG Public Website</span>
            <span className="text-[10px] font-mono bg-stone-800 px-1.5 py-0.5 rounded text-stone-300">
              /
            </span>
          </Link>

          <button
            onClick={() => {
              logout();
              navigate("/admin/login");
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/30 transition text-left"
          >
            <FaSignOutAlt />
            Log Out of Admin
          </button>
        </div>
      </aside>
    </>
  );
}
