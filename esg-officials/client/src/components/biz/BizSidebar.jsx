import React from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useBiz } from "../../context/BizContext";
import {
    FaTachometerAlt, FaBox, FaShoppingCart, FaReceipt,
    FaUsers, FaTruck, FaWarehouse, FaUtensils, FaChair,
    FaGem, FaChartBar, FaCog, FaTimes, FaBuilding, FaArrowLeft,
    FaMoneyBillWave,
} from "react-icons/fa";

const NavItem = ({ to, icon: Icon, label, onClick }) => (
    <NavLink
        to={to}
        onClick={onClick}
        className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                    ? "bg-white/10 text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`
        }
    >
        <Icon className="text-base shrink-0" />
        <span>{label}</span>
    </NavLink>
);

const SectionLabel = ({ label }) => (
    <p className="px-4 pt-4 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
);

const BizSidebar = ({ isOpen, onClose }) => {
    const { bizId } = useParams();
    const { business } = useBiz();
    const navigate = useNavigate();
    const base = `/biz/${bizId}`;
    const isFood = ["cafe", "restaurant"].includes(business?.type);
    const isJewellery = business?.type === "jewellery";

    const close = () => onClose?.();

    return (
        <aside
            className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0f172a] flex flex-col transition-transform duration-300 ${
                isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            }`}
        >
            {/* Logo / business name */}
            <div className="flex items-center justify-between px-4 py-5 border-b border-slate-700">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
                        <FaBuilding className="text-white text-sm" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-white font-bold text-sm truncate">{business?.name || "Business"}</p>
                        <p className="text-slate-400 text-xs capitalize">{business?.type || ""}</p>
                    </div>
                </div>
                <button onClick={close} className="lg:hidden text-slate-400 hover:text-white p-1">
                    <FaTimes />
                </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
                <SectionLabel label="Overview" />
                <NavItem to={`${base}/dashboard`} icon={FaTachometerAlt} label="Dashboard" onClick={close} />

                <SectionLabel label="Sales" />
                <NavItem to={`${base}/pos`} icon={FaShoppingCart} label="New Sale" onClick={close} />
                <NavItem to={`${base}/sales`} icon={FaReceipt} label="Sales History" onClick={close} />
                {isFood && <NavItem to={`${base}/orders`} icon={FaUtensils} label="Orders" onClick={close} />}
                {isFood && <NavItem to={`${base}/tables`} icon={FaChair} label="Tables" onClick={close} />}

                <SectionLabel label="Catalogue" />
                <NavItem to={`${base}/products`} icon={FaBox} label="Products" onClick={close} />
                <NavItem to={`${base}/inventory`} icon={FaWarehouse} label="Inventory" onClick={close} />
                {isJewellery && <NavItem to={`${base}/metal-rates`} icon={FaGem} label="Metal Rates" onClick={close} />}

                <SectionLabel label="Finances" />
                <NavItem to={`${base}/expenses`} icon={FaMoneyBillWave} label="Expenses" onClick={close} />
                <NavItem to={`${base}/purchases`} icon={FaTruck} label="Purchases" onClick={close} />

                <SectionLabel label="Contacts" />
                <NavItem to={`${base}/customers`} icon={FaUsers} label="Customers" onClick={close} />
                <NavItem to={`${base}/suppliers`} icon={FaTruck} label="Suppliers" onClick={close} />

                <SectionLabel label="Settings" />
                <NavItem to={`${base}/settings`} icon={FaCog} label="Settings" onClick={close} />
            </nav>

            {/* Footer */}
            <div className="border-t border-slate-700 p-3">
                <button
                    onClick={() => { navigate("/biz"); close(); }}
                    className="flex items-center gap-2 text-slate-400 hover:text-white text-sm px-2 py-2 rounded-lg hover:bg-white/5 w-full transition"
                >
                    <FaArrowLeft className="text-xs" />
                    All Businesses
                </button>
            </div>
        </aside>
    );
};

export default BizSidebar;
