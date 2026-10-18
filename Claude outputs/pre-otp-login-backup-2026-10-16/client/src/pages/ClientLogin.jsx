import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { FaChartLine, FaLock, FaArrowLeft, FaEye, FaEyeSlash, FaBuilding } from "react-icons/fa";

const ClientLogin = () => {
    const [loginId, setLoginId] = useState("");
    const [password, setPassword] = useState("");
    const [otp, setOtp] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [showOTP, setShowOTP] = useState(false);

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { login, verifyOTP } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            if (!showOTP) {
                const data = await login(loginId.trim(), password, "client");

                if (data.role === "client") {
                    navigate("/client/dashboard");
                } else if (data.role === "manager") {
                    navigate("/manager/dashboard");
                } else if (data.role === "admin") {
                    navigate("/admin/dashboard");
                } else {
                    navigate("/client/dashboard");
                }
            } else {
                const data = await verifyOTP(loginId, otp);
                if (data.role === "client") {
                    navigate("/client/dashboard");
                } else {
                    navigate("/client/dashboard");
                }
            }
        } catch (err) {
            if (err?.needsVerification) {
                setShowOTP(true);
                setError("Account verification required. A 6-digit verification code has been sent to your email.");
            } else {
                setError(
                    err?.message ||
                    "Invalid credentials. Please verify your client email or Client ID and password."
                );
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0C1210] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-emerald-500 selection:text-black">
            {/* Ambient emerald glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

            {/* Back link */}
            <div className="w-full max-w-md mb-6 z-10 flex justify-between items-center">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-stone-400 hover:text-emerald-400 transition"
                >
                    <FaArrowLeft className="w-3 h-3" />
                    Back to ESG Officials Home
                </Link>
                <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    Client Portal
                </span>
            </div>

            {/* Main Card */}
            <div className="w-full max-w-md bg-[#131B17] border border-emerald-900/40 rounded-2xl shadow-2xl p-8 z-10 relative overflow-hidden backdrop-blur-sm">
                {/* Emerald Top Accent Bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 via-teal-400 to-emerald-700" />

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/10 border border-emerald-500/30 text-emerald-400 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                        <FaChartLine className="w-7 h-7" />
                    </div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight">
                        ESG Client Portal
                    </h1>
                    <p className="text-xs text-stone-400 mt-1 font-mono uppercase tracking-wider">
                        Business Growth, Reports &amp; ROI Analytics
                    </p>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs font-medium flex items-start gap-3">
                        <span className="text-red-400 text-base leading-none">⚠</span>
                        <div className="flex-1">{error}</div>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {!showOTP ? (
                        <>
                            <div>
                                <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 font-semibold mb-2">
                                    Email Address or Client ID
                                </label>
                                <input
                                    type="text"
                                    required
                                    autoComplete="username"
                                    placeholder="e.g. cafemysa@client.com or CLI-2026-0002"
                                    className="w-full px-4 py-3 bg-[#0B100E] border border-stone-700 rounded-xl text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition shadow-inner"
                                    value={loginId}
                                    onChange={(e) => setLoginId(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 font-semibold mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        autoComplete="current-password"
                                        placeholder="••••••••••••"
                                        className="w-full px-4 py-3 pr-11 bg-[#0B100E] border border-stone-700 rounded-xl text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition shadow-inner"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 transition"
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? (
                                            <FaEyeSlash className="w-4 h-4" />
                                        ) : (
                                            <FaEye className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* OTP Verification State */
                        <div>
                            <label className="block text-xs font-mono uppercase tracking-wider text-emerald-300 font-semibold mb-2 text-center">
                                Enter 6-Digit Email Verification Code
                            </label>
                            <input
                                type="text"
                                required
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                placeholder="123456"
                                className="w-full px-4 py-3 bg-[#0B100E] border border-emerald-600 rounded-xl text-white font-mono font-bold tracking-widest text-center text-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition shadow-inner"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            />
                            <p className="text-xs text-stone-400 text-center mt-2 font-mono">
                                A verification code has been dispatched to your email address.
                            </p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-600/25 transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                {showOTP ? "Verifying OTP..." : "Authenticating..."}
                            </>
                        ) : (
                            <>
                                <FaBuilding className="w-3.5 h-3.5" />
                                {showOTP ? "Verify & Enter Portal" : "Sign In to Client Portal"}
                            </>
                        )}
                    </button>
                </form>

                {/* Footer Links */}
                <div className="mt-8 pt-6 border-t border-stone-800 text-center">
                    <p className="text-xs text-stone-400">
                        New business client?{" "}
                        <Link to="/register" className="text-emerald-400 font-bold hover:underline">
                            Request Portal Access
                        </Link>
                    </p>

                    <div className="mt-4 pt-4 border-t border-stone-800/60 flex items-center justify-center gap-4 text-xs font-mono">
                        <Link
                            to="/admin/login"
                            className="text-stone-400 hover:text-amber-400 transition"
                        >
                            Admin Portal &rarr;
                        </Link>
                        <span className="text-stone-700">|</span>
                        <Link
                            to="/manager/login"
                            className="text-stone-400 hover:text-purple-400 transition"
                        >
                            Manager Portal &rarr;
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientLogin;
