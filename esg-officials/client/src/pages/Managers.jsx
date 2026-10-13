import React, { useEffect, useState, useMemo } from "react";
import {
  FaSearch,
  FaPlus,
  FaUserTie,
  FaTimes,
  FaMapMarkerAlt,
  FaBuilding,
  FaEdit,
  FaCheckCircle,
  FaBan,
  FaFilter,
  FaKey,
  FaCalendarAlt,
  FaEye,
  FaEyeSlash,
  FaMagic,
  FaSpinner,
  FaExchangeAlt,
} from "react-icons/fa";
import api from "../utils/axios";

// 7 Required Initial Manager Locations
const INITIAL_LOCATIONS = [
  { city: "Raichur", state: "Karnataka" },
  { city: "Ranchi", state: "Jharkhand" },
  { city: "Dhanbad", state: "Jharkhand" },
  { city: "Jaipur", state: "Rajasthan" },
  { city: "Coimbatore", state: "Tamil Nadu" },
  { city: "Guwahati", state: "Assam" },
  { city: "Bhubaneswar", state: "Odisha" },
];

const Managers = () => {
  const [managers, setManagers] = useState([]);
  const [locations, setLocations] = useState(INITIAL_LOCATIONS);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Search & Filter controls
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState("All");
  const [filterCity, setFilterCity] = useState("All");

  // Notifications
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal toggles
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedManager, setSelectedManager] = useState(null);

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Add Manager Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    assignedState: "",
    assignedCity: "",
    assignedBusinesses: [],
    isActive: true,
    isCustomLocation: false,
    customCity: "",
    customState: "",
  });

  // Edit Location Form State
  const [editFormData, setEditFormData] = useState({
    assignedState: "",
    assignedCity: "",
    assignedBusinesses: [],
    isActive: true,
    isCustomLocation: false,
    customCity: "",
    customState: "",
  });

  // ==========================================
  // 1. DATA FETCHING
  // ==========================================
  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError("");

      const [managersRes, locationsRes, businessesRes] = await Promise.allSettled([
        api.get("/clients/managers/all"),
        api.get("/sales/locations"),
        api.get("/sales/businesses"),
      ]);

      if (managersRes.status === "fulfilled") {
        setManagers(Array.isArray(managersRes.value.data) ? managersRes.value.data : []);
      }

      // Merge initial 7 locations with database locations
      const locMap = new Map();
      INITIAL_LOCATIONS.forEach((l) => {
        locMap.set(`${l.city.toLowerCase()}___${l.state.toLowerCase()}`, {
          city: l.city,
          state: l.state,
        });
      });

      if (locationsRes.status === "fulfilled" && locationsRes.value.data?.locations) {
        locationsRes.value.data.locations.forEach((l) => {
          if (l.city && l.state) {
            locMap.set(`${l.city.toLowerCase().trim()}___${l.state.toLowerCase().trim()}`, {
              city: l.city.trim(),
              state: l.state.trim(),
            });
          }
        });
      }

      setLocations(Array.from(locMap.values()));

      if (businessesRes.status === "fulfilled") {
        setBusinesses(Array.isArray(businessesRes.value.data) ? businessesRes.value.data : []);
      }
    } catch (err) {
      console.error("Fetch managers error:", err);
      setError("Unable to load managers list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Distinct states list
  const distinctStates = useMemo(() => {
    const set = new Set();
    locations.forEach((l) => l.state && set.add(l.state));
    return Array.from(set).sort();
  }, [locations]);

  // Distinct cities list based on state filter
  const distinctCities = useMemo(() => {
    const filtered = filterState === "All"
      ? locations
      : locations.filter((l) => l.state === filterState);
    const set = new Set();
    filtered.forEach((l) => l.city && set.add(l.city));
    return Array.from(set).sort();
  }, [locations, filterState]);

  // Cities filtered for Add Manager Form
  const addFormFilteredCities = useMemo(() => {
    if (!formData.assignedState) return locations;
    return locations.filter((l) => l.state.toLowerCase() === formData.assignedState.toLowerCase());
  }, [locations, formData.assignedState]);

  // Cities filtered for Edit Location Form
  const editFormFilteredCities = useMemo(() => {
    if (!editFormData.assignedState) return locations;
    return locations.filter((l) => l.state.toLowerCase() === editFormData.assignedState.toLowerCase());
  }, [locations, editFormData.assignedState]);

  // Businesses available for Add Manager form (matching location)
  const addAvailableBusinesses = useMemo(() => {
    if (!formData.assignedCity && !formData.assignedState) return businesses;
    return businesses.filter((b) => {
      if (formData.assignedCity && b.city?.toLowerCase() === formData.assignedCity.toLowerCase()) {
        return true;
      }
      if (!formData.assignedCity && formData.assignedState && b.state?.toLowerCase() === formData.assignedState.toLowerCase()) {
        return true;
      }
      return false;
    });
  }, [businesses, formData.assignedCity, formData.assignedState]);

  // Businesses available for Edit Location form
  const editAvailableBusinesses = useMemo(() => {
    if (!editFormData.assignedCity && !editFormData.assignedState) return businesses;
    return businesses.filter((b) => {
      if (editFormData.assignedCity && b.city?.toLowerCase() === editFormData.assignedCity.toLowerCase()) {
        return true;
      }
      if (!editFormData.assignedCity && editFormData.assignedState && b.state?.toLowerCase() === editFormData.assignedState.toLowerCase()) {
        return true;
      }
      return false;
    });
  }, [businesses, editFormData.assignedCity, editFormData.assignedState]);

  // ==========================================
  // 2. SEARCH & FILTERING MANAGERS
  // ==========================================
  const filteredManagers = useMemo(() => {
    return managers.filter((manager) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        manager.name?.toLowerCase().includes(q) ||
        manager.email?.toLowerCase().includes(q) ||
        manager.phone?.toLowerCase().includes(q) ||
        manager.assignedCity?.toLowerCase().includes(q) ||
        manager.assignedState?.toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (filterState !== "All") {
        const mState = manager.assignedState?.toLowerCase() || "";
        if (mState !== filterState.toLowerCase()) return false;
      }

      if (filterCity !== "All") {
        const mCity = manager.assignedCity?.toLowerCase() || "";
        if (mCity !== filterCity.toLowerCase()) return false;
      }

      return true;
    });
  }, [managers, search, filterState, filterCity]);

  // ==========================================
  // 3. DUAL-LINKING LOCATION HANDLERS (ADD FORM)
  // ==========================================
  const handleAddStateChange = (stateVal) => {
    setFormData((prev) => {
      // If the currently selected city doesn't belong to the newly picked state, reset city
      let newCity = prev.assignedCity;
      if (stateVal && newCity) {
        const match = locations.find(
          (l) => l.state.toLowerCase() === stateVal.toLowerCase() && l.city.toLowerCase() === newCity.toLowerCase()
        );
        if (!match) newCity = "";
      }
      return {
        ...prev,
        assignedState: stateVal,
        assignedCity: newCity,
        isCustomLocation: false,
      };
    });
  };

  const handleAddLocationChange = (locVal) => {
    if (locVal === "__custom__") {
      setFormData((prev) => ({
        ...prev,
        isCustomLocation: true,
        assignedCity: "",
      }));
      return;
    }

    if (!locVal) {
      setFormData((prev) => ({
        ...prev,
        assignedCity: "",
        isCustomLocation: false,
      }));
      return;
    }

    // Auto-detect matching state
    const matched = locations.find((l) => l.city.toLowerCase() === locVal.toLowerCase());
    setFormData((prev) => ({
      ...prev,
      assignedCity: matched ? matched.city : locVal,
      assignedState: matched ? matched.state : prev.assignedState,
      isCustomLocation: false,
    }));
  };

  // Toggle business selection
  const handleToggleAddBusiness = (bizId) => {
    setFormData((prev) => {
      const exists = prev.assignedBusinesses.includes(bizId);
      return {
        ...prev,
        assignedBusinesses: exists
          ? prev.assignedBusinesses.filter((id) => id !== bizId)
          : [...prev.assignedBusinesses, bizId],
      };
    });
  };

  const handleSelectAllAddBusinesses = () => {
    const allIds = addAvailableBusinesses.map((b) => b._id);
    const areAllSelected = allIds.every((id) => formData.assignedBusinesses.includes(id));
    setFormData((prev) => ({
      ...prev,
      assignedBusinesses: areAllSelected ? [] : allIds,
    }));
  };

  // Generate strong password
  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, password: pwd }));
    setShowPassword(true);
  };

  // ==========================================
  // 4. SUBMIT: CREATE MANAGER
  // ==========================================
  const handleCreateManager = async (e) => {
    e.preventDefault();

    let finalCity = formData.assignedCity;
    let finalState = formData.assignedState;

    if (formData.isCustomLocation) {
      finalCity = formData.customCity.trim();
      finalState = formData.customState.trim();
      if (!finalCity || !finalState) {
        setError("Please enter both the custom city and state name.");
        return;
      }
    }

    if (!finalCity) {
      setError("Please select or enter the manager's assigned location.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim(),
        assignedCity: finalCity,
        assignedState: finalState,
        assignedBusinesses: formData.assignedBusinesses,
        isActive: formData.isActive,
      };

      const res = await api.post("/clients/managers", payload);

      setSuccess(res.data.message || `Manager "${formData.name}" created successfully.`);
      setShowAddModal(false);

      // Reset form
      setFormData({
        name: "",
        email: "",
        password: "",
        phone: "",
        assignedState: "",
        assignedCity: "",
        assignedBusinesses: [],
        isActive: true,
        isCustomLocation: false,
        customCity: "",
        customState: "",
      });

      await fetchAllData();
      setTimeout(() => setSuccess(""), 6000);
    } catch (err) {
      console.error("Create manager error:", err);
      setError(err.response?.data?.message || "Failed to create manager account.");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // 5. OPEN & SUBMIT: EDIT LOCATION
  // ==========================================
  const openEditModal = (manager) => {
    setSelectedManager(manager);
    const bizIds = Array.isArray(manager.assignedBusinesses)
      ? manager.assignedBusinesses.map((b) => (typeof b === "object" ? b._id : b))
      : [];

    setEditFormData({
      assignedState: manager.assignedState || "",
      assignedCity: manager.assignedCity || "",
      assignedBusinesses: bizIds,
      isActive: manager.isActive !== undefined ? manager.isActive : true,
      isCustomLocation: false,
      customCity: "",
      customState: "",
    });
    setError("");
    setShowEditModal(true);
  };

  const handleEditStateChange = (stateVal) => {
    setEditFormData((prev) => {
      let newCity = prev.assignedCity;
      if (stateVal && newCity) {
        const match = locations.find(
          (l) => l.state.toLowerCase() === stateVal.toLowerCase() && l.city.toLowerCase() === newCity.toLowerCase()
        );
        if (!match) newCity = "";
      }
      return {
        ...prev,
        assignedState: stateVal,
        assignedCity: newCity,
        isCustomLocation: false,
      };
    });
  };

  const handleEditLocationChange = (locVal) => {
    if (locVal === "__custom__") {
      setEditFormData((prev) => ({
        ...prev,
        isCustomLocation: true,
        assignedCity: "",
      }));
      return;
    }

    if (!locVal) {
      setEditFormData((prev) => ({
        ...prev,
        assignedCity: "",
        isCustomLocation: false,
      }));
      return;
    }

    const matched = locations.find((l) => l.city.toLowerCase() === locVal.toLowerCase());
    setEditFormData((prev) => ({
      ...prev,
      assignedCity: matched ? matched.city : locVal,
      assignedState: matched ? matched.state : prev.assignedState,
      isCustomLocation: false,
    }));
  };

  const handleToggleEditBusiness = (bizId) => {
    setEditFormData((prev) => {
      const exists = prev.assignedBusinesses.includes(bizId);
      return {
        ...prev,
        assignedBusinesses: exists
          ? prev.assignedBusinesses.filter((id) => id !== bizId)
          : [...prev.assignedBusinesses, bizId],
      };
    });
  };

  const handleSelectAllEditBusinesses = () => {
    const allIds = editAvailableBusinesses.map((b) => b._id);
    const areAllSelected = allIds.every((id) => editFormData.assignedBusinesses.includes(id));
    setEditFormData((prev) => ({
      ...prev,
      assignedBusinesses: areAllSelected ? [] : allIds,
    }));
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    if (!selectedManager) return;

    let finalCity = editFormData.assignedCity;
    let finalState = editFormData.assignedState;

    if (editFormData.isCustomLocation) {
      finalCity = editFormData.customCity.trim();
      finalState = editFormData.customState.trim();
      if (!finalCity || !finalState) {
        setError("Please enter both the custom city and state name.");
        return;
      }
    }

    if (!finalCity) {
      setError("Please select or enter the manager's assigned location.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        assignedCity: finalCity,
        assignedState: finalState,
        assignedBusinesses: editFormData.assignedBusinesses,
        isActive: editFormData.isActive,
      };

      const res = await api.put(`/clients/managers/${selectedManager._id}/location`, payload);

      setSuccess(res.data.message || `Location updated to ${finalCity}, ${finalState}.`);
      setShowEditModal(false);
      setSelectedManager(null);

      await fetchAllData();
      setTimeout(() => setSuccess(""), 6000);
    } catch (err) {
      console.error("Update location error:", err);
      setError(err.response?.data?.message || "Failed to update location assignment.");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // 6. TOGGLE MANAGER STATUS (ACTIVE/INACTIVE)
  // ==========================================
  const handleToggleStatus = async (manager) => {
    try {
      setError("");
      const res = await api.patch(`/clients/managers/${manager._id}/status`, {
        isActive: !manager.isActive,
      });

      setSuccess(res.data.message || `Status updated for "${manager.name}".`);

      setManagers((prev) =>
        prev.map((m) =>
          m._id === manager._id ? { ...m, isActive: !m.isActive } : m
        )
      );
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error("Toggle status error:", err);
      setError(err.response?.data?.message || "Failed to update account status.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ======================================
          HEADER BANNER
      ====================================== */}
      <div className="bg-gradient-to-r from-gray-900 via-stone-900 to-gray-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                ADMINISTRATION PORTAL
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Manage State Sales Managers
            </h1>
            <p className="text-gray-300 text-xs sm:text-sm mt-1 max-w-2xl">
              Create and manage state managers, assign regional operating locations (Ranchi, Jaipur, Dhanbad, etc.), and control business permissions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError("");
              setShowAddModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-bold text-sm shadow-lg hover:shadow-amber-500/20 transition cursor-pointer shrink-0"
          >
            <FaPlus />
            Add Manager
          </button>
        </div>
      </div>

      {/* ======================================
          ALERTS: SUCCESS & ERROR
      ====================================== */}
      {success && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl p-4 flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FaCheckCircle className="text-emerald-600 text-base" />
            {success}
          </div>
          <button
            onClick={() => setSuccess("")}
            className="text-emerald-500 hover:text-emerald-800 text-sm cursor-pointer"
          >
            <FaTimes />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FaBan className="text-red-600 text-base" />
            {error}
          </div>
          <button
            onClick={() => setError("")}
            className="text-red-400 hover:text-red-700 text-sm cursor-pointer"
          >
            <FaTimes />
          </button>
        </div>
      )}

      {/* ======================================
          SEARCH & LOCATION FILTERS
      ====================================== */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* SEARCH BY NAME/EMAIL */}
          <div className="md:col-span-2 relative">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by manager name, email, phone, city..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50/50"
            />
          </div>

          {/* FILTER BY STATE */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
              Filter by State
            </label>
            <select
              value={filterState}
              onChange={(e) => {
                setFilterState(e.target.value);
                setFilterCity("All"); // Reset city when state changes
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50/50 cursor-pointer"
            >
              <option value="All">All States ({distinctStates.length})</option>
              {distinctStates.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* FILTER BY CITY */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
              Filter by City
            </label>
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50/50 cursor-pointer"
            >
              <option value="All">All Cities ({distinctCities.length})</option>
              {distinctCities.map((ct) => (
                <option key={ct} value={ct}>
                  {ct}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ACTIVE FILTER PILLS */}
        {(filterState !== "All" || filterCity !== "All" || search) && (
          <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-gray-100 text-xs">
            <span className="text-gray-500 font-semibold flex items-center gap-1">
              <FaFilter className="text-[10px]" /> Active filters:
            </span>
            {filterState !== "All" && (
              <span className="bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                State: {filterState}
                <button onClick={() => setFilterState("All")} className="hover:text-black">×</button>
              </span>
            )}
            {filterCity !== "All" && (
              <span className="bg-blue-100 text-blue-900 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                City: {filterCity}
                <button onClick={() => setFilterCity("All")} className="hover:text-black">×</button>
              </span>
            )}
            {search && (
              <span className="bg-gray-100 text-gray-800 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                Query: "{search}"
                <button onClick={() => setSearch("")} className="hover:text-black">×</button>
              </span>
            )}
            <button
              onClick={() => {
                setFilterState("All");
                setFilterCity("All");
                setSearch("");
              }}
              className="text-red-600 hover:underline font-semibold ml-2"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* ======================================
          MANAGERS TABLE / CARD LIST
      ====================================== */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block w-9 h-9 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-3" />
            <h3 className="font-bold text-gray-800 text-sm">Loading Managers...</h3>
            <p className="text-xs text-gray-400 mt-1">Retrieving assigned locations and accounts</p>
          </div>
        ) : filteredManagers.length === 0 ? (
          <div className="py-20 text-center">
            <FaUserTie className="mx-auto text-5xl text-gray-300 mb-3" />
            <h3 className="font-bold text-gray-900 text-base">No Managers Found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {search || filterState !== "All" || filterCity !== "All"
                ? "No managers matched your current filter criteria."
                : "No manager accounts have been created yet. Click 'Add Manager' to register one."}
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="px-5 py-4">Manager Name</th>
                    <th className="px-5 py-4">Email Address</th>
                    <th className="px-5 py-4">Assigned State</th>
                    <th className="px-5 py-4">Assigned City</th>
                    <th className="px-5 py-4 text-center">Assigned Businesses</th>
                    <th className="px-5 py-4 text-center">Account Status</th>
                    <th className="px-5 py-4">Created Date</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredManagers.map((manager) => {
                    const bizCount = manager.assignedBusinessesCount !== undefined
                      ? manager.assignedBusinessesCount
                      : (Array.isArray(manager.assignedBusinesses) ? manager.assignedBusinesses.length : 0);

                    const createdFormatted = manager.createdAt
                      ? new Date(manager.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—";

                    return (
                      <tr key={manager._id} className="hover:bg-amber-50/30 transition-colors">
                        {/* NAME & PHONE */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gray-900 text-amber-400 flex items-center justify-center font-bold text-xs shadow-xs">
                              {manager.name ? manager.name.charAt(0).toUpperCase() : "M"}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 leading-snug">{manager.name}</p>
                              <p className="text-xs text-gray-500">{manager.phone || "No phone provided"}</p>
                            </div>
                          </div>
                        </td>

                        {/* EMAIL */}
                        <td className="px-5 py-4 text-xs font-mono text-gray-700">
                          {manager.email}
                        </td>

                        {/* ASSIGNED STATE */}
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {manager.assignedState || "Unassigned"}
                          </span>
                        </td>

                        {/* ASSIGNED CITY */}
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-800">
                            <FaMapMarkerAlt className="text-amber-500 text-xs shrink-0" />
                            {manager.assignedCity || "Unassigned"}
                          </span>
                        </td>

                        {/* ASSIGNED BUSINESSES COUNT */}
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <FaBuilding className="text-[10px]" />
                            {bizCount} {bizCount === 1 ? "Business" : "Businesses"}
                          </span>
                        </td>

                        {/* ACCOUNT STATUS */}
                        <td className="px-5 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                              manager.isActive
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${manager.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                            {manager.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>

                        {/* CREATED DATE */}
                        <td className="px-5 py-4 text-xs text-gray-500 font-medium">
                          {createdFormatted}
                        </td>

                        {/* ACTIONS: EDIT LOCATION & ACTIVATE/DEACTIVATE */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(manager)}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              title="Edit location assignment & permissions"
                            >
                              <FaEdit className="text-amber-600 text-xs" />
                              Edit Location
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleStatus(manager)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs ${
                                manager.isActive
                                  ? "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                              }`}
                              title={manager.isActive ? "Deactivate this manager account" : "Activate this manager account"}
                            >
                              {manager.isActive ? (
                                <>
                                  <FaBan className="text-xs" /> Deactivate
                                </>
                              ) : (
                                <>
                                  <FaCheckCircle className="text-xs" /> Activate
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS VIEW */}
            <div className="lg:hidden divide-y divide-gray-100">
              {filteredManagers.map((manager) => {
                const bizCount = manager.assignedBusinessesCount !== undefined
                  ? manager.assignedBusinessesCount
                  : (Array.isArray(manager.assignedBusinesses) ? manager.assignedBusinesses.length : 0);

                const createdFormatted = manager.createdAt
                  ? new Date(manager.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—";

                return (
                  <div key={manager._id} className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 text-amber-400 flex items-center justify-center font-bold text-sm shadow-xs">
                          {manager.name ? manager.name.charAt(0).toUpperCase() : "M"}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm leading-snug">{manager.name}</h3>
                          <p className="text-xs text-gray-500 font-mono break-all">{manager.email}</p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          manager.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {manager.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <div>
                        <span className="text-gray-400 text-[10px] uppercase font-bold block">Assigned Location</span>
                        <span className="font-bold text-gray-800 flex items-center gap-1 mt-0.5">
                          <FaMapMarkerAlt className="text-amber-500 text-[11px]" />
                          {manager.assignedCity || "Unassigned"}, {manager.assignedState || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-[10px] uppercase font-bold block">Assigned Businesses</span>
                        <span className="font-bold text-blue-700 mt-0.5 inline-block">
                          {bizCount} Businesses
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-[10px] uppercase font-bold block">Phone</span>
                        <span className="text-gray-700 font-medium mt-0.5 inline-block">
                          {manager.phone || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-[10px] uppercase font-bold block">Created Date</span>
                        <span className="text-gray-700 font-medium mt-0.5 inline-block">
                          {createdFormatted}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(manager)}
                        className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <FaEdit className="text-amber-600" />
                        Edit Location
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(manager)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          manager.isActive
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {manager.isActive ? <FaBan /> : <FaCheckCircle />}
                        {manager.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* =========================================================================
          MODAL 1: ADD MANAGER WITH COMPLETE LOCATION ASSIGNMENT SYSTEM
      ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-gray-100 my-8">
            {/* MODAL HEADER */}
            <div className="bg-gradient-to-r from-gray-900 via-stone-900 to-gray-900 text-white px-6 py-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block mb-0.5">
                  MANAGER LOCATION ASSIGNMENT SYSTEM
                </span>
                <h2 className="text-xl font-extrabold">Add New State Manager</h2>
                <p className="text-gray-400 text-xs mt-0.5">
                  Configure manager profile, assign permanent operating city & state, and link authorized businesses.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!saving) setShowAddModal(false);
                }}
                disabled={saving}
                className="w-9 h-9 rounded-xl bg-gray-800 text-gray-300 flex items-center justify-center hover:bg-gray-700 hover:text-white transition cursor-pointer"
              >
                <FaTimes />
              </button>
            </div>

            {/* FORM BODY */}
            <form onSubmit={handleCreateManager} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* SECTION: BASIC DETAILS */}
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider flex items-center gap-2">
                  <FaUserTie className="text-amber-500" />
                  1. Manager Profile Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50/50 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="manager@esgofficial.com"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50/50 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50/50 font-medium"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-700">
                        Login Password <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="text-[11px] font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
                      >
                        <FaMagic className="text-[10px]" /> Auto-generate
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Minimum 6 characters"
                        className="w-full px-3.5 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50/50 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-sm cursor-pointer"
                      >
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: CITY & LOCATION ASSIGNMENT WITH DUAL-LINKING */}
              <div className="pt-4 border-t border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider flex items-center gap-2">
                    <FaMapMarkerAlt className="text-amber-500" />
                    2. Regional Location Assignment
                  </h3>
                  <span className="text-[11px] text-gray-500 font-medium">
                    Dual-linked state and city auto-detection
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* SELECT STATE FIRST (OPTIONAL / DUAL-LINKED) */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Select State
                    </label>
                    <select
                      value={formData.assignedState}
                      onChange={(e) => handleAddStateChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50/50 cursor-pointer"
                    >
                      <option value="">-- All States (Select State First) --</option>
                      {distinctStates.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Selecting state filters available cities.
                    </p>
                  </div>

                  {/* SELECT MANAGER LOCATION (REQUIRED DROPDOWN) */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Select Manager Location <span className="text-red-500">*</span>
                    </label>
                    <select
                      required={!formData.isCustomLocation}
                      value={formData.isCustomLocation ? "__custom__" : formData.assignedCity}
                      onChange={(e) => handleAddLocationChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-amber-300 bg-amber-50/40 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                    >
                      <option value="">-- Select Manager Location --</option>
                      {addFormFilteredCities.map((loc) => (
                        <option key={`${loc.city}___${loc.state}`} value={loc.city}>
                          {loc.city}, {loc.state}
                        </option>
                      ))}
                      <option value="__custom__">+ Other location added by Admin...</option>
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Selecting location automatically sets its associated state.
                    </p>
                  </div>
                </div>

                {/* DYNAMIC CUSTOM LOCATION INPUTS (WHEN ADMIN CHOOSES 'OTHER LOCATION') */}
                {formData.isCustomLocation && (
                  <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 space-y-3 animate-fadeIn">
                    <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <FaPlus className="text-xs text-amber-600" />
                      Add New State & City Location (Dynamic)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                          City Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.customCity}
                          onChange={(e) => setFormData({ ...formData, customCity: e.target.value })}
                          placeholder="e.g. Surat"
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                          State Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.customState}
                          onChange={(e) => setFormData({ ...formData, customState: e.target.value })}
                          placeholder="e.g. Gujarat"
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION: ASSIGN BUSINESSES (OPTIONAL) */}
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider flex items-center gap-2">
                      <FaBuilding className="text-amber-500" />
                      3. Assign Businesses (Optional)
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Assign specific hotels, restaurants, and retail clients to this manager.
                    </p>
                  </div>

                  {addAvailableBusinesses.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllAddBusinesses}
                      className="text-xs font-bold text-amber-600 hover:text-amber-800 cursor-pointer"
                    >
                      {addAvailableBusinesses.every((b) => formData.assignedBusinesses.includes(b._id))
                        ? "Deselect All"
                        : "Select All in Location"}
                    </button>
                  )}
                </div>

                {addAvailableBusinesses.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center text-xs text-gray-500">
                    No businesses found in the selected location yet. The manager will oversee businesses added in this city.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-200">
                    {addAvailableBusinesses.map((b) => {
                      const checked = formData.assignedBusinesses.includes(b._id);
                      return (
                        <label
                          key={b._id}
                          className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${
                            checked
                              ? "bg-amber-50/80 border-amber-300 text-amber-950 font-bold"
                              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100/60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleAddBusiness(b._id)}
                            className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate leading-snug">{b.name}</p>
                            <span className="text-[10px] text-gray-400 font-normal">
                              {b.category} • {b.city}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION: ACCOUNT STATUS */}
              <div className="pt-4 border-t border-gray-100 space-y-2">
                <h3 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider">
                  4. Account Status
                </h3>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={formData.isActive === true}
                      onChange={() => setFormData({ ...formData, isActive: true })}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Active (Can log in immediately)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={formData.isActive === false}
                      onChange={() => setFormData({ ...formData, isActive: false })}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span className="flex items-center gap-1.5 text-red-700">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      Inactive (Login disabled)
                    </span>
                  </label>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="flex items-center justify-end gap-3 pt-5 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs sm:text-sm hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs sm:text-sm shadow-md hover:shadow-amber-500/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <FaSpinner className="animate-spin text-sm" /> Creating Manager...
                    </>
                  ) : (
                    "Create Manager"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: EDIT LOCATION ASSIGNMENT & BUSINESSES
      ========================================================================= */}
      {showEditModal && selectedManager && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-gray-100 my-8">
            {/* MODAL HEADER */}
            <div className="bg-gradient-to-r from-gray-900 via-stone-900 to-gray-900 text-white px-6 py-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block mb-0.5">
                  EDIT LOCATION ASSIGNMENT
                </span>
                <h2 className="text-xl font-extrabold">Reassign Manager Location</h2>
                <p className="text-gray-400 text-xs mt-0.5">
                  Updating {selectedManager.name}'s assigned city updates their dashboard permissions without deleting historical sales records.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!saving) setShowEditModal(false);
                }}
                disabled={saving}
                className="w-9 h-9 rounded-xl bg-gray-800 text-gray-300 flex items-center justify-center hover:bg-gray-700 hover:text-white transition cursor-pointer"
              >
                <FaTimes />
              </button>
            </div>

            {/* FORM BODY */}
            <form onSubmit={handleSaveLocation} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* CURRENT MANAGER SUMMARY */}
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-gray-400 uppercase text-[10px] font-bold block">Manager</span>
                  <span className="font-bold text-gray-900 text-sm">{selectedManager.name}</span>
                  <span className="text-gray-500 block">{selectedManager.email}</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 uppercase text-[10px] font-bold block">Current Location</span>
                  <span className="font-bold text-amber-700">
                    {selectedManager.assignedCity || "None"}, {selectedManager.assignedState || "None"}
                  </span>
                </div>
              </div>

              {/* LOCATION SELECTORS */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* SELECT STATE */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Select State
                    </label>
                    <select
                      value={editFormData.assignedState}
                      onChange={(e) => handleEditStateChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50/50 cursor-pointer"
                    >
                      <option value="">-- All States --</option>
                      {distinctStates.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* SELECT MANAGER LOCATION */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Select Manager Location <span className="text-red-500">*</span>
                    </label>
                    <select
                      required={!editFormData.isCustomLocation}
                      value={editFormData.isCustomLocation ? "__custom__" : editFormData.assignedCity}
                      onChange={(e) => handleEditLocationChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-amber-300 bg-amber-50/40 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                    >
                      <option value="">-- Select Manager Location --</option>
                      {editFormFilteredCities.map((loc) => (
                        <option key={`${loc.city}___${loc.state}`} value={loc.city}>
                          {loc.city}, {loc.state}
                        </option>
                      ))}
                      <option value="__custom__">+ Other location added by Admin...</option>
                    </select>
                  </div>
                </div>

                {/* CUSTOM LOCATION INPUTS */}
                {editFormData.isCustomLocation && (
                  <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 space-y-3 animate-fadeIn">
                    <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <FaPlus className="text-xs text-amber-600" />
                      Add New State & City Location (Dynamic)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                          City Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={editFormData.customCity}
                          onChange={(e) => setEditFormData({ ...editFormData, customCity: e.target.value })}
                          placeholder="e.g. Surat"
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                          State Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={editFormData.customState}
                          onChange={(e) => setEditFormData({ ...editFormData, customState: e.target.value })}
                          placeholder="e.g. Gujarat"
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* RE-ASSIGN BUSINESSES */}
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider flex items-center gap-2">
                      <FaBuilding className="text-amber-500" />
                      Update Assigned Businesses
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Select businesses authorized for monthly sales Excel upload.
                    </p>
                  </div>

                  {editAvailableBusinesses.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllEditBusinesses}
                      className="text-xs font-bold text-amber-600 hover:text-amber-800 cursor-pointer"
                    >
                      {editAvailableBusinesses.every((b) => editFormData.assignedBusinesses.includes(b._id))
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  )}
                </div>

                {editAvailableBusinesses.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center text-xs text-gray-500">
                    No businesses currently found in this city. All new businesses created in this city will be visible to this manager.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-200">
                    {editAvailableBusinesses.map((b) => {
                      const checked = editFormData.assignedBusinesses.includes(b._id);
                      return (
                        <label
                          key={b._id}
                          className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${
                            checked
                              ? "bg-amber-50/80 border-amber-300 text-amber-950 font-bold"
                              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100/60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleEditBusiness(b._id)}
                            className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate leading-snug">{b.name}</p>
                            <span className="text-[10px] text-gray-400 font-normal">
                              {b.category} • {b.city}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ACCOUNT STATUS IN EDIT */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-700 block">Account Status</span>
                  <span className="text-[11px] text-gray-400">Controls whether manager can log in</span>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="editIsActive"
                      checked={editFormData.isActive === true}
                      onChange={() => setEditFormData({ ...editFormData, isActive: true })}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-emerald-700">Active</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="editIsActive"
                      checked={editFormData.isActive === false}
                      onChange={() => setEditFormData({ ...editFormData, isActive: false })}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-red-700">Inactive</span>
                  </label>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="flex items-center justify-end gap-3 pt-5 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs sm:text-sm hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs sm:text-sm shadow-md hover:shadow-amber-500/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <FaSpinner className="animate-spin text-sm" /> Saving Changes...
                    </>
                  ) : (
                    "Save Location Assignment"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Managers;