import axios from "axios";

/**
 * Normalizes the API base URL so that:
 * 1. Trailing slashes are cleanly removed.
 * 2. It always ends with "/api".
 * 3. Defaults to "http://localhost:5000/api" for local dev.
 */
const getBaseUrl = () => {
    const raw = (import.meta.env.VITE_API_URL || "").trim();
    if (!raw) {
        return "http://localhost:5000/api";
    }
    const clean = raw.replace(/\/+$/, "");
    return clean.endsWith("/api") ? clean : `${clean}/api`;
};

const api = axios.create({
    baseURL: getBaseUrl(),
    headers: { "Content-Type": "application/json" },
});

// Request interceptor:
// - Strips redundant "/api/" if called in the request URL so it never becomes "/api/api"
// - Attaches Bearer JWT token from localStorage
api.interceptors.request.use(
    (config) => {
        if (config.url) {
            config.url = config.url.replace(/^\/?api\//, "/");
        }
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor:
// Handles 401 — token expired or invalid on protected routes.
// Prevents redirect loops when a user enters wrong credentials on /login.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const isLoginAttempt =
                error.config?.url?.includes("/auth/login") ||
                error.config?.url?.includes("/login");

            if (!isLoginAttempt) {
                localStorage.removeItem("token");
                localStorage.removeItem("userInfo");
                if (window.location.pathname !== "/login") {
                    window.location.href = "/login";
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;
