import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { FaShieldAlt, FaLock, FaUserShield, FaArrowLeft, FaEye, FaEyeSlash } from "react-icons/fa";

const AdminLogin = () => {
    const [loginId, setLoginId] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { login, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const data = await login(loginId.trim(), password, "admin");

            if (data.role !== "admin") {
                logout();
                setError("Access denied: This portal is restricted to authorized ESG Administrators.");
                return;
            }

            navigate("/admin/dashboard");
        } catch (err) {
            setError(
                err?.message ||
                "Authentication failed. Please verify administrator credentials."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0D0F12] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-amber-500 selection:text-black">
            {/* Ambient executive glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Back link */}
            <div className="w-full max-w-md mb-6 z-10 flex justify-between items-center">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-stone-400 hover:text-amber-400 transition"
                >
                    <FaArrowLeft className="w-3 h-3" />
                    Back to ESG Officials Home
                </Link>
                <span className="text-[11px] font-mono uppercase tracking-widest text-amber-500/80 font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                    Restricted Area
                </span>
            </div>

            {/* Main Admin Card */}
            <div className="w-full max-w-md bg-[#16191E] border border-stone-800 rounded-2xl shadow-2xl p-8 z-10 relative overflow-hidden backdrop-blur-sm">
                {/* Gold Top Accent Bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-700" />

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border border-amber-500/30 text-amber-400 mb-4 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                        <FaShieldAlt className="w-7 h-7" />
                    </div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight">
                        ESG Administrator Portal
                    </h1>
                    <p className="text-xs text-stone-400 mt-1 font-mono uppercase tracking-wider">
                        Executive Operations &amp; Client Governance
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
                    <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 font-semibold mb-2">
                            Administrator Email / ID
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                required
                                autoComplete="username"
                                placeholder="admin@esgofficial.com"
                                className="w-full px-4 py-3 bg-[#0F1115] border border-stone-700 rounded-xl text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition shadow-inner"
                                value={loginId}
                                onChange={(e) => setLoginId(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 font-semibold mb-2">
                            Administrator Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                autoComplete="current-password"
                                placeholder="••••••••••••"
                                className="w-full px-4 py-3 pr-11 bg-[#0F1115] border border-stone-700 rounded-xl text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition shadow-inner"
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

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20 transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                Authenticating...
                            </>
                        ) : (
                            <>
                                <FaLock className="w-3.5 h-3.5" />
                                Sign In to Admin Portal
                            </>
                        )}
                    </button>
                </form>

                {/* Security Footer Note */}
                <div className="mt-8 pt-6 border-t border-stone-800 text-center">
                    <p className="text-[11px] text-stone-500 leading-relaxed font-mono">
                        This system is strictly for authorized ESG Administrators. All access attempts are recorded.
                    </p>

                    {/* Portal Switchers */}
                    <div className="mt-4 pt-4 border-t border-stone-800/60 flex items-center justify-center gap-4 text-xs font-mono">
                        <Link
                            to="/manager/login"
                            className="text-stone-400 hover:text-purple-400 transition"
                        >
                            Manager Portal &rarr;
                        </Link>
                        <span className="text-stone-700">|</span>
                        <Link
                            to="/client/login"
                            className="text-stone-400 hover:text-emerald-400 transition"
                        >
                            Client Portal &rarr;
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
