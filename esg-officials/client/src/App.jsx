import React, { useContext } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";

import { AuthContext } from "./context/AuthContext";
import { BizProvider } from "./context/BizContext";

import Navbar from "./components/Navbar";
import BizLayout from "./components/biz/BizLayout";

// ESG Portal pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminDashboard from "./pages/AdminDashboard";
import Clients from "./pages/Clients";
import Managers from "./pages/Managers";
import ManagerDashboard from "./pages/ManagerDashboard";
import ClientDashboard from "./pages/ClientDashboard";
import Projects from "./pages/Projects";
import CreateProject from "./pages/CreateProject";
import ProjectDetails from "./pages/ProjectDetails";
import EditProject from "./pages/EditProject";
import Tasks from "./pages/Tasks";
import CreateTask from "./pages/CreateTask";
import TaskDetails from "./pages/TaskDetails";
import EditTask from "./pages/EditTask";
import Approvals from "./pages/Approvals";
import Documents from "./pages/Documents";
import Messages from "./pages/Messages";
import Notifications from "./pages/Notifications";

// Business portal pages
import BusinessList from "./pages/biz/BusinessList";
import Dashboard from "./pages/biz/Dashboard";
import Products from "./pages/biz/Products";
import Inventory from "./pages/biz/Inventory";
import NewSale from "./pages/biz/NewSale";
import SalesList from "./pages/biz/SalesList";
import Expenses from "./pages/biz/Expenses";
import Customers from "./pages/biz/Customers";
import Suppliers from "./pages/biz/Suppliers";
import Orders from "./pages/biz/Orders";
import Tables from "./pages/biz/Tables";
import MetalRates from "./pages/biz/MetalRates";
import Settings from "./pages/biz/Settings";

/* =========================================================
   ROUTE GUARDS
========================================================= */

const Spinner = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
            <div className="inline-block w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
            <p className="text-gray-600 font-semibold mt-4">Loading...</p>
        </div>
    </div>
);

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useContext(AuthContext);
    if (loading) return <Spinner />;
    if (!user) return <Navigate to="/login" replace />;
    return children;
};

const RoleRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useContext(AuthContext);
    if (loading) return <Spinner />;
    if (!user) return <Navigate to="/login" replace />;
    if (!allowedRoles.includes(user.role)) {
        if (user.role === "admin") return <Navigate to="/admin" replace />;
        if (user.role === "manager") return <Navigate to="/manager" replace />;
        if (user.role === "client") return <Navigate to="/dashboard" replace />;
        return <Navigate to="/login" replace />;
    }
    return children;
};

/* =========================================================
   BUSINESS SECTION WRAPPER
   Loads BizProvider + BizLayout around all /biz/:bizId/* routes
========================================================= */

const BizSection = ({ children }) => {
    const { user, loading } = useContext(AuthContext);
    if (loading) return <Spinner />;
    if (!user) return <Navigate to="/login" replace />;
    return (
        <BizProvider>
            <BizLayout>{children}</BizLayout>
        </BizProvider>
    );
};

/* =========================================================
   APP
========================================================= */

const App = () => {
    return (
        <BrowserRouter>
            <Routes>

                {/* ========================================
                    BUSINESS PORTAL  /biz/*
                    No Navbar, no outer padding — full-layout
                ======================================== */}
                <Route
                    path="/biz"
                    element={
                        <ProtectedRoute>
                            <BizProvider>
                                <div className="min-h-screen bg-gray-50">
                                    <BusinessList />
                                </div>
                            </BizProvider>
                        </ProtectedRoute>
                    }
                />

                <Route path="/biz/:bizId/*" element={
                    <BizSection>
                        <Routes>
                            <Route path="dashboard" element={<Dashboard />} />
                            <Route path="products" element={<Products />} />
                            <Route path="inventory" element={<Inventory />} />
                            <Route path="pos" element={<NewSale />} />
                            <Route path="sales" element={<SalesList />} />
                            <Route path="expenses" element={<Expenses />} />
                            <Route path="customers" element={<Customers />} />
                            <Route path="suppliers" element={<Suppliers />} />
                            <Route path="orders" element={<Orders />} />
                            <Route path="tables" element={<Tables />} />
                            <Route path="metal-rates" element={<MetalRates />} />
                            <Route path="settings" element={<Settings />} />
                            <Route path="" element={<Navigate to="dashboard" replace />} />
                            <Route path="*" element={<Navigate to="dashboard" replace />} />
                        </Routes>
                    </BizSection>
                } />

                {/* ========================================
                    ESG CLIENT PORTAL  (existing routes)
                    Keeps Navbar + padding
                ======================================== */}
                <Route path="/*" element={
                    <div className="min-h-screen bg-gray-50">
                        <Navbar />
                        <main className="px-4 sm:px-6 lg:px-8 py-6">
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/login" element={<Login />} />
                                <Route path="/register" element={<Register />} />

                                <Route path="/admin" element={<RoleRoute allowedRoles={["admin"]}><AdminDashboard /></RoleRoute>} />
                                <Route path="/clients" element={<RoleRoute allowedRoles={["admin"]}><Clients /></RoleRoute>} />
                                <Route path="/managers" element={<RoleRoute allowedRoles={["admin"]}><Managers /></RoleRoute>} />
                                <Route path="/manager" element={<RoleRoute allowedRoles={["manager"]}><ManagerDashboard /></RoleRoute>} />
                                <Route path="/dashboard" element={<RoleRoute allowedRoles={["client"]}><ClientDashboard /></RoleRoute>} />

                                <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
                                <Route path="/projects/create" element={<RoleRoute allowedRoles={["admin","manager"]}><CreateProject /></RoleRoute>} />
                                <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
                                <Route path="/projects/:id/edit" element={<RoleRoute allowedRoles={["admin","manager"]}><EditProject /></RoleRoute>} />

                                <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
                                <Route path="/tasks/create" element={<RoleRoute allowedRoles={["admin","manager"]}><CreateTask /></RoleRoute>} />
                                <Route path="/tasks/:id" element={<ProtectedRoute><TaskDetails /></ProtectedRoute>} />
                                <Route path="/tasks/:id/edit" element={<RoleRoute allowedRoles={["admin","manager"]}><EditTask /></RoleRoute>} />

                                <Route path="/approvals" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />
                                <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
                                <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                                <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </main>
                    </div>
                } />

            </Routes>
        </BrowserRouter>
    );
};

export default App;
