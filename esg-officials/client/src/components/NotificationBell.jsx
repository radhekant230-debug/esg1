import React, { useContext, useEffect, useState } from "react";
import { FaBell } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import api from "../utils/axios";
import { AuthContext } from "../context/AuthContext";

const NotificationBell = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchUnreadCount = async () => {
        if (!user) return;

        try {
            const { data } = await api.get(
                "/notifications/unread-count"
            );

            setUnreadCount(
                data.count ?? data.unreadCount ?? 0
            );
        } catch (error) {
            console.error(
                "Error fetching notification count:",
                error
            );
        }
    };

    useEffect(() => {
        fetchUnreadCount();

        // Refresh notification count periodically
        const interval = setInterval(() => {
            fetchUnreadCount();
        }, 30000);

        return () => clearInterval(interval);
    }, [user]);

    const handleClick = async () => {
        setLoading(true);

        try {
            await fetchUnreadCount();
            navigate("/notifications");
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return null;
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            className="relative flex items-center justify-center w-10 h-10 rounded-lg text-gray-200 hover:text-white hover:bg-gray-800 transition duration-200 disabled:opacity-60"
            aria-label="Notifications"
        >
            <FaBell className="text-lg" />

            {unreadCount > 0 && (
                <span
                    className="
                        absolute
                        -top-1
                        -right-1
                        min-w-[20px]
                        h-5
                        px-1
                        flex
                        items-center
                        justify-center
                        rounded-full
                        bg-red-600
                        text-white
                        text-[10px]
                        font-bold
                        border-2
                        border-gray-900
                    "
                >
                    {unreadCount > 99
                        ? "99+"
                        : unreadCount}
                </span>
            )}
        </button>
    );
};

export default NotificationBell;