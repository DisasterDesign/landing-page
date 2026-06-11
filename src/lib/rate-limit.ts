const rateMap = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30; // 30 requests per minute per IP

export function rateLimit(
  key: string,
  maxRequests: number = MAX_REQUESTS
): { ok: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: maxRequests - 1 };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return { ok: false, remaining: 0 };
  }

  return { ok: true, remaining: maxRequests - entry.count };
}

// Cleanup stale entries periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateMap) {
      if (now > value.resetAt) {
        rateMap.delete(key);
      }
    }
  }, 5 * 60 * 1000); // every 5 minutes
}
