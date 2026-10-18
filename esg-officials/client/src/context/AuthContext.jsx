import React, {
    createContext,
    useEffect,
    useState
} from "react";

import api from "../utils/axios";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // ==========================================
    // RESTORE LOGIN SESSION
    // ==========================================
    useEffect(() => {
        try {
            const userInfo = localStorage.getItem("userInfo");

            if (userInfo) {
                setUser(JSON.parse(userInfo));
            }
        } catch (error) {
            console.error("Error restoring user session:", error);

            localStorage.removeItem("userInfo");
            localStorage.removeItem("token");
        } finally {
            setLoading(false);
        }
    }, []);

    // ==========================================
    // LOGIN
    // ==========================================
    const login = async (loginId, password, portal = null) => {
        try {
            const cleanId = (loginId || "").trim();
            const isEmail = cleanId.includes("@");

            const payload = {
                password,
                loginId: cleanId,
                ...(isEmail
                    ? { email: cleanId }
                    : { clientId: cleanId }),
                ...(portal ? { portal } : {}),
            };

            const { data } = await api.post(
                "/auth/login",
                payload
            );

            setUser(data);

            localStorage.setItem(
                "userInfo",
                JSON.stringify(data)
            );

            localStorage.setItem(
                "token",
                data.token
            );

            return data;
        } catch (error) {
            if (error.response?.data?.needsVerification) {
                const err = new Error("Account not verified");
                err.needsVerification = true;
                throw err;
            }
            const message =
                error.response?.data?.message ||
                error.message ||
                "Login failed";

            throw new Error(message);
        }
    };

    // ==========================================
    // CLIENT REGISTRATION
    // ==========================================
    const register = async (
        name,
        email,
        password,
        companyName = "",
        phone = ""
    ) => {
        try {
            const { data } = await api.post(
                "/auth/register",
                {
                    name,
                    email,
                    password,
                    companyName,
                    phone,
                }
            );

            return data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Registration failed";

            throw new Error(message);
        }
    };

    // ==========================================
    // VERIFY OTP
    // ==========================================
    const verifyOTP = async (email, otp) => {
        try {
            const { data } = await api.post(
                "/auth/verify-otp",
                {
                    email,
                    otp,
                }
            );

            setUser(data);

            localStorage.setItem(
                "userInfo",
                JSON.stringify(data)
            );

            localStorage.setItem(
                "token",
                data.token
            );

            return data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "OTP verification failed";

            throw new Error(message);
        }
    };

    // ==========================================
    // EMAIL CODE SIGN-IN (passwordless)
    // ==========================================
    const requestLoginOtp = async (email, portal = null) => {
        try {
            const { data } = await api.post("/auth/login-otp/request", {
                email,
                ...(portal ? { portal } : {}),
            });
            return data.message;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Could not send the code");
        }
    };

    const verifyLoginOtp = async (email, otp, portal = null) => {
        try {
            const { data } = await api.post("/auth/login-otp/verify", {
                email,
                otp,
                ...(portal ? { portal } : {}),
            });

            // same session storage as the password login
            setUser(data);
            localStorage.setItem("userInfo", JSON.stringify(data));
            localStorage.setItem("token", data.token);
            return data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Code verification failed");
        }
    };

    // ==========================================
    // LOGOUT
    // ==========================================
    const logout = () => {
        setUser(null);

        localStorage.removeItem("userInfo");
        localStorage.removeItem("token");
    };

    // ==========================================
    // ROLE HELPERS
    // ==========================================

    const isAdmin = user?.role === "admin";

    const isManager = user?.role === "manager";

    const isClient = user?.role === "client";

    const isAuthenticated = !!user;

    // ==========================================
    // CONTEXT
    // ==========================================

    return (
        <AuthContext.Provider
            value={{
                user,
                setUser,

                login,
                register,
                verifyOTP,
                requestLoginOtp,
                verifyLoginOtp,
                logout,

                isAdmin,
                isManager,
                isClient,
                isAuthenticated,

                loading,
            }}
        >
            {!loading && children}
        </AuthContext.Provider>
    );
};