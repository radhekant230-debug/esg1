import React, { useEffect, useState, useContext } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import api from "../utils/axios";
import {
  FaSearch,
  FaPlus,
  FaUserCircle,
  FaEdit,
  FaTrash,
  FaPowerOff,
  FaKey,
  FaTimes,
  FaExternalLinkAlt,
  FaBuilding,
  FaPhone,
  FaEnvelope,
  FaGlobe,
  FaMapMarkerAlt,
  FaUserTie,
  FaCheckCircle,
  FaCopy,
  FaEye,
  FaEyeSlash,
  FaFilter,
  FaSyncAlt,
  FaBriefcase,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaCheck,
  FaChevronRight,
  FaStore,
  FaUtensils,
  FaTshirt,
  FaGem,
} from "react-icons/fa";

const ALL_SERVICES = [
  "Brand Strategy",
  "Content",
  "Social Media",
  "Google Business Profile",
  "Performance Marketing",
  "Lead Generation",
  "Reporting",
  "Other",
];

const BUSINESS_TYPE_OPTIONS = [
  { value: "cafe", label: "Café", icon: FaUtensils },
  { value: "restaurant", label: "Restaurant", icon: FaUtensils },
  { value: "clothing", label: "Clothing Shop", icon: FaTshirt },
  { value: "jewellery", label: "Jewellery Shop", icon: FaGem },
  { value: "retail_service", label: "Retail / Service", icon: FaStore },
  { value: "other", label: "Other", icon: FaBriefcase },
];

const REPORTING_PERIODS = ["Monthly", "Weekly", "Bi-weekly", "Quarterly"];

const getBusinessTypeBadge = (type) => {
  const norm = String(type || "").toLowerCase();
  if (norm.includes("cafe")) {
    return { label: "Café", bg: "bg-amber-100 text-amber-900 border-amber-300" };
  }
  if (norm.includes("restau")) {
    return { label: "Restaurant", bg: "bg-orange-100 text-orange-900 border-orange-300" };
  }
  if (norm.includes("cloth") || norm.includes("fashion")) {
    return { label: "Clothing Shop", bg: "bg-purple-100 text-purple-900 border-purple-300" };
  }
  if (norm.includes("jewel")) {
    return { label: "Jewellery Shop", bg: "bg-emerald-100 text-emerald-900 border-emerald-300" };
  }
  if (norm.includes("retail")) {
    return { label: "Retail / Service", bg: "bg-blue-100 text-blue-900 border-blue-300" };
  }
  return { label: "Other", bg: "bg-stone-100 text-stone-800 border-stone-300" };
};

const Clients = () => {
  const { user, isAdmin } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [clients, setClients] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successToast, setSuccessToast] = useState("");

  // Filters & Search
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSuccessBannerModal, setShowSuccessBannerModal] = useState(false);

  const [selectedClient, setSelectedClient] = useState(null);
  const [createdClientResult, setCreatedClientResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form states
  const initialFormState = {
    name: "",
    companyName: "",
    email: "",
    password: "",
    phone: "",
    businessType: "cafe",
    address: "",
    website: "",
    logo: "",
    assignedManager: "",
    servicesPurchased: ["Brand Strategy", "Content", "Social Media", "Reporting"],
    startDate: new Date().toISOString().split("T")[0],
    reportingPeriod: "Monthly",
    retainerAmount: "",
    isActive: true,
  };

  const [formData, setFormData] = useState(initialFormState);
  const [newPasswordValue, setNewPasswordValue] = useState("");

  // ==========================================
  // FETCH CLIENTS & MANAGERS
  // ==========================================
  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const [clientsRes, managersRes] = await Promise.all([
        api.get("/clients"),
        api.get("/clients/managers/all"),
      ]);

      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      setManagers(Array.isArray(managersRes.data) ? managersRes.data : []);
    } catch (err) {
      console.error("Fetch clients error:", err);
      setError(err.response?.data?.message || "Unable to load clients.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (searchParams.get("action") === "add") {
      setShowAddModal(true);
    }
  }, [searchParams]);

  // ==========================================
  // FILTERING LOGIC
  // ==========================================
  const filteredClients = clients.filter((client) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      client.name?.toLowerCase().includes(q) ||
      client.companyName?.toLowerCase().includes(q) ||
      client.email?.toLowerCase().includes(q) ||
      client.clientId?.toLowerCase().includes(q) ||
      client.phone?.toLowerCase().includes(q);

    const clientType = String(client.businessType || "").toLowerCase();
    const matchesType =
      typeFilter === "all" ||
      (typeFilter === "cafe" && clientType.includes("cafe")) ||
      (typeFilter === "restaurant" && clientType.includes("restaurant")) ||
      (typeFilter === "clothing" && (clientType.includes("clothing") || clientType.includes("fashion"))) ||
      (typeFilter === "jewellery" && clientType.includes("jewel")) ||
      (typeFilter === "retail_service" && clientType.includes("retail")) ||
      (typeFilter === "other" &&
        !clientType.includes("cafe") &&
        !clientType.includes("restau") &&
        !clientType.includes("cloth") &&
        !clientType.includes("jewel") &&
        !clientType.includes("retail"));

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && client.isActive) ||
      (statusFilter === "inactive" && !client.isActive);

    const matchesManager =
      managerFilter === "all" ||
      (client.assignedManager?._id === managerFilter || client.assignedManager === managerFilter);

    return matchesSearch && matchesType && matchesStatus && matchesManager;
  });

  // ==========================================
  // HELPER: GENERATE RANDOM SECURE PASSWORD
  // ==========================================
  const generateSecurePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let pass = "Esg@";
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, password: pass }));
  };

  // ==========================================
  // SERVICE TOGGLE HANDLER
  // ==========================================
  const toggleService = (service) => {
    setFormData((prev) => {
      const exists = prev.servicesPurchased.includes(service);
      return {
        ...prev,
        servicesPurchased: exists
          ? prev.servicesPurchased.filter((s) => s !== service)
          : [...prev.servicesPurchased, service],
      };
    });
  };

  // ==========================================
  // OPEN CREATE MODAL
  // ==========================================
  const handleOpenAddModal = () => {
    setError("");
    const defaultManager = managers.length > 0 ? managers[0]._id : "";
    setFormData({
      ...initialFormState,
      assignedManager: defaultManager,
      password: `Esg@${Math.floor(100000 + Math.random() * 900000)}`,
    });
    setShowAddModal(true);
  };

  useEffect(() => {
    if (searchParams.get("action") === "add" && isAdmin) {
      handleOpenAddModal();
    }
  }, [searchParams, isAdmin]);

  // ==========================================
  // SUBMIT NEW CLIENT
  // ==========================================
  const handleCreateClient = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Client contact person's name is required.");
      return;
    }
    if (!formData.companyName.trim()) {
      setError("Business name is required.");
      return;
    }
    if (!formData.email.trim()) {
      setError("Email address is required.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: formData.name.trim(),
        companyName: formData.companyName.trim(),
        email: formData.email.trim(),
        password: formData.password || undefined,
        phone: formData.phone.trim(),
        businessType: formData.businessType,
        address: formData.address.trim(),
        website: formData.website.trim(),
        logo: formData.logo.trim(),
        assignedManager: formData.assignedManager || null,
        servicesPurchased: formData.servicesPurchased,
        startDate: formData.startDate,
        reportingPeriod: formData.reportingPeriod,
        retainerAmount: Number(formData.retainerAmount) || 0,
        isActive: formData.isActive,
      };

      const res = await api.post("/clients", payload);

      setShowAddModal(false);
      setCreatedClientResult(res.data.client);
      setShowSuccessBannerModal(true);

      // Refresh list without logging out
      await fetchData();
    } catch (err) {
      console.error("Create client failed:", err);
      setError(err.response?.data?.message || "Failed to create client account.");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // OPEN EDIT MODAL
  // ==========================================
  const handleOpenEditModal = (client) => {
    setSelectedClient(client);
    setError("");

    setFormData({
      name: client.name || "",
      companyName: client.companyName || "",
      email: client.email || "",
      phone: client.phone || "",
      businessType: client.businessType || "other",
      address: client.address || "",
      website: client.website || "",
      logo: client.logo || "",
      assignedManager: client.assignedManager?._id || client.assignedManager || "",
      servicesPurchased:
        Array.isArray(client.servicesPurchased) && client.servicesPurchased.length > 0
          ? client.servicesPurchased
          : ["Brand Strategy", "Content", "Social Media", "Reporting"],
      startDate: client.serviceStartDate
        ? new Date(client.serviceStartDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      reportingPeriod: client.reportingPeriod || "Monthly",
      retainerAmount: client.retainerAmount || "",
      isActive: client.isActive !== undefined ? client.isActive : true,
    });

    setShowEditModal(true);
  };

  // ==========================================
  // SUBMIT EDIT CLIENT
  // ==========================================
  const handleUpdateClient = async (e) => {
    e.preventDefault();
    setError("");

    if (!selectedClient) return;

    try {
      setSaving(true);

      const payload = {
        name: formData.name.trim(),
        companyName: formData.companyName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        businessType: formData.businessType,
        address: formData.address.trim(),
        website: formData.website.trim(),
        logo: formData.logo.trim(),
        assignedManager: formData.assignedManager || null,
        servicesPurchased: formData.servicesPurchased,
        startDate: formData.startDate,
        reportingPeriod: formData.reportingPeriod,
        retainerAmount: Number(formData.retainerAmount) || 0,
        isActive: formData.isActive,
      };

      await api.put(`/clients/${selectedClient._id}`, payload);

      setShowEditModal(false);
      setSelectedClient(null);
      setSuccessToast("Client details updated successfully.");
      setTimeout(() => setSuccessToast(""), 4000);

      await fetchData();
    } catch (err) {
      console.error("Update client failed:", err);
      setError(err.response?.data?.message || "Failed to update client.");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // TOGGLE STATUS
  // ==========================================
  const handleToggleStatus = async (client) => {
    const action = client.isActive ? "deactivate" : "activate";
    const ok = window.confirm(
      `Are you sure you want to ${action} ${client.companyName || client.name}?`
    );
    if (!ok) return;

    try {
      await api.put(`/clients/${client._id}/toggle-status`);
      setSuccessToast(`Client access ${client.isActive ? "deactivated" : "activated"} successfully.`);
      setTimeout(() => setSuccessToast(""), 4000);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to toggle client status.");
    }
  };

  // ==========================================
  // RESET PASSWORD
  // ==========================================
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPasswordValue || newPasswordValue.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setSaving(true);
      await api.put(`/clients/${selectedClient._id}/reset-password`, {
        password: newPasswordValue,
      });

      setShowPasswordModal(false);
      setNewPasswordValue("");
      setSuccessToast(`Password reset successfully for ${selectedClient.name}.`);
      setTimeout(() => setSuccessToast(""), 4000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password.");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // DELETE CLIENT
  // ==========================================
  const handleDeleteClient = async (client) => {
    const ok = window.confirm(
      `WARNING: Permanently delete client account "${client.companyName || client.name}" (${client.clientId || client.email})? This action cannot be undone.`
    );
    if (!ok) return;

    try {
      await api.delete(`/clients/${client._id}`);
      setSuccessToast("Client account deleted.");
      setTimeout(() => setSuccessToast(""), 4000);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete client.");
    }
  };

  // Copy to clipboard helper
  const copyCredentials = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Calculate statistics
  const totalClients = clients.length;
  const activeCount = clients.filter((c) => c.isActive).length;
  const inactiveCount = totalClients - activeCount;

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#262422] p-4 sm:p-6 lg:p-8 font-sans">
      {/* ==========================================
          HEADER & KPI METRICS
      ========================================== */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-[#1A1918] text-[#F5F0E8] rounded-2xl p-6 sm:p-8 border border-[#33312E] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-mono tracking-widest uppercase text-[#C5A880] px-2.5 py-0.5 rounded bg-[#C5A880]/15 border border-[#C5A880]/30 font-black shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C5A880] animate-pulse" />
                ADMIN
              </span>
              <span className="text-xs text-stone-400 font-medium font-mono uppercase tracking-wider">Enterprise Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
              Client Management
            </h1>
            <p className="text-sm text-stone-300 mt-1 max-w-xl">
              Provision client portals, configure retainers & assigned managers, control portal access, and monitor brand portfolios.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              title="Refresh Client Data"
              className="p-3 rounded-xl bg-[#2C2A28] text-stone-300 hover:text-white border border-[#44403C] hover:bg-[#3D3A37] transition"
            >
              <FaSyncAlt className={loading ? "animate-spin" : ""} />
            </button>
            {isAdmin && (
              <button
                id="btn-add-client"
                onClick={handleOpenAddModal}
                className="px-5 py-3 rounded-xl bg-[#C5A880] hover:bg-[#B39369] text-[#1A1918] font-bold text-sm shadow-md transition flex items-center gap-2 tracking-wide font-medium"
              >
                <FaPlus />
                Add New Client
              </button>
            )}
          </div>
        </div>

        {/* ==========================================
            STATS OVERVIEW
        ========================================== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-stone-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-stone-500 font-semibold tracking-wider">Total Clients</p>
              <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A1918] mt-1">{totalClients}</h3>
              <p className="text-xs text-stone-400 mt-0.5">Portfolio brands</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center text-stone-700 text-lg border border-stone-200">
              <FaBriefcase />
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-5 border border-stone-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-stone-500 font-semibold tracking-wider">Active Access</p>
              <h3 className="text-2xl sm:text-3xl font-serif font-bold text-emerald-700 mt-1">{activeCount}</h3>
              <p className="text-xs text-stone-400 mt-0.5">Live dashboards</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 text-lg border border-emerald-100">
              <FaCheckCircle />
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-5 border border-stone-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-stone-500 font-semibold tracking-wider">Inactive Access</p>
              <h3 className="text-2xl sm:text-3xl font-serif font-bold text-stone-600 mt-1">{inactiveCount}</h3>
              <p className="text-xs text-stone-400 mt-0.5">Suspended / Draft</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center text-stone-500 text-lg border border-stone-200">
              <FaPowerOff />
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-5 border border-stone-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-stone-500 font-semibold tracking-wider">Account Managers</p>
              <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#C5A880] mt-1">{managers.length}</h3>
              <p className="text-xs text-stone-400 mt-0.5">Active team leads</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#FAF5EE] flex items-center justify-center text-[#B39369] text-lg border border-[#EADBCA]">
              <FaUserTie />
            </div>
          </div>
        </div>

        {/* NOTIFICATIONS & ALERTS */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-red-500 hover:text-red-700">
              <FaTimes />
            </button>
          </div>
        )}

        {successToast && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <FaCheckCircle className="text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* ==========================================
            SEARCH & FILTER CONTROLS
        ========================================== */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Search Bar */}
            <div className="relative flex-1 w-full">
              <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm" />
              <input
                id="input-client-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by business name, contact person, client ID (CLI-...), or email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C5A880] transition"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                >
                  <FaTimes />
                </button>
              )}
            </div>

            {/* Business Type Filter */}
            <div className="w-full md:w-48">
              <select
                id="select-type-filter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C5A880] font-medium"
              >
                <option value="all">All Business Types</option>
                <option value="cafe">Café</option>
                <option value="restaurant">Restaurant</option>
                <option value="clothing">Clothing Shop</option>
                <option value="jewellery">Jewellery Shop</option>
                <option value="retail_service">Retail / Service</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-36">
              <select
                id="select-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C5A880] font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            {/* Manager Filter */}
            <div className="w-full md:w-48">
              <select
                id="select-manager-filter"
                value={managerFilter}
                onChange={(e) => setManagerFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C5A880] font-medium"
              >
                <option value="all">All Managers</option>
                {managers.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ==========================================
            CLIENT LIST TABLE / CARDS
        ========================================== */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-24 text-center">
              <div className="inline-block w-10 h-10 border-4 border-stone-200 border-t-[#C5A880] rounded-full animate-spin" />
              <p className="text-sm text-stone-500 mt-3 font-medium">Loading agency clients...</p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="py-24 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400 text-2xl mb-4">
                <FaBriefcase />
              </div>
              <h3 className="font-serif font-bold text-lg text-stone-900">No clients match your filter criteria</h3>
              <p className="text-sm text-stone-500 mt-1 max-w-sm mx-auto">
                {search || typeFilter !== "all" || statusFilter !== "all" || managerFilter !== "all"
                  ? "Try resetting your search query or selecting a different filter option."
                  : "No clients registered yet. Click 'Add New Client' to create your first client account."}
              </p>
              {(search || typeFilter !== "all" || statusFilter !== "all" || managerFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                    setStatusFilter("all");
                    setManagerFilter("all");
                  }}
                  className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-stone-100 text-stone-700 hover:bg-stone-200 transition"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/80 border-b border-stone-200 text-[11px] font-mono uppercase text-stone-500 tracking-wider">
                    <th className="px-5 py-4">Client & Business</th>
                    <th className="px-5 py-4">Client ID</th>
                    <th className="px-5 py-4">Type</th>
                    <th className="px-5 py-4">Account Manager</th>
                    <th className="px-5 py-4">Services & Retainer</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-sm">
                  {filteredClients.map((client) => {
                    const badge = getBusinessTypeBadge(client.businessType);
                    const managerName = client.assignedManager?.name || "Unassigned";

                    return (
                      <tr key={client._id} className="hover:bg-stone-50/70 transition">
                        {/* Business & Contact Name */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-stone-900 text-amber-200 font-serif font-bold flex items-center justify-center shrink-0 border border-stone-800 shadow-sm text-sm overflow-hidden">
                              {client.logo ? (
                                <img
                                  src={client.logo}
                                  alt={client.companyName}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                  }}
                                />
                              ) : (
                                (client.companyName || client.name || "C").charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <button
                                onClick={() => navigate(`/admin/clients/${client._id}`)}
                                className="font-bold text-[#1A1918] hover:text-[#C5A880] transition text-left flex items-center gap-1.5 cursor-pointer"
                                title="Open Admin Performance Dossier"
                              >
                                {client.companyName || client.name}
                              </button>
                              <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                                <span>{client.name}</span>
                                <span>•</span>
                                <span className="font-mono text-[11px] text-stone-400">{client.email}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Client ID */}
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-stone-100 text-stone-700 border border-stone-200">
                            {client.clientId || "Pending"}
                          </span>
                        </td>

                        {/* Business Type */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                        </td>

                        {/* Assigned Account Manager */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-[10px] font-bold">
                              {managerName.charAt(0)}
                            </div>
                            <span className="text-xs font-medium text-stone-700">{managerName}</span>
                          </div>
                        </td>

                        {/* Services & Retainer */}
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-semibold text-stone-900 text-xs">
                              {client.retainerAmount
                                ? `₹${Number(client.retainerAmount).toLocaleString()} / ${client.reportingPeriod || "mo"}`
                                : "Standard Retainer"}
                            </p>
                            <p className="text-[11px] text-stone-500 mt-0.5">
                              {Array.isArray(client.servicesPurchased) && client.servicesPurchased.length > 0
                                ? `${client.servicesPurchased.length} active services`
                                : "General Growth"}
                            </p>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              client.isActive
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-stone-100 text-stone-600 border border-stone-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                client.isActive ? "bg-emerald-500" : "bg-stone-400"
                              }`}
                            />
                            {client.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Details */}
                            <button
                              onClick={() => {
                                setSelectedClient(client);
                                setShowDetailsModal(true);
                              }}
                              title="View Client Dossier"
                              className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center text-xs transition"
                            >
                              <FaEye />
                            </button>

                            {/* Open Admin Performance Detail */}
                            <button
                              onClick={() => navigate(`/admin/clients/${client._id}`)}
                              title="Open Client Admin Performance Dossier"
                              className="w-8 h-8 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 flex items-center justify-center text-xs border border-amber-200 transition"
                            >
                              <FaExternalLinkAlt />
                            </button>

                            {/* Admin-only mutations */}
                            {isAdmin && (
                              <>
                                {/* Edit Client */}
                                <button
                                  onClick={() => handleOpenEditModal(client)}
                                  title="Edit Client Information"
                                  className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center text-xs transition"
                                >
                                  <FaEdit />
                                </button>

                                {/* Reset Password */}
                                <button
                                  onClick={() => {
                                    setSelectedClient(client);
                                    setNewPasswordValue("");
                                    setShowPasswordModal(true);
                                  }}
                                  title="Reset Password"
                                  className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center text-xs transition"
                                >
                                  <FaKey />
                                </button>

                                {/* Toggle Status */}
                                <button
                                  onClick={() => handleToggleStatus(client)}
                                  title={client.isActive ? "Deactivate Client" : "Activate Client"}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition ${
                                    client.isActive
                                      ? "bg-stone-100 text-stone-700 hover:bg-amber-50 hover:text-amber-800"
                                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  }`}
                                >
                                  <FaPowerOff />
                                </button>

                                {/* Delete Client */}
                                <button
                                  onClick={() => handleDeleteClient(client)}
                                  title="Delete Client Permanently"
                                  className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center text-xs transition"
                                >
                                  <FaTrash />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          MODAL 1: ADD NEW CLIENT (Comprehensive Form)
      ============================================================ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-8 animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="bg-[#1A1918] text-[#F5F0E8] px-6 py-5 flex items-center justify-between border-b border-[#33312E]">
              <div>
                <span className="text-[10px] font-mono tracking-widest uppercase text-[#C5A880] px-2 py-0.5 rounded bg-[#C5A880]/15 border border-[#C5A880]/20">
                  New Account Provisioning
                </span>
                <h2 className="text-xl font-serif font-bold text-white mt-1">Add New Client Account</h2>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                disabled={saving}
                className="w-8 h-8 rounded-lg bg-stone-800 text-stone-300 hover:text-white flex items-center justify-center transition"
              >
                <FaTimes />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateClient} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              {/* ---------------- SECTION 1: BUSINESS PROFILE ---------------- */}
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-stone-500 font-bold mb-3 flex items-center gap-2">
                  <FaBuilding className="text-[#C5A880]" />
                  1. Business Profile
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Business Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Business Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="input-business-name"
                      type="text"
                      required
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      placeholder="e.g. Café Mysa, Vogue Atelier, Luxe Jewels"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-stone-50/50"
                    />
                  </div>

                  {/* Business Type */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Business Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="select-business-type"
                      value={formData.businessType}
                      onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-stone-50/50 font-medium"
                    >
                      {BUSINESS_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Website URL */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Website URL</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-stone-50/50"
                    />
                  </div>

                  {/* Business Address */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Business Address</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Street address, city, state"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-stone-50/50"
                    />
                  </div>

                  {/* Business Logo URL */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Business Logo URL (optional)
                    </label>
                    <input
                      type="url"
                      value={formData.logo}
                      onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                      placeholder="https://... logo image link"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-stone-50/50"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-stone-200" />

              {/* ---------------- SECTION 2: CONTACT PERSON & CREDENTIALS ---------------- */}
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-stone-500 font-bold mb-3 flex items-center gap-2">
                  <FaUserCircle className="text-[#C5A880]" />
                  2. Primary Contact & Login Credentials
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Contact Person Name */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Client Contact Person Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="input-contact-name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Full name of client owner or manager"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-stone-50/50"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Email Address (Login Username) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="input-client-email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="client@company.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-stone-50/50"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-stone-50/50"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-stone-700">Temporary Password</label>
                      <button
                        type="button"
                        onClick={generateSecurePassword}
                        className="text-[11px] font-mono text-[#B39369] hover:underline"
                      >
                        Auto-Generate
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="input-client-password"
                        type={showPasswordText ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Min 6 characters"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-stone-50/50 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                      >
                        {showPasswordText ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-stone-200" />

              {/* ---------------- SECTION 3: RETAINER & ASSIGNMENT ---------------- */}
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-stone-500 font-bold mb-3 flex items-center gap-2">
                  <FaMoneyBillWave className="text-[#C5A880]" />
                  3. Retainer, Services & Manager Assignment
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Account Manager Assignment */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Assign Account Manager</label>
                    <select
                      id="select-assigned-manager"
                      value={formData.assignedManager}
                      onChange={(e) => setFormData({ ...formData, assignedManager: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-stone-50/50 font-medium"
                    >
                      <option value="">No manager assigned</option>
                      {managers.map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.name} ({m.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Retainer Amount */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Agency Retainer Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.retainerAmount}
                      onChange={(e) => setFormData({ ...formData, retainerAmount: e.target.value })}
                      placeholder="e.g. 45000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-stone-50/50 font-mono"
                    />
                  </div>

                  {/* Service Start Date */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Service Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-stone-50/50 font-medium"
                    />
                  </div>

                  {/* Reporting Period */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">Reporting Period</label>
                    <select
                      value={formData.reportingPeriod}
                      onChange={(e) => setFormData({ ...formData, reportingPeriod: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880] bg-stone-50/50 font-medium"
                    >
                      {REPORTING_PERIODS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Services Purchased (Multi-select) */}
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-stone-700 mb-2">
                    Services Purchased (controls visible reporting tabs in portal)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_SERVICES.map((service) => {
                      const selected = formData.servicesPurchased.includes(service);
                      return (
                        <button
                          key={service}
                          type="button"
                          onClick={() => toggleService(service)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                            selected
                              ? "bg-stone-900 text-amber-200 border-stone-900 shadow-sm"
                              : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                          }`}
                        >
                          {selected ? <FaCheck className="text-[10px]" /> : <FaPlus className="text-[9px] text-stone-400" />}
                          {service}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Account Status Toggle */}
                <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <div>
                    <p className="text-xs font-bold text-stone-800">Account Status</p>
                    <p className="text-[11px] text-stone-500">Allow this client immediate portal access upon creation</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-sm font-semibold hover:bg-stone-50 transition"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-new-client"
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-[#C5A880] hover:bg-[#B39369] text-[#1A1918] font-bold text-sm shadow-md transition disabled:opacity-50 flex items-center gap-2 font-medium"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-stone-900 border-t-transparent rounded-full animate-spin" />
                      Provisioning Client...
                    </>
                  ) : (
                    "Create Client Account"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 2: SUCCESS BANNER (Client Created Confirmation)
      ============================================================ */}
      {showSuccessBannerModal && createdClientResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-emerald-800 text-white p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-700 flex items-center justify-center mx-auto text-2xl text-emerald-100 mb-3 border border-emerald-600">
                <FaCheckCircle />
              </div>
              <h2 className="text-xl font-serif font-bold">Client Account Created!</h2>
              <p className="text-xs text-emerald-100 mt-1">
                The client portal has been provisioned. Client ID generated automatically.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500 font-medium">Business Name:</span>
                  <strong className="text-stone-900">{createdClientResult.companyName}</strong>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500 font-medium">Contact Person:</span>
                  <span className="text-stone-900">{createdClientResult.name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500 font-medium">Client ID:</span>
                  <span className="font-mono font-bold text-amber-800 px-2 py-0.5 rounded bg-amber-100">
                    {createdClientResult.clientId}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500 font-medium">Email:</span>
                  <span className="font-mono text-stone-800">{createdClientResult.email}</span>
                </div>
                {createdClientResult.temporaryPassword && (
                  <div className="flex justify-between text-xs pt-1 border-t border-stone-200">
                    <span className="text-stone-500 font-medium">Temporary Password:</span>
                    <span className="font-mono font-bold text-stone-900">
                      {createdClientResult.temporaryPassword}
                    </span>
                  </div>
                )}
              </div>

              {createdClientResult.emailSent ? (
                <p className="text-xs text-emerald-700 flex items-center gap-1.5 font-medium">
                  <FaCheckCircle /> Credentials email successfully sent to {createdClientResult.email}.
                </p>
              ) : (
                <p className="text-xs text-stone-500">
                  You can securely share these credentials with the client to access their dashboard.
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    copyCredentials(
                      `Client Portal Credentials for ${createdClientResult.companyName}:\nURL: ${window.location.origin}/login\nClient ID: ${createdClientResult.clientId}\nEmail: ${createdClientResult.email}\nTemporary Password: ${createdClientResult.temporaryPassword}`
                    )
                  }
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <FaCopy />
                  {copied ? "Copied to Clipboard!" : "Copy Credentials"}
                </button>
                <button
                  onClick={() => {
                    setShowSuccessBannerModal(false);
                    navigate(`/dashboard?clientId=${createdClientResult._id}`);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#1A1918] hover:bg-black text-[#F5F0E8] text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <FaExternalLinkAlt />
                  Open Client Portal
                </button>
              </div>

              <button
                onClick={() => setShowSuccessBannerModal(false)}
                className="w-full py-2 text-stone-500 hover:text-stone-800 text-xs text-center font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 3: EDIT CLIENT DETAILS
      ============================================================ */}
      {showEditModal && selectedClient && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-8 animate-in fade-in zoom-in duration-150">
            <div className="bg-stone-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-serif font-bold">Edit Client Details</h2>
                <p className="text-xs text-stone-400 font-mono">{selectedClient.clientId}</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                disabled={saving}
                className="w-8 h-8 rounded-lg bg-stone-800 text-stone-300 hover:text-white flex items-center justify-center transition"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleUpdateClient} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Business Name</label>
                  <input
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Business Type</label>
                  <select
                    value={formData.businessType}
                    onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                  >
                    {BUSINESS_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Assigned Account Manager</label>
                  <select
                    value={formData.assignedManager}
                    onChange={(e) => setFormData({ ...formData, assignedManager: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                  >
                    <option value="">No manager assigned</option>
                    {managers.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Agency Retainer (₹)</label>
                  <input
                    type="number"
                    value={formData.retainerAmount}
                    onChange={(e) => setFormData({ ...formData, retainerAmount: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Reporting Period</label>
                  <select
                    value={formData.reportingPeriod}
                    onChange={(e) => setFormData({ ...formData, reportingPeriod: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                  >
                    {REPORTING_PERIODS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Website</label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880]"
                  />
                </div>
              </div>

              {/* Services Multi-Select */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-2">Services Purchased</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_SERVICES.map((service) => {
                    const selected = formData.servicesPurchased.includes(service);
                    return (
                      <button
                        key={service}
                        type="button"
                        onClick={() => toggleService(service)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                          selected
                            ? "bg-stone-900 text-amber-200 border-stone-900"
                            : "bg-stone-50 text-stone-600 border-stone-200"
                        }`}
                      >
                        {selected ? <FaCheck className="text-[10px]" /> : <FaPlus className="text-[9px]" />}
                        {service}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-xs font-bold text-stone-800">Account Access Active</span>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-black transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 4: VIEW CLIENT DETAILS DOSSIER
      ============================================================ */}
      {showDetailsModal && selectedClient && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="bg-[#1A1918] text-[#F5F0E8] p-6 border-b border-[#33312E] flex items-start justify-between">
              <div>
                <span className="font-mono text-[11px] text-[#C5A880] px-2 py-0.5 rounded bg-[#C5A880]/15 border border-[#C5A880]/20">
                  {selectedClient.clientId || "Client Account"}
                </span>
                <h2 className="text-2xl font-serif font-bold text-white mt-1.5">
                  {selectedClient.companyName || selectedClient.name}
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">Primary Contact: {selectedClient.name}</p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-8 h-8 rounded-lg bg-stone-800 text-stone-300 hover:text-white flex items-center justify-center transition"
              >
                <FaTimes />
              </button>
            </div>

            {/* Content Dossier */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div>
                  <span className="text-stone-400 font-mono uppercase text-[10px]">Business Type</span>
                  <p className="font-semibold text-stone-800 capitalize mt-0.5">{selectedClient.businessType || "Other"}</p>
                </div>
                <div>
                  <span className="text-stone-400 font-mono uppercase text-[10px]">Portal Status</span>
                  <p className="mt-0.5">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[11px] ${
                        selectedClient.isActive ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-700"
                      }`}
                    >
                      {selectedClient.isActive ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-stone-400 font-mono uppercase text-[10px]">Email</span>
                  <p className="font-mono text-stone-800 mt-0.5">{selectedClient.email}</p>
                </div>
                <div>
                  <span className="text-stone-400 font-mono uppercase text-[10px]">Phone</span>
                  <p className="text-stone-800 mt-0.5">{selectedClient.phone || "Not provided"}</p>
                </div>
                <div>
                  <span className="text-stone-400 font-mono uppercase text-[10px]">Website</span>
                  <p className="text-stone-800 mt-0.5 truncate">
                    {selectedClient.website ? (
                      <a
                        href={selectedClient.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#B39369] underline"
                      >
                        {selectedClient.website}
                      </a>
                    ) : (
                      "Not provided"
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-stone-400 font-mono uppercase text-[10px]">Address</span>
                  <p className="text-stone-800 mt-0.5">{selectedClient.address || "Not provided"}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                <span className="text-stone-400 font-mono uppercase text-[10px]">Commercials & Retainer</span>
                <div className="flex justify-between items-center">
                  <span className="text-stone-600">Monthly Retainer Fee:</span>
                  <strong className="text-stone-900 font-serif text-sm">
                    {selectedClient.retainerAmount ? `₹${Number(selectedClient.retainerAmount).toLocaleString()}` : "Standard"}
                  </strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-600">Reporting Cadence:</span>
                  <span className="text-stone-800">{selectedClient.reportingPeriod || "Monthly"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-600">Account Manager:</span>
                  <span className="font-semibold text-stone-800">
                    {selectedClient.assignedManager?.name || "None Assigned"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-stone-500 font-semibold block mb-2">Purchased Services:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedClient.servicesPurchased || []).map((s) => (
                    <span
                      key={s}
                      className="px-2.5 py-1 rounded-lg bg-stone-900 text-amber-200 font-medium text-[11px]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    navigate(`/dashboard?clientId=${selectedClient._id}`);
                  }}
                  className="flex-1 py-3 rounded-xl bg-[#1A1918] hover:bg-black text-[#F5F0E8] font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <FaExternalLinkAlt />
                  Open Live Client Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 5: RESET CLIENT PASSWORD
      ============================================================ */}
      {showPasswordModal && selectedClient && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-stone-900 text-white p-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-serif font-bold">Reset Client Password</h2>
                <p className="text-xs text-stone-400">{selectedClient.name} ({selectedClient.companyName})</p>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="w-7 h-7 rounded-lg bg-stone-800 text-stone-300 hover:text-white flex items-center justify-center text-xs"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  New Password (Min 6 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPasswordValue}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  placeholder="Enter new secure password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A880] font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-black transition disabled:opacity-50"
                >
                  {saving ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;