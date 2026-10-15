import React, { useEffect, useState } from "react";
import {
    FaBell,
    FaCheck,
    FaTrash,
} from "react-icons/fa";
import api from "../utils/axios";
import { Link } from "react-router-dom";

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            setError("");

            const { data } = await api.get("/notifications");

            if (Array.isArray(data)) {
                setNotifications(data);
            } else {
                setNotifications(data?.notifications || []);
            }
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Unable to load notifications."
            );
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id) => {
        try {
            await api.put(`/notifications/${id}/read`);

            setNotifications((previous) =>
                previous.map((notification) =>
                    notification._id === id
                        ? {
                              ...notification,
                              isRead: true,
                              read: true,
                          }
                        : notification
                )
            );
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Unable to update notification."
            );
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.put("/notifications/read-all");

            setNotifications((previous) =>
                previous.map((notification) => ({
                    ...notification,
                    isRead: true,
                    read: true,
                }))
            );
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Unable to update notifications."
            );
        }
    };

    const deleteNotification = async (id) => {
        try {
            await api.delete(`/notifications/${id}`);

            setNotifications((previous) =>
                previous.filter(
                    (notification) =>
                        notification._id !== id
                )
            );
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Unable to delete notification."
            );
        }
    };

    const formatDate = (date) => {
        if (!date) return "";

        return new Date(date).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const isRead = (notification) =>
        notification.isRead === true ||
        notification.read === true;

    const unreadCount = notifications.filter(
        (notification) => !isRead(notification)
    ).length;

    return (
        <div className="max-w-5xl mx-auto">

            {/* Header */}
            <div className="bg-gray-900 text-white rounded-2xl p-6 sm:p-8 mb-8 shadow-lg">

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">

                    <div>
                        <p className="text-gray-400 text-sm font-semibold mb-2">
                            NOTIFICATION CENTER
                        </p>

                        <h1 className="text-2xl sm:text-3xl font-extrabold">
                            Notifications
                        </h1>

                        <p className="text-gray-300 mt-2 text-sm">
                            Stay updated with your latest project activity.
                        </p>
                    </div>

                    <div className="w-14 h-14 bg-white text-gray-900 rounded-xl flex items-center justify-center text-xl">
                        <FaBell />
                    </div>

                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 text-red-600 border border-red-100 rounded-xl p-4 mb-6">
                    {error}
                </div>
            )}

            {/* Top controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">

                <div>
                    <h2 className="text-xl font-bold text-gray-900">
                        All Notifications
                    </h2>

                    <p className="text-sm text-gray-500 mt-1">
                        {unreadCount} unread notification
                        {unreadCount === 1 ? "" : "s"}
                    </p>
                </div>

                {unreadCount > 0 && (
                    <button
                        type="button"
                        onClick={markAllAsRead}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black transition"
                    >
                        <FaCheck />
                        Mark All as Read
                    </button>
                )}

            </div>

            {/* Content */}
            {loading ? (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 text-center">

                    <div className="inline-block w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />

                    <p className="text-gray-600 font-semibold mt-4">
                        Loading notifications...
                    </p>

                </div>
            ) : notifications.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">

                    <FaBell className="mx-auto text-4xl text-gray-300 mb-4" />

                    <h3 className="text-xl font-bold text-gray-900">
                        You're All Caught Up
                    </h3>

                    <p className="text-sm text-gray-500 mt-2">
                        You don't have any notifications right now.
                    </p>

                </div>
            ) : (
                <div className="space-y-3">

                    {notifications.map((notification) => {

                        const notificationRead =
                            isRead(notification);

                        return (
                            <div
                                key={notification._id}
                                className={`bg-white rounded-xl border shadow-sm transition ${
                                    notificationRead
                                        ? "border-gray-100"
                                        : "border-gray-300 shadow-md"
                                }`}
                            >

                                <div className="p-5 sm:p-6">

                                    <div className="flex items-start gap-4">

                                        {/* Icon */}
                                        <div
                                            className={`w-11 h-11 shrink-0 rounded-lg flex items-center justify-center ${
                                                notificationRead
                                                    ? "bg-gray-100 text-gray-500"
                                                    : "bg-gray-900 text-white"
                                            }`}
                                        >
                                            <FaBell />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">

                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">

                                                <div>
                                                    <h3 className="font-bold text-gray-900">
                                                        {notification.title ||
                                                            "Notification"}
                                                    </h3>

                                                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                                        {notification.message ||
                                                            notification.content ||
                                                            "No message available."}
                                                    </p>
                                                </div>

                                                {!notificationRead && (
                                                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                                                        New
                                                    </span>
                                                )}

                                            </div>

                                            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">

                                                <span className="text-xs text-gray-400">
                                                    {formatDate(
                                                        notification.createdAt
                                                    )}
                                                </span>

                                                <div className="flex items-center gap-2">

                                                    {notification.link && notification.link.startsWith("/") && (
                                                        <Link
                                                            to={notification.link}
                                                            onClick={() => {
                                                                if (!notificationRead) markAsRead(notification._id);
                                                            }}
                                                            className="px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-black transition text-xs font-semibold"
                                                        >
                                                            Open
                                                        </Link>
                                                    )}

                                                    {!notificationRead && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                markAsRead(
                                                                    notification._id
                                                                )
                                                            }
                                                            className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-900 hover:text-white transition text-xs font-semibold flex items-center gap-2"
                                                        >
                                                            <FaCheck />
                                                            Mark Read
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            deleteNotification(
                                                                notification._id
                                                            )
                                                        }
                                                        className="w-9 h-9 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition flex items-center justify-center"
                                                        title="Delete"
                                                    >
                                                        <FaTrash className="text-xs" />
                                                    </button>

                                                </div>

                                            </div>

                                        </div>

                                    </div>

                                </div>

                            </div>
                        );
                    })}

                </div>
            )}

        </div>
    );
};

export default Notifications;