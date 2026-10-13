/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * State lives in the server process, so limits are per instance. For a
 * multi-instance or serverless deployment, replace this with a shared store
 * (e.g. Redis / Upstash) or an edge/WAF rate limit.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the next request is allowed (0 when allowed). */
  retryAfter: number;
}

export function createRateLimiter(options: { limit: number; windowMs: number; now?: () => number }) {
  const { limit, windowMs } = options;
  const now = options.now ?? Date.now;
  const hits = new Map<string, number[]>();
  const MAX_KEYS = 10_000;

  return {
    check(key: string): RateLimitResult {
      const t = now();
      const windowStart = t - windowMs;
      const recent = (hits.get(key) ?? []).filter((ts) => ts > windowStart);

      if (recent.length >= limit) {
        hits.set(key, recent);
        return {
          allowed: false,
          remaining: 0,
          retryAfter: Math.max(1, Math.ceil((recent[0] + windowMs - t) / 1000)),
        };
      }

      recent.push(t);
      hits.set(key, recent);

      // Prevent unbounded growth: drop the oldest keys.
      if (hits.size > MAX_KEYS) {
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }

      return { allowed: true, remaining: limit - recent.length, retryAfter: 0 };
    },
  };
}

/** Best-effort client identifier. Only trust these headers behind a proxy you control. */
export function getClientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "anonymous";
}
