import React from "react";

const StatCard = ({ title, value, sub, icon: Icon, color = "indigo", trend }) => {
    const colorMap = {
        indigo: { bg: "bg-indigo-50", icon: "bg-indigo-500", text: "text-indigo-600" },
        green: { bg: "bg-green-50", icon: "bg-green-500", text: "text-green-600" },
        red: { bg: "bg-red-50", icon: "bg-red-500", text: "text-red-600" },
        amber: { bg: "bg-amber-50", icon: "bg-amber-500", text: "text-amber-600" },
        blue: { bg: "bg-blue-50", icon: "bg-blue-500", text: "text-blue-600" },
        purple: { bg: "bg-purple-50", icon: "bg-purple-500", text: "text-purple-600" },
        teal: { bg: "bg-teal-50", icon: "bg-teal-500", text: "text-teal-600" },
        rose: { bg: "bg-rose-50", icon: "bg-rose-500", text: "text-rose-600" },
    };
    const c = colorMap[color] || colorMap.indigo;

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
            <div className={`w-11 h-11 ${c.icon} rounded-xl flex items-center justify-center shrink-0`}>
                {Icon && <Icon className="text-white text-lg" />}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
                <p className="text-2xl font-extrabold text-gray-900 mt-0.5 truncate">{value}</p>
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
                {trend !== undefined && (
                    <p className={`text-xs font-medium mt-1 ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}% vs last period
                    </p>
                )}
            </div>
        </div>
    );
};

export default StatCard;
