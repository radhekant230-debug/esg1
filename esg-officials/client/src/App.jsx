import React, { useContext } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthContext } from "./context/AuthContext";
import { BizProvider } from "./context/BizContext";

import Navbar from "./components/Navbar";
import BizLayout from "./components/biz/BizLayout";

// Public website components & pages
import PublicLayout from "./components/public/PublicLayout";
import PublicHome from "./pages/public/PublicHome";
import PublicAbout from "./pages/public/PublicAbout";
import PublicServices from "./pages/public/PublicServices";
import PublicIndustries from "./pages/public/PublicIndustries";
import PublicCaseStudies from "./pages/public/PublicCaseStudies";
import PublicResearch from "./pages/public/PublicResearch";
import PublicContact from "./pages/public/PublicContact";

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
   PORTAL LAYOUT WRAPPER (AUTHENTICATED ESG CLIENT PORTAL)
========================================================= */

const PortalLayout = ({ children }) => {
    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <main className="px-4 sm:px-6 lg:px-8 py-6">
                {children}
            </main>
        </div>
    );
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
   MAIN APPLICATION ROUTER
========================================================= */

const App = () => {
    return (
        <BrowserRouter>
            <Routes>

                {/* ========================================
                    1. PUBLIC ESG OFFICIALS WEBSITE
                    Root / loads the original published homepage
                ======================================== */}
                <Route path="/" element={<PublicLayout><PublicHome /></PublicLayout>} />
                <Route path="/about" element={<PublicLayout><PublicAbout /></PublicLayout>} />
                <Route path="/services" element={<PublicLayout><PublicServices /></PublicLayout>} />
                <Route path="/industries" element={<PublicLayout><PublicIndustries /></PublicLayout>} />
                <Route path="/case-studies" element={<PublicLayout><PublicCaseStudies /></PublicLayout>} />
                <Route path="/research" element={<PublicLayout><PublicResearch /></PublicLayout>} />
                <Route path="/contact" element={<PublicLayout><PublicContact /></PublicLayout>} />

                {/* Legacy .html redirects for backward compatibility */}
                <Route path="/index.html" element={<Navigate to="/" replace />} />
                <Route path="/about.html" element={<Navigate to="/about" replace />} />
                <Route path="/services.html" element={<Navigate to="/services" replace />} />
                <Route path="/industries.html" element={<Navigate to="/industries" replace />} />
                <Route path="/case-studies.html" element={<Navigate to="/case-studies" replace />} />
                <Route path="/research.html" element={<Navigate to="/research" replace />} />
                <Route path="/contact.html" element={<Navigate to="/contact" replace />} />

                {/* ========================================
                    2. CLIENT PORTAL AUTHENTICATION
                ======================================== */}
                <Route
                    path="/login"
                    element={
                        <div className="min-h-screen bg-gray-50 py-10 px-4">
                            <Login />
                        </div>
                    }
                />
                <Route
                    path="/register"
                    element={
                        <div className="min-h-screen bg-gray-50 py-10 px-4">
                            <Register />
                        </div>
                    }
                />
                <Route path="/login.html" element={<Navigate to="/login" replace />} />
                <Route path="/portal" element={<Navigate to="/login" replace />} />
                <Route path="/portal.html" element={<Navigate to="/login" replace />} />

                {/* ========================================
                    3. BUSINESS PORTAL /biz/* (PRESERVED)
                    No Navbar, no outer padding — full layout
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

                <Route
                    path="/biz/:bizId/*"
                    element={
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
                    }
                />

                {/* ========================================
                    4. AUTHENTICATED ESG CLIENT PORTAL
                    Protected by role guards and wrapped in PortalLayout
                ======================================== */}
                <Route
                    path="/admin"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <PortalLayout>
                                <AdminDashboard />
                            </PortalLayout>
                        </RoleRoute>
                    }
                />
                <Route
                    path="/clients"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <PortalLayout>
                                <Clients />
                            </PortalLayout>
                        </RoleRoute>
                    }
                />
                <Route
                    path="/managers"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <PortalLayout>
                                <Managers />
                            </PortalLayout>
                        </RoleRoute>
                    }
                />
                <Route
                    path="/manager"
                    element={
                        <RoleRoute allowedRoles={["manager"]}>
                            <PortalLayout>
                                <ManagerDashboard />
                            </PortalLayout>
                        </RoleRoute>
                    }
                />
                <Route
                    path="/dashboard"
                    element={
                        <RoleRoute allowedRoles={["client"]}>
                            <PortalLayout>
                                <ClientDashboard />
                            </PortalLayout>
                        </RoleRoute>
                    }
                />
                <Route
                    path="/portal-overview"
                    element={
                        <ProtectedRoute>
                            <PortalLayout>
                                <Home />
                            </PortalLayout>
                        </ProtectedRoute>
                    }
                />

                {/* Projects */}
                <Route
                    path="/projects"
                    element={
                        <ProtectedRoute>
                            <PortalLayout>
                                <Projects />
                            </PortalLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/projects/create"
                    element={
                        <RoleRoute allowedRoles={["admin", "manager"]}>
                            <PortalLayout>
                                <CreateProject />
                            </PortalLayout>
                        </RoleRoute>
                    }
                />
                <Route
                    path="/projects/:id"
                    element={
                        <ProtectedRoute>
                            <PortalLayout>
                                <ProjectDetails />
                            </PortalLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/projects/:id/edit"
                    element={
                        <RoleRoute allowedRoles={["admin", "manager"]}>
                            <PortalLayout>
                                <EditProject />
                            </PortalLayout>
                        </RoleRoute>
                    }
                />

                {/* Tasks */}
                <Route
                    path="/tasks"
                    element={
                        <ProtectedRoute>
                            <PortalLayout>
                                <Tasks />
                            </PortalLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/tasks/create"
                    element={
                        <RoleRoute allowedRoles={["admin", "manager"]}>
                            <PortalLayout>
                                <CreateTask />
                            </PortalLayout>
                        </RoleRoute>
                    }
                />
                <Route
                    path="/tasks/:id"
                    element={
                        <ProtectedRoute>
                            <PortalLayout>
                                <TaskDetails />
                            </PortalLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/tasks/:id/edit"
                    element={
                        <RoleRoute allowedRoles={["admin", "manager"]}>
                            <PortalLayout>
                                <EditTask />
                            </PortalLayout>
                        </RoleRoute>
                    }
                />

                {/* Approvals, Documents, Messages, Notifications */}
                <Route
                    path="/approvals"
                    element={
                        <ProtectedRoute>
                            <PortalLayout>
                                <Approvals />
                            </PortalLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/documents"
                    element={
                        <ProtectedRoute>
                            <PortalLayout>
                                <Documents />
                            </PortalLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/messages"
                    element={
                        <ProtectedRoute>
                            <PortalLayout>
                                <Messages />
                            </PortalLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/notifications"
                    element={
                        <ProtectedRoute>
                            <PortalLayout>
                                <Notifications />
                            </PortalLayout>
                        </ProtectedRoute>
                    }
                />

                {/* Catch-all route -> redirects to public home */}
                <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>
        </BrowserRouter>
    );
};

export default App;
