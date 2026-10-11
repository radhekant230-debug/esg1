import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

const Login = () => {
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
                const data = await login(loginId, password);

                // Redirect according to role
                if (data.role === "admin") {
                    navigate("/admin");
                } else if (data.role === "manager") {
                    navigate("/manager");
                } else if (data.role === "client") {
                    navigate("/portal");
                } else {
                    setError("Invalid user role.");
                }
            } else {
                const data = await verifyOTP(loginId, otp);

                // Redirect according to role
                if (data.role === "admin") {
                    navigate("/admin");
                } else if (data.role === "manager") {
                    navigate("/manager");
                } else if (data.role === "client") {
                    navigate("/portal");
                } else {
                    setError("Invalid user role.");
                }
            }
        } catch (err) {
            if (err?.needsVerification) {
                setShowOTP(true);
                setError(
                    "Account not verified. A new OTP has been sent to your email."
                );
            } else {
                setError(
                    err?.message ||
                    err ||
                    "Invalid credentials. Please verify your details."
                );
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-xl shadow-lg border border-gray-100">

            <div className="mb-4">
                <Link to="/" className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-gray-500 hover:text-gray-900 transition font-mono">
                    &larr; Back to ESG Officials
                </Link>
            </div>

            {/* Header */}
            <div className="text-center mb-6">
                <h2 className="text-3xl font-extrabold text-gray-900 mb-2">
                    ESG Portal Login
                </h2>

                <p className="text-gray-500 text-sm">
                    Sign in to access your Admin, Manager, or Client Dashboard
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-center shadow-inner border border-red-100 text-sm font-medium">
                    {error}
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="space-y-6"
            >
                {!showOTP ? (
                    <>
                        {/* Email or Client ID */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Email Address or Client ID
                            </label>

                            <input
                                type="text"
                                required
                                autoComplete="username"
                                placeholder="e.g. name@company.com or CLI-2026-0001"
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 transition shadow-sm outline-none"
                                value={loginId}
                                onChange={(e) =>
                                    setLoginId(e.target.value)
                                }
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Password
                            </label>

                            <div className="relative">
                                <input
                                    type={
                                        showPassword
                                            ? "text"
                                            : "password"
                                    }
                                    required
                                    autoComplete="current-password"
                                    placeholder="Enter your password"
                                    className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 transition shadow-sm outline-none"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                />

                                {/* Eye Button */}
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword(
                                            !showPassword
                                        )
                                    }
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 transition"
                                    aria-label={
                                        showPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                >
                                    {showPassword ? (
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            strokeWidth={1.8}
                                            stroke="currentColor"
                                            className="w-5 h-5"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M3.98 8.223A10.477 10.477 0 001.5 12s3.5 6.5 10.5 6.5c1.61 0 3.05-.36 4.32-.92M6.228 6.228C7.85 5.14 9.76 4.5 12 4.5c7 0 10.5 7.5 10.5 7.5a18.04 18.04 0 01-3.058 4.174M6.228 6.228L3 3m3.228 3.228l3.12 3.12m5.424 5.424L21 21m-6.228-6.228a3 3 0 11-4.243-4.243"
                                            />
                                        </svg>
                                    ) : (
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            strokeWidth={1.8}
                                            stroke="currentColor"
                                            className="w-5 h-5"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M2.25 12s3.5-7.5 9.75-7.5S21.75 12 21.75 12 18.25 19.5 12 19.5 2.25 12 2.25 12z"
                                            />
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                            />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    /* OTP */
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Verification Code (OTP)
                        </label>

                        <input
                            type="text"
                            required
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="6-digit code"
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-700 focus:border-gray-700 transition shadow-sm font-bold tracking-widest text-center text-lg outline-none"
                            value={otp}
                            onChange={(e) =>
                                setOtp(
                                    e.target.value
                                        .replace(/\D/g, "")
                                        .slice(0, 6)
                                )
                            }
                            maxLength={6}
                        />

                        <p className="text-xs text-gray-500 text-center mt-2">
                            Enter the 6-digit code sent to your email.
                        </p>
                    </div>
                )}

                {/* Submit */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black focus:ring-4 focus:ring-gray-200 transition shadow-md disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                    {loading
                        ? "Processing..."
                        : showOTP
                        ? "Verify OTP & Log In"
                        : "Sign In"}
                </button>
            </form>

            {/* Register */}
            <p className="text-center mt-8 text-gray-600">
                Don't have an account?{" "}
                <Link
                    to="/register"
                    className="text-gray-900 font-bold hover:underline"
                >
                    Sign up
                </Link>
            </p>
        </div>
    );
};

export default Login;