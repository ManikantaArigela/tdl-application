/**
 * Tiny fixed-window rate limiter for credential endpoints.
 *
 * State lives in process memory, so it is a best-effort guard for a single
 * backend instance. For multi-instance deployments put a shared limiter (Redis,
 * API gateway) in front of /api/auth.
 */
function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 20 } = {}) {
  const hits = new Map();

  return function limit(key) {
    const now = Date.now();

    // Opportunistic cleanup so the map cannot grow without bound.
    if (hits.size > 5_000) {
      for (const [entryKey, entry] of hits) {
        if (entry.resetAt <= now) hits.delete(entryKey);
      }
    }

    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return 0;
    }

    entry.count += 1;
    if (entry.count > max) {
      return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    }
    return 0;
  };
}

module.exports = { createRateLimiter };
