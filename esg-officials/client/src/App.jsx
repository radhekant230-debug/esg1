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

// ESG Client Portal components & pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ClientDashboard from "./pages/ClientDashboard";
import ClientPortalLayout from "./components/portal/ClientPortalLayout";

// Dedicated ESG Admin Portal components & pages
import AdminLayout from "./components/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminClientDetail from "./pages/admin/AdminClientDetail";
import AdminDataModule from "./pages/admin/AdminDataModule";
import Clients from "./pages/Clients";
import Managers from "./pages/Managers";

// Portal Collaboration & Project pages
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
import ManagerDashboard from "./pages/ManagerDashboard";

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

// Icons for Admin Module routes
import {
    FaDollarSign,
    FaBullhorn,
    FaUserFriends,
    FaCalendarCheck,
    FaShareAlt,
    FaChartLine,
    FaFileInvoiceDollar,
    FaFileAlt,
    FaCog,
} from "react-icons/fa";

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
        if (user.role === "client") return <Navigate to="/portal" replace />;
        return <Navigate to="/login" replace />;
    }
    return children;
};

/* =========================================================
   LEGACY PORTAL LAYOUT WRAPPER (MANAGER & COLLABORATION)
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
                    2. PORTAL AUTHENTICATION
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

                {/* ========================================
                    3. DEDICATED CLIENT PORTAL (/portal)
                    Clients only see their authorized data with ClientPortalLayout
                ======================================== */}
                <Route
                    path="/portal"
                    element={
                        <RoleRoute allowedRoles={["client", "admin", "manager"]}>
                            <ClientPortalLayout>
                                <ClientDashboard />
                            </ClientPortalLayout>
                        </RoleRoute>
                    }
                />
                <Route path="/portal.html" element={<Navigate to="/portal" replace />} />
                <Route path="/dashboard" element={<Navigate to="/portal" replace />} />
                <Route path="/client-portal" element={<Navigate to="/portal" replace />} />
                <Route path="/portal-overview" element={<Navigate to="/portal" replace />} />

                {/* ========================================
                    4. DEDICATED ADMIN PORTAL (/admin/*)
                    Strictly role-protected for admin only.
                    Has its own layout, 15-item sidebar, navigation & executive hub.
                ======================================== */}
                {/* 1. Overview */}
                <Route
                    path="/admin"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <AdminLayout>
                                <AdminOverview />
                            </AdminLayout>
                        </RoleRoute>
                    }
                />

                {/* 2. Client Management & Detail */}
                <Route
                    path="/admin/clients"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <AdminLayout>
                                <Clients />
                            </AdminLayout>
                        </RoleRoute>
                    }
                />
                <Route
                    path="/admin/clients/:id"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <AdminLayout>
                                <AdminClientDetail />
                            </AdminLayout>
                        </RoleRoute>
                    }
                />

                {/* 3. Sales & Revenue */}
                <Route
                    path="/admin/sales"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <AdminLayout>
                                <AdminDataModule
                                    sectionType="sales"
                                    title="Sales & Revenue Performance"
                                    subtitle="Input, verify and monitor gross sales, net revenue, discounts, refunds and COGS across client accounts."
                                    icon={FaDollarSign}
                                    modalType="sales"
                                />
                            </AdminLayout>
                        </RoleRoute>
                    }
                />

                {/* 4. Advertising & Campaigns */}
                <Route
                    path="/admin/campaigns"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <AdminLayout>
                                <AdminDataModule
                                    sectionType="campaigns"
                                    title="Advertising & Campaigns"
                                    subtitle="Track Meta Ads, Google Ads, and digital campaign spend, conversions, and verified ROAS."
                                    icon={FaBullhorn}
                                    modalType="campaign"
                                />
                            </AdminLayout>
                        </RoleRoute>
                    }
                />

                {/* 5. Leads & Enquiries */}
                <Route
                    path="/admin/leads"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <AdminLayout>
                                <AdminDataModule
                                    sectionType="leads"
                                    title="Leads & Enquiries Pipeline"
                                    subtitle="Monitor lead acquisition funnels, enquiry volumes, qualified prospects, and conversion status."
                                    icon={FaUserFriends}
                                    modalType="lead"
                                />
                            </AdminLayout>
                        </RoleRoute>
                    }
                />

                {/* 6. Orders & Reservations */}
                <Route
                    path="/admin/orders"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <AdminLayout>
                                <AdminDataModule
                                    sectionType="orders"
                                    title="Orders & Reservations"
                                    subtitle="Manage café dine-in bookings, retail transactions, order counts, and channel volumes."
                                    icon={FaCalendarCheck}
                                    modalType="order"
                                />
                            </AdminLayout>
                        </RoleRoute>
                    }
                />

                {/* 7. Social Media Performance */}
                <Route
                    path="/admin/social"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <AdminLayout>
                                <AdminDataModule
                                    sectionType="social"
                                    title="Social Media Performance"
                                    subtitle="Verified organic reach, audience engagement, follower counts, and content metrics."
                                    icon={FaShareAlt}
                                />
                            </AdminLayout>
                        </RoleRoute>
                    }
                />

                {/* 8. Website & SEO Analytics */}
                <Route
                    path="/admin/seo"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <AdminLayout>
                                <AdminDataModule
                                    sectionType="seo"
                                    title="Website & SEO Analytics"
                                    subtitle="Track organic search sessions, Google Business traffic, user clicks, and bounce rates."
                                    icon={FaChartLine}
                                />
                            </AdminLayout>
                        </RoleRoute>
                    }
                />

                {/* 9. Expenses & Agency Retainers */}
                <Route
                    path="/admin/expenses"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <AdminLayout>
                                <AdminDataModule
                                    sectionType="expenses"
                                    title="Expenses & Agency Retainers"
                                    subtitle="Track contracted agency retainers, commercial invoices, due dates, and payment status."
                                    icon={FaFileInvoiceDollar}
                                    modalType="invoice"
                                />
                            </AdminLayout>
                        </RoleRoute>
                    }
                />

                {/* 10. Reports & Monthly Insights */}
                <Route
                    path="/admin/reports"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <AdminLayout>
                                <AdminDataModule
                                    sectionType="reports"
                                    title="Reports & Monthly Insights"
                                    subtitle="Upload, generate, and distribute strategic marketing reviews and PDF reports."
                                    icon={FaFileAlt}
                                />
                            </AdminLayout>
                        </RoleRoute>
                    }
                />

                {/* 11. Content Approvals */}
                <Route
                    path="/admin/approvals"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <AdminLayout>
                                <Approvals />
                            </AdminLayout>
                        </RoleRoute>
                    }
                />

                {/* 12. Documents & Brand Assets */}
                <Route
                    path="/admin/documents"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <AdminLayout>
                                <Documents />
                            </AdminLayout>
                        </RoleRoute>
                    }
                />

                {/* 13. Account Managers */}
                <Route
                    path="/admin/managers"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <AdminLayout>
                                <Managers />
                            </AdminLayout>
                        </RoleRoute>
                    }
                />

                {/* 14. Notifications */}
                <Route
                    path="/admin/notifications"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <AdminLayout>
                                <Notifications />
                            </AdminLayout>
                        </RoleRoute>
                    }
                />

                {/* 15. Settings */}
                <Route
                    path="/admin/settings"
                    element={
                        <RoleRoute allowedRoles={["admin"]}>
                            <AdminLayout>
                                <AdminDataModule
                                    sectionType="settings"
                                    title="Portal Settings"
                                    subtitle="Configure agency operational parameters, email notification alerts, and access preferences."
                                    icon={FaCog}
                                />
                            </AdminLayout>
                        </RoleRoute>
                    }
                />

                {/* Legacy shortcuts & redirects */}
                <Route path="/clients" element={<Navigate to="/admin/clients" replace />} />
                <Route path="/managers" element={<Navigate to="/admin/managers" replace />} />

                {/* ========================================
                    5. BUSINESS PORTAL /biz/* (PRESERVED)
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
                    6. MANAGER DASHBOARD & COLLABORATION
                ======================================== */}
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
