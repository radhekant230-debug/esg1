/**
 * Small in-memory fixed-window rate limiter (no extra dependency).
 * Counts are per server process: on a single Render instance this is exact;
 * with several instances each enforces its own limit.
 *
 *   router.post("/x", rateLimit({ name: "x", windowMs: 15 * 60e3, max: 10, key: (req) => req.ip }), handler)
 */
const buckets = new Map(); // name -> Map(key -> { count, resetAt })

function rateLimit({ name, windowMs, max, key = (req) => req.ip, message = "Too many requests. Please wait and try again." }) {
  if (!buckets.has(name)) buckets.set(name, new Map());
  const store = buckets.get(name);
  return (req, res, next) => {
    const k = String(key(req) || "unknown");
    const now = Date.now();
    let b = store.get(k);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + windowMs };
      store.set(k, b);
    }
    b.count += 1;
    if (b.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((b.resetAt - now) / 1000)));
      return res.status(429).json({ message });
    }
    return next();
  };
}

// drop expired windows so memory stays bounded
const sweep = setInterval(() => {
  const now = Date.now();
  buckets.forEach((store) => store.forEach((b, k) => b.resetAt <= now && store.delete(k)));
}, 60 * 1000);
if (sweep.unref) sweep.unref();

/** Test helper: clears all counters. */
rateLimit._reset = () => buckets.forEach((s) => s.clear());

const bodyId = (req) => String((req.body && (req.body.email || req.body.loginId || req.body.clientId || req.body.username)) || "").trim().toLowerCase();

module.exports = { rateLimit, bodyId };
