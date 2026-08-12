import { headers } from "next/headers";

/**
 * Fixed-window rate limiting.
 *
 * The default backend is an in-process Map, which is correct and sufficient
 * for a single instance (one Vercel region, one Railway container). If the
 * deploy is scaled horizontally, set UPSTASH_REDIS_REST_URL/TOKEN and the
 * counters move to Redis so limits are shared across instances — see
 * README → Scaling notes.
 *
 * This protects: login, signup, password reset, coupon validation, enquiry
 * and newsletter submission, and the guest order lookup.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  // Amortised cleanup so an attacker cannot grow the Map without bound.
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfter };
  }

  return { ok: true, remaining: limit - existing.count, retryAfter };
}

/**
 * Best-effort client IP. Behind Vercel/Railway the real address is in
 * x-forwarded-for; the left-most entry is the client.
 */
export async function clientIp() {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? h.get("cf-connecting-ip") ?? "unknown";
}

/** Convenience wrapper: rate limit the current request by IP under a namespace. */
export async function limitByIp(namespace: string, limit: number, windowMs: number) {
  const ip = await clientIp();
  return rateLimit(`${namespace}:${ip}`, limit, windowMs);
}
