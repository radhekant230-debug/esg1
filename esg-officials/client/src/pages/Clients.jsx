import React, { useEffect, useState } from "react";
import {
  FaSearch,
  FaPlus,
  FaUserCircle,
  FaEdit,
  FaTrash,
  FaPowerOff,
  FaKey,
  FaTimes,
} from "react-icons/fa";
import api from "../utils/axios";

const Clients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    companyName: "",
    phone: "",
  });

  const [saving, setSaving] = useState(false);

  // ==========================================
  // FETCH CLIENTS
  // ==========================================
  const fetchClients = async () => {
    try {
      setLoading(true);
      setError("");

      const { data } = await api.get("/clients");

      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load clients."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // ==========================================
  // SEARCH
  // ==========================================
  const filteredClients = clients.filter((client) => {
    const searchText = search.toLowerCase();

    return (
      client.name?.toLowerCase().includes(searchText) ||
      client.email?.toLowerCase().includes(searchText) ||
      client.companyName
        ?.toLowerCase()
        .includes(searchText) ||
      client.clientId
        ?.toLowerCase()
        .includes(searchText)
    );
  });

  // ==========================================
  // FORM CHANGE
  // ==========================================
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // ==========================================
  // OPEN CREATE FORM
  // ==========================================
  const openCreateForm = () => {
    setEditingClient(null);

    setFormData({
      name: "",
      email: "",
      password: "",
      companyName: "",
      phone: "",
    });

    setShowForm(true);
    setError("");
  };

  // ==========================================
  // OPEN EDIT FORM
  // ==========================================
  const openEditForm = (client) => {
    setEditingClient(client);

    setFormData({
      name: client.name || "",
      email: client.email || "",
      password: "",
      companyName: client.companyName || "",
      phone: client.phone || "",
    });

    setShowForm(true);
    setError("");
  };

  // ==========================================
  // CLOSE FORM
  // ==========================================
  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingClient(null);

    setFormData({
      name: "",
      email: "",
      password: "",
      companyName: "",
      phone: "",
    });
  };

  // ==========================================
  // CREATE / UPDATE CLIENT
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      if (editingClient) {
        const payload = {
          name: formData.name,
          email: formData.email,
          companyName: formData.companyName,
          phone: formData.phone,
        };

        await api.put(
          `/clients/${editingClient._id}`,
          payload
        );
      } else {
        if (!formData.password) {
          setError("Password is required.");
          setSaving(false);
          return;
        }

        await api.post("/clients", formData);
      }

      closeForm();
      await fetchClients();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to save client."
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // TOGGLE CLIENT STATUS
  // ==========================================
  const handleToggleStatus = async (client) => {
    const action = client.isActive
      ? "deactivate"
      : "activate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${client.name}?`
    );

    if (!confirmed) return;

    try {
      setError("");

      await api.put(
        `/clients/${client._id}/toggle-status`
      );

      await fetchClients();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to change client status."
      );
    }
  };

  // ==========================================
  // RESET PASSWORD
  // ==========================================
  const handleResetPassword = async (client) => {
    const newPassword = window.prompt(
      `Enter a new password for ${client.name}:`
    );

    if (!newPassword) return;

    if (newPassword.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    try {
      setError("");

      await api.put(
        `/clients/${client._id}/reset-password`,
        {
          password: newPassword,
        }
      );

      alert("Password reset successfully.");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to reset password."
      );
    }
  };

  // ==========================================
  // DELETE CLIENT
  // ==========================================
  const handleDelete = async (client) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${client.name}?`
    );

    if (!confirmed) return;

    try {
      setError("");

      await api.delete(
        `/clients/${client._id}`
      );

      await fetchClients();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to delete client."
      );
    }
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
              Clients
            </h1>

            <p className="text-gray-300 text-sm mt-1">
              Manage all client accounts and access.
            </p>
          </div>

          <button
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-gray-900 rounded-xl font-semibold hover:bg-gray-100 transition"
          >
            <FaPlus />
            Add Client
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
          CLIENT LIST
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
              placeholder="Search clients..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-700"
            />
          </div>
        </div>

        {/* LOADING */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block w-9 h-9 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />

            <p className="text-sm text-gray-500 mt-3">
              Loading clients...
            </p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="py-20 text-center">
            <FaUserCircle className="mx-auto text-5xl text-gray-300 mb-4" />

            <h3 className="font-bold text-gray-900">
              No clients found
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              {search
                ? "Try a different search."
                : "No clients have been added yet."}
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
                      Client
                    </th>

                    <th className="text-left px-5 py-4 text-xs font-bold text-gray-500 uppercase">
                      Client ID
                    </th>

                    <th className="text-left px-5 py-4 text-xs font-bold text-gray-500 uppercase">
                      Company
                    </th>

                    <th className="text-left px-5 py-4 text-xs font-bold text-gray-500 uppercase">
                      Contact
                    </th>

                    <th className="text-left px-5 py-4 text-xs font-bold text-gray-500 uppercase">
                      Status
                    </th>

                    <th className="text-right px-5 py-4 text-xs font-bold text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredClients.map((client) => (
                    <tr
                      key={client._id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <FaUserCircle className="text-3xl text-gray-400" />

                          <div>
                            <p className="font-semibold text-gray-900">
                              {client.name}
                            </p>

                            <p className="text-xs text-gray-500">
                              {client.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-mono text-sm text-gray-700">
                          {client.clientId || "—"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {client.companyName || "—"}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {client.phone || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                            client.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {client.isActive
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end items-center gap-2">
                          <button
                            onClick={() =>
                              openEditForm(client)
                            }
                            title="Edit client"
                            className="w-9 h-9 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-gray-200 transition"
                          >
                            <FaEdit />
                          </button>

                          <button
                            onClick={() =>
                              handleResetPassword(
                                client
                              )
                            }
                            title="Reset password"
                            className="w-9 h-9 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-gray-200 transition"
                          >
                            <FaKey />
                          </button>

                          <button
                            onClick={() =>
                              handleToggleStatus(
                                client
                              )
                            }
                            title={
                              client.isActive
                                ? "Deactivate"
                                : "Activate"
                            }
                            className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
                              client.isActive
                                ? "bg-yellow-50 text-yellow-600 hover:bg-yellow-100"
                                : "bg-green-50 text-green-600 hover:bg-green-100"
                            }`}
                          >
                            <FaPowerOff />
                          </button>

                          <button
                            onClick={() =>
                              handleDelete(client)
                            }
                            title="Delete client"
                            className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredClients.map((client) => (
                <div
                  key={client._id}
                  className="p-5"
                >
                  <div className="flex items-start gap-3">
                    <FaUserCircle className="text-3xl text-gray-400 shrink-0" />

                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-gray-900">
                            {client.name}
                          </h3>

                          <p className="text-xs text-gray-500 break-all">
                            {client.email}
                          </p>
                        </div>

                        <span
                          className={`h-fit inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                            client.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {client.isActive
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-sm">
                        <p className="text-gray-600">
                          <span className="font-semibold">
                            Client ID:
                          </span>{" "}
                          {client.clientId ||
                            "—"}
                        </p>

                        <p className="text-gray-600">
                          <span className="font-semibold">
                            Company:
                          </span>{" "}
                          {client.companyName ||
                            "—"}
                        </p>

                        <p className="text-gray-600">
                          <span className="font-semibold">
                            Phone:
                          </span>{" "}
                          {client.phone || "—"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-4">
                        <button
                          onClick={() =>
                            openEditForm(client)
                          }
                          className="flex-1 min-w-[100px] py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold flex items-center justify-center gap-2"
                        >
                          <FaEdit />
                          Edit
                        </button>

                        <button
                          onClick={() =>
                            handleResetPassword(
                              client
                            )
                          }
                          className="flex-1 min-w-[100px] py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold flex items-center justify-center gap-2"
                        >
                          <FaKey />
                          Password
                        </button>

                        <button
                          onClick={() =>
                            handleToggleStatus(
                              client
                            )
                          }
                          className="flex-1 min-w-[100px] py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold flex items-center justify-center gap-2"
                        >
                          <FaPowerOff />
                          {client.isActive
                            ? "Disable"
                            : "Enable"}
                        </button>

                        <button
                          onClick={() =>
                            handleDelete(client)
                          }
                          className="flex-1 min-w-[100px] py-2 rounded-lg bg-red-50 text-red-600 text-xs font-semibold flex items-center justify-center gap-2"
                        >
                          <FaTrash />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ======================================
          CREATE / EDIT MODAL
      ====================================== */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            {/* MODAL HEADER */}
            <div className="bg-gray-900 text-white px-6 py-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {editingClient
                    ? "Edit Client"
                    : "Add Client"}
                </h2>

                <p className="text-gray-400 text-xs mt-1">
                  {editingClient
                    ? "Update client information."
                    : "Create a new client account."}
                </p>
              </div>

              <button
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
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-700"
                  placeholder="Client name"
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
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-700"
                  placeholder="client@example.com"
                />
              </div>

              {!editingClient && (
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-700"
                    placeholder="Minimum 6 characters"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Company Name
                </label>

                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-700"
                  placeholder="Company name"
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
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-700"
                  placeholder="Phone number"
                />
              </div>

              {/* BUTTONS */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-black transition disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingClient
                    ? "Update Client"
                    : "Create Client"}
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