import { useEffect, useRef, useState } from "react";
import api from "../utils/axios";

/**
 * Keeps the Client Portal in sync with manager uploads without a page reload.
 * Polls the lightweight /portal/sync-status endpoint (every 30s, and whenever
 * the tab regains focus). When the server-side version changes — a manager
 * imported, replaced or deleted this client's sales data — `onChange` runs so
 * the dashboard refetches the same saved records.
 */
export default function usePortalSync({ clientId = "", enabled = true, onChange, intervalMs = 30000 }) {
  const versionRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [status, setStatus] = useState({ lastUpdatedLabel: "", updatedNotice: false, checkedAt: null });

  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled) return undefined;
    versionRef.current = null;
    let stopped = false;
    let inFlight = false;

    const check = async () => {
      if (stopped || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const res = await api.get("/portal/sync-status", { params: clientId ? { clientId } : {} });
        const { version, lastUpdatedLabel } = res.data || {};
        if (versionRef.current && version && version !== versionRef.current) {
          await (onChangeRef.current && onChangeRef.current());
          setStatus({ lastUpdatedLabel, updatedNotice: true, checkedAt: new Date() });
        } else {
          setStatus((s) => ({ ...s, lastUpdatedLabel, checkedAt: new Date() }));
        }
        if (version) versionRef.current = version;
      } catch (_) {
        // network blips are ignored; the next tick retries
      } finally {
        inFlight = false;
      }
    };

    check();
    const timer = setInterval(check, intervalMs);
    const onVisible = () => document.visibilityState === "visible" && check();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [clientId, enabled, intervalMs]);

  const dismiss = () => setStatus((s) => ({ ...s, updatedNotice: false }));
  return { ...status, dismiss };
}
