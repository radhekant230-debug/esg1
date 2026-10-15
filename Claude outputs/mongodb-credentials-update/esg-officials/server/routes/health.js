/**
 * Health endpoints (no authentication, no secrets).
 *
 *   GET /api/health/live   process is up (liveness)            -> always 200
 *   GET /api/health        ready to serve database-backed APIs -> 200 or 503
 *   GET /api/health/ready  same as /api/health
 *
 * Responses contain only booleans, states, timings and stable error codes —
 * never the connection string, user name, password, host or raw driver errors.
 */
const express = require("express");
const db = require("../config/db");

const router = express.Router();
const started = Date.now();

router.get("/live", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "ok", uptimeSec: Math.round((Date.now() - started) / 1000) });
});

async function readiness(req, res) {
  const config = db.configStatus();
  const snap = db.healthSnapshot();
  const ping = snap.connected ? await db.pingDB(2000) : { ok: false, latencyMs: null };
  const configOk = config.MONGO_URI && config.MONGO_URI_valid && config.JWT_SECRET;
  const ready = configOk && snap.connected && ping.ok && db.isReady();
  let status = "ok";
  if (!ready) status = snap.connected && ping.ok ? "starting" : snap.status === "connecting" || snap.lastErrorCode ? "degraded" : "unavailable";
  if (!configOk) status = "misconfigured";

  res.setHeader("Cache-Control", "no-store");
  res.status(ready ? 200 : 503).json({
    status,
    ready,
    uptimeSec: Math.round((Date.now() - started) / 1000),
    checks: {
      config,
      database: {
        status: snap.status,
        reachable: ping.ok,
        latencyMs: ping.latencyMs,
        lastErrorCode: snap.lastErrorCode,
        reconnects: snap.reconnects,
      },
      startupTasksComplete: snap.bootstrapped,
    },
    timestamp: new Date().toISOString(),
  });
}

router.get("/", readiness);
router.get("/ready", readiness);

module.exports = router;
