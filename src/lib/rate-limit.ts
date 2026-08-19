import { headers } from "next/headers";
import { env } from "./env";

/**
 * Fixed-window rate limiting, shared across instances when Redis is available.
 *
 * TWO BACKENDS, and the difference matters more than it looks.
 *
 * The in-process Map is correct for exactly one instance. On Vercel it is not
 * one instance: functions scale out, so each concurrent instance keeps its own
 * counters and the effective limit is (limit x instances). An attacker does not
 * even need to try — ordinary traffic spread across instances quietly gets
 * several times the intended allowance, and the busier you are the weaker the
 * limit becomes.
 *
 * This file's header used to claim that setting UPSTASH_REDIS_REST_URL/TOKEN
 * moved counters to Redis. It did not: there was no Redis code here at all, the
 * variables were declared in env.ts and read by nothing, and setting them
 * changed nothing whatsoever. The documented scaling story was fiction. This is
 * the implementation that makes it true.
 *
 * Redis is used when configured and the Map is the fallback, so an unreachable
 * Redis degrades to per-instance limiting rather than to no limiting.
 *
 * Protects: login, signup, password reset, OTP send, coupon validation,
 * enquiry and newsletter submission, checkout, and the guest order lookup.
 */

/** Upstash REST credentials, under whichever names the platform created. */
const redis = {
  url: (env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, ""),
  token: env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || "",
};

export const rateLimitBackend = redis.url && redis.token ? "redis" : "memory";

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

/**
 * The shared-counter path. Falls back to the in-process Map.
 *
 * One pipelined round trip does the whole fixed window:
 *   INCR                  — the counter, created at 1 on first hit
 *   PEXPIRE key ms NX     — set the window ONLY if the key has no TTL yet, so
 *                           later hits inside the window cannot extend it (a
 *                           plain PEXPIRE would turn a fixed window into a
 *                           sliding one that never resets under sustained load)
 *   PTTL                  — what is left, for an honest Retry-After
 *
 * No SDK: this is two fetch calls' worth of protocol and adding a dependency
 * for it would be the larger change.
 */
export async function rateLimitShared(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (rateLimitBackend !== "redis") return rateLimit(key, limit, windowMs);

  try {
    const res = await fetch(`${redis.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redis.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["PEXPIRE", key, windowMs, "NX"],
        ["PTTL", key],
      ]),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);

    const parsed = (await res.json()) as Array<{ result?: number; error?: string }>;
    const count = Number(parsed[0]?.result);
    const ttlMs = Number(parsed[2]?.result);
    if (!Number.isFinite(count)) throw new Error("Upstash returned no counter");

    // PTTL answers -1 (no expiry) or -2 (gone) in races; treat both as a full
    // window rather than reporting a negative Retry-After.
    const remainingMs = ttlMs > 0 ? ttlMs : windowMs;
    const retryAfter = Math.max(1, Math.ceil(remainingMs / 1000));

    if (count > limit) return { ok: false, remaining: 0, retryAfter };
    return { ok: true, remaining: Math.max(0, limit - count), retryAfter: 0 };
  } catch (err) {
    // Degrade, never open. A Redis outage must not become an open door on
    // login and checkout, so this falls back to per-instance limiting.
    console.error("[rate-limit] Redis unavailable, using in-process counters:", err);
    return rateLimit(key, limit, windowMs);
  }
}

/** Convenience wrapper: rate limit the current request by IP under a namespace. */
export async function limitByIp(namespace: string, limit: number, windowMs: number) {
  const ip = await clientIp();
  return rateLimitShared(`${namespace}:${ip}`, limit, windowMs);
}
