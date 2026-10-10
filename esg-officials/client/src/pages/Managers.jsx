import React, { useEffect, useState } from "react";
import {
  FaSearch,
  FaPlus,
  FaUserTie,
  FaTimes,
} from "react-icons/fa";
import api from "../utils/axios";

const Managers = () => {
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });

  // ==========================================
  // FETCH MANAGERS
  // ==========================================
  const fetchManagers = async () => {
    try {
      setLoading(true);
      setError("");

      const { data } = await api.get(
        "/clients/managers/all"
      );

      setManagers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load managers."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagers();
  }, []);

  // ==========================================
  // SEARCH
  // ==========================================
  const filteredManagers = managers.filter(
    (manager) => {
      const value = search.toLowerCase();

      return (
        manager.name
          ?.toLowerCase()
          .includes(value) ||
        manager.email
          ?.toLowerCase()
          .includes(value) ||
        manager.phone
          ?.toLowerCase()
          .includes(value)
      );
    }
  );

  // ==========================================
  // FORM CHANGE
  // ==========================================
  const handleChange = (e) => {
    setFormData((previous) => ({
      ...previous,
      [e.target.name]: e.target.value,
    }));
  };

  // ==========================================
  // CREATE MANAGER
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      await api.post("/clients/managers", {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim(),
      });

      setFormData({
        name: "",
        email: "",
        password: "",
        phone: "",
      });

      setShowForm(false);

      await fetchManagers();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to create manager."
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // CLOSE FORM
  // ==========================================
  const closeForm = () => {
    if (saving) return;

    setShowForm(false);

    setFormData({
      name: "",
      email: "",
      password: "",
      phone: "",
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* ======================================
          HEADER
      ====================================== */}
      <div className="bg-gray-900 text-white rounded-2xl p-6 sm:p-8 mb-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <p className="text-gray-400 text-sm font-semibold mb-1">
              ADMINISTRATION
            </p>

            <h1 className="text-2xl sm:text-3xl font-extrabold">
              Managers
            </h1>

            <p className="text-gray-300 text-sm mt-1">
              Manage managers who handle client projects.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError("");
              setShowForm(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-gray-900 rounded-xl font-semibold hover:bg-gray-100 transition"
          >
            <FaPlus />
            Add Manager
          </button>
        </div>
      </div>

      {/* ======================================
          ERROR
      ====================================== */}
      {error && (
        <div className="bg-red-50 text-red-600 border border-red-100 rounded-xl p-4 mb-5">
          {error}
        </div>
      )}

      {/* ======================================
          MANAGER LIST
      ====================================== */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-lg overflow-hidden">
        {/* SEARCH */}
        <div className="p-5 border-b border-gray-100">
          <div className="relative max-w-md">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search managers..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-700"
            />
          </div>
        </div>

        {/* LOADING */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block w-9 h-9 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />

            <p className="text-sm text-gray-500 mt-3">
              Loading managers...
            </p>
          </div>
        ) : filteredManagers.length === 0 ? (
          <div className="py-20 text-center">
            <FaUserTie className="mx-auto text-5xl text-gray-300 mb-4" />

            <h3 className="font-bold text-gray-900">
              No managers found
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              {search
                ? "Try a different search."
                : "No managers have been created yet."}
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-4 text-xs font-bold text-gray-500 uppercase">
                      Manager
                    </th>

                    <th className="text-left px-5 py-4 text-xs font-bold text-gray-500 uppercase">
                      Email
                    </th>

                    <th className="text-left px-5 py-4 text-xs font-bold text-gray-500 uppercase">
                      Phone
                    </th>

                    <th className="text-left px-5 py-4 text-xs font-bold text-gray-500 uppercase">
                      Role
                    </th>

                    <th className="text-left px-5 py-4 text-xs font-bold text-gray-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredManagers.map(
                    (manager) => (
                      <tr
                        key={manager._id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                              <FaUserTie className="text-gray-600" />
                            </div>

                            <div>
                              <p className="font-semibold text-gray-900">
                                {manager.name}
                              </p>

                              <p className="text-xs text-gray-500">
                                Manager
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-700">
                          {manager.email}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-700">
                          {manager.phone || "—"}
                        </td>

                        <td className="px-5 py-4">
                          <span className="inline-flex px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                            Manager
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                              manager.isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {manager.isActive
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredManagers.map(
                (manager) => (
                  <div
                    key={manager._id}
                    className="p-5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <FaUserTie className="text-gray-600" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-gray-900">
                              {manager.name}
                            </h3>

                            <p className="text-xs text-gray-500 break-all">
                              {manager.email}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                              manager.isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {manager.isActive
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </div>

                        <div className="mt-3 text-sm text-gray-600">
                          <span className="font-semibold">
                            Phone:
                          </span>{" "}
                          {manager.phone || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>

      {/* ======================================
          CREATE MANAGER MODAL
      ====================================== */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            {/* MODAL HEADER */}
            <div className="bg-gray-900 text-white px-6 py-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  Add Manager
                </h2>

                <p className="text-gray-400 text-xs mt-1">
                  Create a new manager account.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition"
              >
                <FaTimes />
              </button>
            </div>

            {/* FORM */}
            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Name
                </label>

                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Manager name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Email
                </label>

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="manager@example.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password
                </label>

                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Phone
                </label>

                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Phone number"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-700"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-black transition disabled:opacity-50"
                >
                  {saving
                    ? "Creating..."
                    : "Create Manager"}
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