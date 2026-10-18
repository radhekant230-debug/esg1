import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../utils/axios";
import { useNavigate, useSearchParams } from "react-router-dom";

// Icons
import {
  FaChartPie,
  FaChartLine,
  FaDollarSign,
  FaBullhorn,
  FaShareAlt,
  FaMapMarkerAlt,
  FaUserFriends,
  FaCalendarCheck,
  FaTasks,
  FaFileAlt,
  FaFolder,
  FaFileInvoiceDollar,
  FaCog,
  FaUserTie,
  FaPhoneAlt,
  FaEnvelope,
  FaClock,
  FaCheckCircle,
  FaPlus,
  FaExchangeAlt,
  FaExternalLinkAlt,
  FaDownload,
  FaShieldAlt,
  FaCalendarAlt,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";

// Tab Components
import ExecutiveOverviewTab from "../components/portal/ExecutiveOverviewTab";
import SalesPerformanceTab from "../components/portal/SalesPerformanceTab";
import ClientMonthlySales from "../components/portal/ClientMonthlySales";
import AdvertisingTab from "../components/portal/AdvertisingTab";
import SocialMediaTab from "../components/portal/SocialMediaTab";
import LocalMarketingTab from "../components/portal/LocalMarketingTab";
import LeadsPipelineTab from "../components/portal/LeadsPipelineTab";
import ContentApprovalsTab from "../components/portal/ContentApprovalsTab";
import WorkInProgressTab from "../components/portal/WorkInProgressTab";
import ReportsInsightsTab from "../components/portal/ReportsInsightsTab";
import ResourceVaultTab from "../components/portal/ResourceVaultTab";
import CommercialsInvoicesTab from "../components/portal/CommercialsInvoicesTab";
import ClientProfileSettingsTab from "../components/portal/ClientProfileSettingsTab";
import PortalAdminDataEntryModal from "../components/portal/PortalAdminDataEntryModal";
import RiskMitigationTab from "../components/portal/RiskMitigationTab";
import ClientScheduleTab from "../components/planner/ClientScheduleTab";
import usePortalSync from "../hooks/usePortalSync";

export default function ClientDashboard() {
  const { user, isAdmin, isManager } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab state
  const currentTab = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(currentTab);

  // Client Selector (Admin & Manager)
  const [clientsList, setClientsList] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(searchParams.get("clientId") || "");

  // Portal Data States
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [clientUser, setClientUser] = useState(null);
  const [overviewData, setOverviewData] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [salesRefreshKey, setSalesRefreshKey] = useState(0);
  const [campaignData, setCampaignData] = useState(null);
  const [socialData, setSocialData] = useState(null);
  const [gbpData, setGbpData] = useState(null);
  const [leadsData, setLeadsData] = useState(null);
  const [contentData, setContentData] = useState(null);
  const [workspaceData, setWorkspaceData] = useState(null);
  const [reportsData, setReportsData] = useState(null);
  const [vaultData, setVaultData] = useState(null);
  const [invoicesData, setInvoicesData] = useState(null);

  // Admin Data Entry Modal
  const [showDataModal, setShowDataModal] = useState(false);

  // Additional Modules Dropdown state
  const [showAdditionalDropdown, setShowAdditionalDropdown] = useState(false);

  // Sync tab with URL and reset main content scroll position to top
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    const params = new URLSearchParams(searchParams);
    params.set("tab", tabKey);
    setSearchParams(params, { replace: true });

    // On every tab change, reset main content scroll position to top so heading and content appear immediately
    requestAnimationFrame(() => {
      const section = document.getElementById("portal-tab-content");
      if (section) {
        const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        section.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }

      // Keep chosen tab visible in horizontally scrolled tab bar
      const btn = document.getElementById(`portal-tab-${tabKey}`);
      const bar = btn && btn.closest(".portal-tabbar");
      if (btn && bar) {
        const b = btn.getBoundingClientRect();
        const r = bar.getBoundingClientRect();
        if (b.left < r.left || b.right > r.right) {
          bar.scrollTo({ left: bar.scrollLeft + (b.left - r.left) - (r.width - b.width) / 2, behavior: "smooth" });
        }
      }
    });
  };

  // Sync tab from URL if present on load or URL changes
  useEffect(() => {
    const requested = searchParams.get("tab");
    if (requested && requested !== activeTab) {
      setActiveTab(requested);
    }
  }, [searchParams]);

  // Sync client selection
  const handleClientChange = (newClientId) => {
    setSelectedClientId(newClientId);
    const params = new URLSearchParams(searchParams);
    params.set("clientId", newClientId);
    setSearchParams(params);
  };

  useEffect(() => {
    if (!user) {
      navigate("/client/login");
      return;
    }
    // Load clients list if admin or manager
    if (isAdmin || isManager) {
      fetchClientsSelector();
    }
    fetchAllPortalData();
  }, [user, selectedClientId]);

  const fetchClientsSelector = async () => {
    try {
      const res = await api.get("/portal/clients-selector");
      const list = res.data?.clients || [];
      setClientsList(list);
      if (!selectedClientId && list.length > 0) {
        setSelectedClientId(list[0].id);
      }
    } catch (err) {
      console.error("Error fetching client selector:", err);
    }
  };

  // Refetch only the sales-driven views (no full-page spinner) after a manager upload
  const refreshSalesViews = async () => {
    const clientQuery = selectedClientId ? `?clientId=${selectedClientId}` : "";
    const [overRes, salesRes] = await Promise.allSettled([
      api.get(`/portal/overview${clientQuery}`),
      api.get(`/portal/sales${clientQuery}`),
    ]);
    if (overRes.status === "fulfilled") setOverviewData(overRes.value.data);
    if (salesRes.status === "fulfilled") setSalesData(salesRes.value.data);
    setSalesRefreshKey((k) => k + 1); // monthly analytics refetches for its selected period
  };

  const sync = usePortalSync({
    clientId: isAdmin || isManager ? selectedClientId : "",
    enabled: Boolean(user) && (!(isAdmin || isManager) || Boolean(selectedClientId)),
    onChange: refreshSalesViews,
  });

  const fetchAllPortalData = async () => {
    try {
      setLoading(true);
      const clientQuery = selectedClientId ? `?clientId=${selectedClientId}` : "";

      const [
        profRes,
        overRes,
        salesRes,
        campRes,
        socRes,
        gbpRes,
        leadsRes,
        contentRes,
        workRes,
        repRes,
        vaultRes,
        invRes,
      ] = await Promise.allSettled([
        api.get(`/portal/profile${clientQuery}`),
        api.get(`/portal/overview${clientQuery}`),
        api.get(`/portal/sales${clientQuery}`),
        api.get(`/portal/campaigns${clientQuery}`),
        api.get(`/portal/social${clientQuery}`),
        api.get(`/portal/google-business${clientQuery}`),
        api.get(`/portal/leads${clientQuery}`),
        api.get(`/portal/content-calendar${clientQuery}`),
        api.get(`/portal/workspace${clientQuery}`),
        api.get(`/portal/reports${clientQuery}`),
        api.get(`/portal/vault${clientQuery}`),
        api.get(`/portal/invoices${clientQuery}`),
      ]);

      if (profRes.status === "fulfilled") {
        setProfileData(profRes.value.data?.profile);
        setClientUser(profRes.value.data?.clientUser);
      }
      if (overRes.status === "fulfilled") setOverviewData(overRes.value.data);
      if (salesRes.status === "fulfilled") setSalesData(salesRes.value.data);
      if (campRes.status === "fulfilled") setCampaignData(campRes.value.data);
      if (socRes.status === "fulfilled") setSocialData(socRes.value.data);
      if (gbpRes.status === "fulfilled") setGbpData(gbpRes.value.data);
      if (leadsRes.status === "fulfilled") setLeadsData(leadsRes.value.data);
      if (contentRes.status === "fulfilled") setContentData(contentRes.value.data);
      if (workRes.status === "fulfilled") setWorkspaceData(workRes.value.data);
      if (repRes.status === "fulfilled") setReportsData(repRes.value.data);
      if (vaultRes.status === "fulfilled") setVaultData(vaultRes.value.data);
      if (invRes.status === "fulfilled") setInvoicesData(invRes.value.data);
    } catch (err) {
      console.error("Error loading portal:", err);
    } finally {
      setLoading(false);
    }
  };

  const businessType = profileData?.businessType || "other";
  const purchasedServices = profileData?.servicesPurchased || [
    "overview",
    "sales",
    "advertising",
    "social",
    "google_business",
    "leads",
    "content_calendar",
    "workspace",
    "reports",
    "vault",
    "invoices",
  ];

  // 8 Main sequential sections requested
  const mainSections = [
    { id: "overview", label: "Executive Overview", icon: FaChartPie, serviceKey: "overview" },
    { id: "analytics", label: "Monthly Analytics", icon: FaChartLine, serviceKey: "analytics" },
    { id: "sales", label: "Sales & Revenue", icon: FaDollarSign, serviceKey: "sales" },
    { id: "advertising", label: "Advertising", icon: FaBullhorn, serviceKey: "advertising" },
    { id: "google_business", label: "Local Marketing", icon: FaMapMarkerAlt, serviceKey: "google_business" },
    { id: "leads", label: "Leads & Enquiries", icon: FaUserFriends, serviceKey: "leads" },
    {
      id: "content_calendar",
      label: "Content Approvals",
      icon: FaCalendarCheck,
      serviceKey: "content_calendar",
      badge: contentData?.counts?.pendingApproval || 0,
    },
    { id: "schedule", label: "Schedule & Calendar", icon: FaCalendarAlt, serviceKey: "schedule" },
  ];

  // Additional sections for the collapsible section
  const additionalSections = [
    { id: "social", label: "Social Media", icon: FaShareAlt, serviceKey: "social" },
    { id: "workspace", label: "Work in Progress", icon: FaTasks, serviceKey: "workspace" },
    { id: "reports", label: "Reports & Insights", icon: FaFileAlt, serviceKey: "reports" },
    { id: "vault", label: "Brand Vault", icon: FaFolder, serviceKey: "vault" },
    { id: "invoices", label: "Commercials & Invoices", icon: FaFileInvoiceDollar, serviceKey: "invoices" },
    { id: "risks", label: "Risk & Mitigation Approvals", icon: FaShieldAlt, serviceKey: "risks" },
    { id: "settings", label: "Profile & Settings", icon: FaCog, serviceKey: "settings" },
  ];

  // Filter additional sections by purchased services (Admin and Manager see all)
  const visibleAdditionalSections = (isAdmin || isManager)
    ? additionalSections
    : additionalSections.filter(
        (t) =>
          t.id === "settings" ||
          t.id === "risks" ||
          purchasedServices.includes(t.serviceKey) ||
          purchasedServices.includes(t.id)
      );

  const getBusinessTypeBadge = (type) => {
    switch (type) {
      case "cafe_restaurant":
        return "Café & Restaurant";
      case "clothing_fashion":
        return "Clothing & Fashion";
      case "jewellery":
        return "Fine Jewellery & Luxury";
      case "retail_service":
        return "Retail & Services";
      default:
        return "Commercial Enterprise";
    }
  };

  if (loading && !profileData) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center py-20 bg-[#F9F8F5]">
        <div className="w-10 h-10 border-3 border-[#9C7A42]/30 border-t-[#9C7A42] rounded-full animate-spin mb-4"></div>
        <p className="font-serif text-stone-700 text-sm font-semibold tracking-wide">
          Loading ESG Officials Client Portal...
        </p>
      </div>
    );
  }

  const activeClientName = profileData?.businessName || clientUser?.companyName || clientUser?.name || "Client Portal";

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* =========================================================
          1. AGENCY TEAM TOP CONTROLS (ADMIN & MANAGER ONLY)
      ========================================================= */}
      {(isAdmin || isManager) && (
        <div className="bg-[#1A1A1A] text-white p-3.5 sm:p-4 rounded-xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#9C7A42] animate-pulse"></span>
            <span className="text-xs font-mono font-semibold text-[#D4AF37] uppercase tracking-wider">
              {isAdmin ? "Agency Administrator Workspace" : "Account Manager Console"}
            </span>
            <span className="text-stone-400 text-xs hidden md:inline">• Client Scope Selector</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-300">Client:</span>
              <select
                value={selectedClientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="bg-stone-800 text-white text-xs font-medium py-1.5 px-3 rounded-lg border border-stone-700 focus:outline-hidden focus:border-[#9C7A42] cursor-pointer"
              >
                {clientsList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName} ({c.name})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowDataModal(true)}
              className="inline-flex items-center gap-1.5 bg-[#9C7A42] hover:bg-[#856734] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-sm cursor-pointer"
            >
              <FaPlus className="w-2.5 h-2.5" /> Enter / Import Data
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          2. CLIENT IDENTITY & EXECUTIVE BANNER
      ========================================================= */}
      <div className="bg-[#FAF7F2] border border-[#E7DFD5] rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Client Logo, Business Name & Identity */}
          <div className="flex items-start sm:items-center gap-4 sm:gap-5">
            {profileData?.logo ? (
              <img
                src={profileData.logo}
                alt={activeClientName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-[#E0D8CE] shadow-xs shrink-0"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border border-[#E0D8CE] flex items-center justify-center font-serif text-2xl font-bold text-[#9C7A42] shrink-0 shadow-xs">
                {activeClientName.charAt(0)}
              </div>
            )}

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-white border border-[#E0D8CE] text-stone-700 font-mono">
                  Client ID: {clientUser?.clientId || "CLI-2026-0001"}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#9C7A42]/10 text-[#9C7A42] border border-[#9C7A42]/20 font-mono">
                  {getBusinessTypeBadge(businessType)}
                </span>
              </div>

              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                {activeClientName}
              </h1>

              <p className="text-xs sm:text-sm text-stone-600 font-serif italic max-w-xl">
                {profileData?.tagline || "Marketing, Advertising & Business Growth"}
              </p>
            </div>
          </div>

          {/* Right: Account Manager Card & Reporting Period */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            {/* Account Manager Box */}
            <div className="bg-white border border-[#E0D8CE] rounded-xl p-4 shadow-2xs min-w-[240px]">
              <div className="flex items-center gap-2 text-[10px] font-mono text-[#9C7A42] uppercase font-bold mb-1">
                <FaUserTie className="w-3 h-3" /> Dedicated Account Manager
              </div>
              <div className="font-semibold text-xs text-stone-900">
                {profileData?.accountManagerDetails?.name || "Rahul Sharma"}
              </div>
              <div className="text-[11px] text-stone-500 mb-2">
                {profileData?.accountManagerDetails?.role || "Senior Growth Lead"}
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-[#F0EBE3] text-[11px] text-stone-600">
                <a
                  href={`mailto:${profileData?.accountManagerDetails?.email || "rahul.manager@esgofficial.com"}`}
                  className="hover:text-stone-900 flex items-center gap-1"
                >
                  <FaEnvelope className="w-2.5 h-2.5 text-[#9C7A42]" /> Email
                </a>
                <span>•</span>
                <a
                  href={`tel:${profileData?.accountManagerDetails?.phone || "+919876543210"}`}
                  className="hover:text-stone-900 flex items-center gap-1"
                >
                  <FaPhoneAlt className="w-2.5 h-2.5 text-[#9C7A42]" /> Call
                </a>
              </div>
            </div>

            {/* Reporting Period & Status */}
            <div className="bg-white border border-[#E0D8CE] rounded-xl p-4 shadow-2xs flex flex-col justify-between min-w-[200px]">
              <div>
                <span className="text-[10px] font-mono text-stone-400 uppercase font-bold block mb-1">
                  Active Cycle
                </span>
                <div className="font-bold text-xs text-stone-900 font-mono">
                  01 Oct 2026 - 31 Oct 2026
                </div>
              </div>

              <div className="pt-2 border-t border-[#F0EBE3] mt-2 flex items-center justify-between text-[11px] text-stone-500 font-mono">
                <span>Updated:</span>
                <span className="text-emerald-700 font-sans font-semibold">Today</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          3. PORTAL NAVIGATION TABS
      ========================================================= */}
      <div className="portal-tabbar sticky z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 bg-[#FBF9F5]/95 backdrop-blur supports-[backdrop-filter]:bg-[#FBF9F5]/85 border-b border-[#E7DFD5] overflow-x-auto overscroll-x-contain portal-scroll-x">
        <nav aria-label="Client portal sections" className="flex items-center space-x-1 sm:space-x-2 py-1.5 min-w-max">
          {mainSections.map((section, idx) => {
            const Icon = section.icon;
            const isActive = activeTab === section.id;

            return (
              <button
                key={section.id}
                id={`portal-tab-${section.id}`}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => handleTabChange(section.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                  isActive
                    ? "bg-[#1A1A1A] text-white shadow-xs font-semibold"
                    : "text-stone-600 hover:text-stone-900 hover:bg-white/80"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#D4AF37]" : "text-stone-400"}`} />
                <span>
                  <span className="font-mono text-[10px] opacity-60 mr-1">{idx + 1}.</span>
                  {section.label}
                </span>
                {section.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black">
                    {section.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="h-4 w-px bg-stone-300 mx-1 shrink-0" />

          {/* More Modules Dropdown */}
          <div className="relative shrink-0">
            <button
              id="portal-tab-additional"
              type="button"
              onClick={() => setShowAdditionalDropdown(!showAdditionalDropdown)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 border ${
                visibleAdditionalSections.some((s) => s.id === activeTab)
                  ? "bg-[#1A1A1A] text-white border-transparent font-semibold shadow-xs"
                  : "border-stone-300/80 text-stone-600 hover:text-stone-900 hover:bg-white"
              }`}
              title="View additional client modules & settings"
            >
              <FaCog className={`w-3.5 h-3.5 ${visibleAdditionalSections.some((s) => s.id === activeTab) ? "text-[#D4AF37]" : "text-stone-500"}`} />
              <span>
                {visibleAdditionalSections.find((s) => s.id === activeTab)?.label || "More Modules"}
              </span>
              <FaChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>

            {showAdditionalDropdown && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-[#E7DFD5] rounded-xl shadow-lg z-30 py-1.5 animate-fadeIn">
                {visibleAdditionalSections.map((t) => {
                  const Icon = t.icon;
                  const isCur = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setShowAdditionalDropdown(false);
                        handleTabChange(t.id);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left transition cursor-pointer ${
                        isCur ? "bg-stone-100 text-stone-900 font-bold" : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 text-stone-500" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* =========================================================
          4. TAB VIEW CONTENT (SINGLE SELECTED SECTION ONLY)
      ========================================================= */}
      <div id="portal-tab-content" className="pt-2 portal-tab-content">
        {/* Real-time Sales Notice */}
        {sync.updatedNotice && (
          <div role="status" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-xs">
            <span>
              <strong>New sales data from your account manager.</strong> Your dashboard was refreshed automatically
              {sync.lastUpdatedLabel ? ` (last update ${sync.lastUpdatedLabel})` : ""}.
            </span>
            <button type="button" onClick={sync.dismiss} className="text-emerald-800 hover:text-emerald-950 font-bold cursor-pointer" aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        {/* 1. Executive Overview */}
        {activeTab === "overview" && (
          <div id="section-overview" className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7DFD5]">
              <div className="w-7 h-7 rounded-lg bg-[#9C7A42]/10 border border-[#9C7A42]/20 flex items-center justify-center text-[#9C7A42] shrink-0">
                <FaChartPie className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                1. Executive Overview
              </h2>
            </div>
            <ExecutiveOverviewTab
              data={overviewData}
              businessType={businessType}
              onNavigateTab={handleTabChange}
            />
          </div>
        )}

        {/* 2. Monthly Analytics */}
        {activeTab === "analytics" && (
          <div id="section-analytics" className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7DFD5]">
              <div className="w-7 h-7 rounded-lg bg-[#9C7A42]/10 border border-[#9C7A42]/20 flex items-center justify-center text-[#9C7A42] shrink-0">
                <FaChartLine className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                2. Monthly Analytics
              </h2>
            </div>
            <ClientMonthlySales clientId={isAdmin || isManager ? selectedClientId : ""} refreshKey={salesRefreshKey} />
          </div>
        )}

        {/* 3. Sales & Revenue */}
        {activeTab === "sales" && (
          <div id="section-sales" className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7DFD5]">
              <div className="w-7 h-7 rounded-lg bg-[#9C7A42]/10 border border-[#9C7A42]/20 flex items-center justify-center text-[#9C7A42] shrink-0">
                <FaDollarSign className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                3. Sales & Revenue
              </h2>
            </div>
            <SalesPerformanceTab
              salesData={salesData}
              businessType={businessType}
              onOpenAnalytics={() => handleTabChange("analytics")}
            />
          </div>
        )}

        {/* 4. Advertising */}
        {activeTab === "advertising" && (
          <div id="section-advertising" className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7DFD5]">
              <div className="w-7 h-7 rounded-lg bg-[#9C7A42]/10 border border-[#9C7A42]/20 flex items-center justify-center text-[#9C7A42] shrink-0">
                <FaBullhorn className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                4. Advertising
              </h2>
            </div>
            <AdvertisingTab campaignData={campaignData} />
          </div>
        )}

        {/* 5. Local Marketing */}
        {activeTab === "google_business" && (
          <div id="section-google_business" className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7DFD5]">
              <div className="w-7 h-7 rounded-lg bg-[#9C7A42]/10 border border-[#9C7A42]/20 flex items-center justify-center text-[#9C7A42] shrink-0">
                <FaMapMarkerAlt className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                5. Local Marketing
              </h2>
            </div>
            <LocalMarketingTab gbpData={gbpData} />
          </div>
        )}

        {/* 6. Leads & Enquiries */}
        {activeTab === "leads" && (
          <div id="section-leads" className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7DFD5]">
              <div className="w-7 h-7 rounded-lg bg-[#9C7A42]/10 border border-[#9C7A42]/20 flex items-center justify-center text-[#9C7A42] shrink-0">
                <FaUserFriends className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                6. Leads & Enquiries
              </h2>
            </div>
            <LeadsPipelineTab leadsData={leadsData} onRefresh={fetchAllPortalData} />
          </div>
        )}

        {/* 7. Content Approvals */}
        {activeTab === "content_calendar" && (
          <div id="section-content_calendar" className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E7DFD5]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#9C7A42]/10 border border-[#9C7A42]/20 flex items-center justify-center text-[#9C7A42] shrink-0">
                  <FaCalendarCheck className="w-3.5 h-3.5" />
                </div>
                <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                  7. Content Approvals
                </h2>
              </div>
              {contentData?.counts?.pendingApproval > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-black">
                  {contentData.counts.pendingApproval} Pending Review
                </span>
              )}
            </div>
            <ContentApprovalsTab contentData={contentData} onRefresh={fetchAllPortalData} />
          </div>
        )}

        {/* 8. Schedule & Calendar */}
        {activeTab === "schedule" && (
          <div id="section-schedule" className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7DFD5]">
              <div className="w-7 h-7 rounded-lg bg-[#9C7A42]/10 border border-[#9C7A42]/20 flex items-center justify-center text-[#9C7A42] shrink-0">
                <FaCalendarAlt className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                8. Schedule & Calendar
              </h2>
            </div>
            <ClientScheduleTab clientId={isAdmin || isManager ? selectedClientId || clientUser?._id : ""} />
          </div>
        )}

        {/* Additional Modules */}
        {activeTab === "social" && (
          <div id="section-social" className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7DFD5]">
              <div className="w-7 h-7 rounded-lg bg-[#9C7A42]/10 border border-[#9C7A42]/20 flex items-center justify-center text-[#9C7A42] shrink-0">
                <FaShareAlt className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                Social Media Performance
              </h2>
            </div>
            <SocialMediaTab socialData={socialData} />
          </div>
        )}

        {activeTab === "workspace" && (
          <div id="section-workspace" className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7DFD5]">
              <div className="w-7 h-7 rounded-lg bg-[#9C7A42]/10 border border-[#9C7A42]/20 flex items-center justify-center text-[#9C7A42] shrink-0">
                <FaTasks className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                Work in Progress
              </h2>
            </div>
            <WorkInProgressTab workspaceData={workspaceData} />
          </div>
        )}

        {activeTab === "reports" && (
          <div id="section-reports" className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7DFD5]">
              <div className="w-7 h-7 rounded-lg bg-[#9C7A42]/10 border border-[#9C7A42]/20 flex items-center justify-center text-[#9C7A42] shrink-0">
                <FaFileAlt className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                Reports & Insights
              </h2>
            </div>
            <ReportsInsightsTab reportsData={reportsData} />
          </div>
        )}

        {activeTab === "vault" && (
          <div id="section-vault" className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7DFD5]">
              <div className="w-7 h-7 rounded-lg bg-[#9C7A42]/10 border border-[#9C7A42]/20 flex items-center justify-center text-[#9C7A42] shrink-0">
                <FaFolder className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                Brand Vault
              </h2>
            </div>
            <ResourceVaultTab vaultData={vaultData} />
          </div>
        )}

        {activeTab === "invoices" && (
          <div id="section-invoices" className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7DFD5]">
              <div className="w-7 h-7 rounded-lg bg-[#9C7A42]/10 border border-[#9C7A42]/20 flex items-center justify-center text-[#9C7A42] shrink-0">
                <FaFileInvoiceDollar className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                Commercials & Invoices
              </h2>
            </div>
            <CommercialsInvoicesTab invoicesData={invoicesData} />
          </div>
        )}

        {activeTab === "risks" && (
          <div id="section-risks" className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7DFD5]">
              <div className="w-7 h-7 rounded-lg bg-[#9C7A42]/10 border border-[#9C7A42]/20 flex items-center justify-center text-[#9C7A42] shrink-0">
                <FaShieldAlt className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                Risk & Mitigation Approvals
              </h2>
            </div>
            <RiskMitigationTab clientId={selectedClientId || clientUser?._id} />
          </div>
        )}

        {activeTab === "settings" && (
          <div id="section-settings" className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7DFD5]">
              <div className="w-7 h-7 rounded-lg bg-[#9C7A42]/10 border border-[#9C7A42]/20 flex items-center justify-center text-[#9C7A42] shrink-0">
                <FaCog className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                Profile & Settings
              </h2>
            </div>
            <ClientProfileSettingsTab
              profile={profileData}
              clientUser={clientUser}
              onRefresh={fetchAllPortalData}
            />
          </div>
        )}
      </div>

      {/* Admin / Manager Data Entry Modal */}
      {showDataModal && (
        <PortalAdminDataEntryModal
          clientId={selectedClientId || clientUser?._id}
          clientName={activeClientName}
          onClose={() => setShowDataModal(false)}
          onRefresh={fetchAllPortalData}
        />
      )}
    </div>
  );
}