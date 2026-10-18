import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../utils/axios";

const RESEND_SECONDS = 60;

/**
 * Forgot password: 1) email -> reset code, 2) code + new password.
 * The server answers the same way whether or not the email is registered.
 */
export default function ForgotPassword() {
    const navigate = useNavigate();
    const [step, setStep] = useState("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [info, setInfo] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [wait, setWait] = useState(0);

    useEffect(() => {
        if (wait <= 0) return undefined;
        const id = setTimeout(() => setWait((w) => w - 1), 1000);
        return () => clearTimeout(id);
    }, [wait]);

    const requestCode = async (e) => {
        if (e) e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const { data } = await api.post("/auth/password/forgot", { email: email.trim() });
            setInfo(data.message);
            setStep("reset");
            setWait(RESEND_SECONDS);
        } catch (err) {
            setError(err.response?.data?.message || "Could not send the code. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const reset = async (e) => {
        e.preventDefault();
        setError("");
        if (password !== confirm) return setError("The two passwords do not match.");
        setLoading(true);
        try {
            const { data } = await api.post("/auth/password/reset", { email: email.trim(), otp: code.trim(), newPassword: password });
            setStep("done");
            setInfo(data.message);
        } catch (err) {
            setError(err.response?.data?.message || "Could not reset the password.");
        } finally {
            setLoading(false);
        }
    };

    const input = "w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900";
    const button = "w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black transition disabled:opacity-60 cursor-pointer";

    return (
        <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
            <div className="mb-4">
                <Link to="/login" className="text-xs uppercase tracking-wider text-gray-500 hover:text-gray-900 font-mono">&larr; Back to sign in</Link>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Reset your password</h2>
            <p className="text-gray-500 text-sm mb-6">We'll email a code to the address registered on your account.</p>

            {error && <div role="alert" className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm border border-red-100">{error}</div>}
            {info && step !== "email" && <div role="status" className="bg-gray-50 text-gray-700 p-3 rounded-lg mb-4 text-sm border border-gray-200">{info}</div>}

            {step === "email" && (
                <form onSubmit={requestCode} className="space-y-5">
                    <div>
                        <label htmlFor="fp-email" className="block text-xs font-semibold text-gray-700 mb-2">Registered email</label>
                        <input id="fp-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
                    </div>
                    <button type="submit" disabled={loading || !email.trim()} className={button}>{loading ? "Sending..." : "Email me a reset code"}</button>
                </form>
            )}

            {step === "reset" && (
                <form onSubmit={reset} className="space-y-5">
                    <div>
                        <label htmlFor="fp-code" className="block text-xs font-semibold text-gray-700 mb-2">Code sent to {email.trim()}</label>
                        <input id="fp-code" inputMode="numeric" autoComplete="one-time-code" required maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} className={`${input} tracking-[0.4em] text-center font-mono`} />
                    </div>
                    <div>
                        <label htmlFor="fp-new" className="block text-xs font-semibold text-gray-700 mb-2">New password</label>
                        <input id="fp-new" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
                        <p className="text-xs text-gray-500 mt-1">At least 8 characters, with letters and numbers.</p>
                    </div>
                    <div>
                        <label htmlFor="fp-confirm" className="block text-xs font-semibold text-gray-700 mb-2">Confirm new password</label>
                        <input id="fp-confirm" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
                    </div>
                    <button type="submit" disabled={loading || !code || !password} className={button}>{loading ? "Saving..." : "Set new password"}</button>
                    <div className="flex justify-between text-xs text-gray-500">
                        <button type="button" className="underline" onClick={() => { setStep("email"); setError(""); }}>Change email</button>
                        {wait > 0 ? <span>Resend in {wait}s</span> : <button type="button" className="underline" onClick={() => requestCode()}>Resend code</button>}
                    </div>
                </form>
            )}

            {step === "done" && (
                <button type="button" className={button} onClick={() => navigate("/login")}>Go to sign in</button>
            )}
        </div>
    );
}
