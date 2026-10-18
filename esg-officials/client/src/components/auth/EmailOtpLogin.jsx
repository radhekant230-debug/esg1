import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/AuthContext";

// Visual presets matching each login page
const THEMES = {
    light: {
        label: "text-gray-700",
        input: "w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900",
        button: "w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black transition disabled:opacity-60 cursor-pointer",
        link: "text-gray-700 hover:text-gray-900 underline",
        note: "text-gray-500",
        info: "bg-gray-50 border border-gray-200 text-gray-700",
        error: "bg-red-50 border border-red-100 text-red-600",
    },
    emerald: {
        label: "text-stone-300",
        input: "w-full px-4 py-3 bg-[#0B100E] border border-stone-700 rounded-xl text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500",
        button: "w-full bg-emerald-500 text-black font-bold py-3 rounded-xl hover:bg-emerald-400 transition disabled:opacity-60 cursor-pointer",
        link: "text-emerald-400 hover:text-emerald-300 underline",
        note: "text-stone-500",
        info: "bg-emerald-950/40 border border-emerald-800/60 text-emerald-200",
        error: "bg-red-950/60 border border-red-800/80 text-red-200",
    },
    amber: {
        label: "text-stone-300",
        input: "w-full px-4 py-3 bg-[#0F1115] border border-stone-700 rounded-xl text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500",
        button: "w-full bg-amber-500 text-black font-bold py-3 rounded-xl hover:bg-amber-400 transition disabled:opacity-60 cursor-pointer",
        link: "text-amber-400 hover:text-amber-300 underline",
        note: "text-stone-500",
        info: "bg-amber-950/40 border border-amber-800/60 text-amber-200",
        error: "bg-red-950/60 border border-red-800/80 text-red-200",
    },
    purple: {
        label: "text-stone-300",
        input: "w-full px-4 py-3 bg-[#0E1015] border border-stone-700 rounded-xl text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500",
        button: "w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-500 transition disabled:opacity-60 cursor-pointer",
        link: "text-purple-300 hover:text-purple-200 underline",
        note: "text-stone-500",
        info: "bg-purple-950/40 border border-purple-800/60 text-purple-200",
        error: "bg-red-950/60 border border-red-800/80 text-red-200",
    },
};

const RESEND_SECONDS = 60;

/**
 * Passwordless sign-in: email -> 6-digit code -> the same login token and
 * session as the password login. `portal` limits which roles may sign in here.
 */
export default function EmailOtpLogin({ portal = null, theme = "light", onSuccess, onUsePassword }) {
    const t = THEMES[theme] || THEMES.light;
    const { requestLoginOtp, verifyLoginOtp } = useContext(AuthContext);
    const [step, setStep] = useState("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [info, setInfo] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [wait, setWait] = useState(0);

    useEffect(() => {
        if (wait <= 0) return undefined;
        const id = setTimeout(() => setWait((w) => w - 1), 1000);
        return () => clearTimeout(id);
    }, [wait]);

    const send = async (e) => {
        if (e) e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const message = await requestLoginOtp(email.trim(), portal);
            setInfo(message);
            setStep("code");
            setCode("");
            setWait(RESEND_SECONDS);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const verify = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const data = await verifyLoginOtp(email.trim(), code.trim(), portal);
            onSuccess(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-5">
            {error && <div className={`p-3 rounded-lg text-sm ${t.error}`} role="alert">{error}</div>}
            {info && step === "code" && <div className={`p-3 rounded-lg text-sm ${t.info}`} role="status">{info}</div>}

            {step === "email" ? (
                <form onSubmit={send} className="space-y-5">
                    <div>
                        <label htmlFor="otp-email" className={`block text-xs font-semibold mb-2 ${t.label}`}>Email address</label>
                        <input id="otp-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={t.input} />
                    </div>
                    <button type="submit" disabled={loading || !email.trim()} className={t.button}>
                        {loading ? "Sending..." : "Email me a sign-in code"}
                    </button>
                </form>
            ) : (
                <form onSubmit={verify} className="space-y-5">
                    <div>
                        <label htmlFor="otp-code" className={`block text-xs font-semibold mb-2 ${t.label}`}>6-digit code sent to {email.trim()}</label>
                        <input
                            id="otp-code"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            required
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="••••••"
                            className={`${t.input} tracking-[0.5em] text-center text-lg font-mono`}
                        />
                    </div>
                    <button type="submit" disabled={loading || code.length !== 6} className={t.button}>
                        {loading ? "Verifying..." : "Verify & sign in"}
                    </button>
                    <div className={`flex justify-between text-xs ${t.note}`}>
                        <button type="button" className={t.link} onClick={() => { setStep("email"); setError(""); }}>Change email</button>
                        {wait > 0 ? (
                            <span>Resend in {wait}s</span>
                        ) : (
                            <button type="button" className={t.link} onClick={() => send()} disabled={loading}>Resend code</button>
                        )}
                    </div>
                </form>
            )}

            {onUsePassword && (
                <p className={`text-center text-xs ${t.note}`}>
                    <button type="button" className={t.link} onClick={onUsePassword}>Sign in with password instead</button>
                </p>
            )}
        </div>
    );
}
