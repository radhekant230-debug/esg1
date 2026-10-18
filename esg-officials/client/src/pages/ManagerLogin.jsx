import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import EmailOtpLogin from "../components/auth/EmailOtpLogin";
import { dashboardPath } from "../utils/dashboardPath";
import { useNavigate, Link } from "react-router-dom";
import { FaUserTie, FaLock, FaArrowLeft, FaEye, FaEyeSlash, FaBriefcase } from "react-icons/fa";

const ManagerLogin = () => {
    const [loginId, setLoginId] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { login, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [useEmailCode, setUseEmailCode] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const data = await login(loginId.trim(), password, "manager");

            if (data.role !== "manager" && data.role !== "admin") {
                logout();
                setError("Access denied: This portal is reserved for Account & Growth Managers.");
                return;
            }

            navigate("/manager/dashboard");
        } catch (err) {
            setError(
                err?.message ||
                "Authentication failed. Please verify manager credentials."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0F1117] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-purple-500 selection:text-white">
            {/* Ambient purple glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

            {/* Back link */}
            <div className="w-full max-w-md mb-6 z-10 flex justify-between items-center">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-stone-400 hover:text-purple-400 transition"
                >
                    <FaArrowLeft className="w-3 h-3" />
                    Back to ESG Officials Home
                </Link>
                <span className="text-[11px] font-mono uppercase tracking-widest text-purple-400 font-bold px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                    Manager Access
                </span>
            </div>

            {/* Main Card */}
            <div className="w-full max-w-md bg-[#171923] border border-stone-800 rounded-2xl shadow-2xl p-8 z-10 relative overflow-hidden backdrop-blur-sm">
                {/* Purple Top Accent Bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-700 via-purple-500 to-indigo-600" />

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-600/10 border border-purple-500/30 text-purple-400 mb-4 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                        <FaUserTie className="w-7 h-7" />
                    </div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight">
                        ESG Manager Portal
                    </h1>
                    <p className="text-xs text-stone-400 mt-1 font-mono uppercase tracking-wider">
                        Account Strategy, Projects &amp; Client Growth
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
                {useEmailCode ? (
                    <EmailOtpLogin portal={"manager"} theme="purple" onSuccess={(data) => navigate(dashboardPath(data.role))} onUsePassword={() => setUseEmailCode(false)} />
                ) : (
                <>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-mono uppercase tracking-wider text-stone-300 font-semibold mb-2">
                            Work Email / Manager ID
                        </label>
                        <input
                            type="text"
                            required
                            autoComplete="username"
                            placeholder="rahul.manager@esgofficial.com"
                            className="w-full px-4 py-3 bg-[#0E1015] border border-stone-700 rounded-xl text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition shadow-inner"
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
                                className="w-full px-4 py-3 pr-11 bg-[#0E1015] border border-stone-700 rounded-xl text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition shadow-inner"
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
                        className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-purple-600/25 transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Authenticating...
                            </>
                        ) : (
                            <>
                                <FaBriefcase className="w-3.5 h-3.5" />
                                Sign In to Manager Portal
                            </>
                        )}
                    </button>
                </form>
                <p className="text-center text-xs mt-4">
                    <button type="button" className="text-stone-400 hover:text-stone-200 underline cursor-pointer" onClick={() => setUseEmailCode(true)}>
                        Sign in with an email code instead
                    </button>
                </p>
                <p className="text-center text-xs mt-2">
                    <Link to="/forgot-password" className="text-stone-400 hover:text-stone-200 underline">Forgot password?</Link>
                </p>
                </>
                )}

                {/* Footer Links */}
                <div className="mt-8 pt-6 border-t border-stone-800 text-center">
                    <p className="text-[11px] text-stone-500 leading-relaxed font-mono">
                        Assigned client portfolio and task collaboration portal for agency managers.
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

export default ManagerLogin;
