// Login brute-force protection.
//
// On Cloudflare Workers, requests are spread across many short-lived isolates,
// so an in-memory counter is not a real limit there. When the Workers Rate
// Limiting binding (LOGIN_LIMITER in wrangler.jsonc) is available it is used;
// otherwise (local Node dev) an in-memory fixed window applies.

interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) return { allowed: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  return { allowed: true, retryAfterSec: 0 };
}

async function cloudflareBinding(name: string): Promise<RateLimitBinding | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const binding = (getCloudflareContext().env as Record<string, unknown>)[name];
    return binding && typeof (binding as RateLimitBinding).limit === "function" ? (binding as RateLimitBinding) : null;
  } catch {
    return null; // not running on Workers
  }
}

/**
 * @param binding  Workers Rate Limiting binding name; its limit/period are set in wrangler.jsonc.
 * @param limit    attempts per window for the in-memory fallback
 * @param windowMs window for the in-memory fallback
 */
export async function rateLimit(key: string, binding: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const cf = await cloudflareBinding(binding);
  if (cf) {
    const { success } = await cf.limit({ key });
    return { allowed: success, retryAfterSec: success ? 0 : 60 };
  }
  return memoryLimit(key, limit, windowMs);
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

/**
 * Best-effort client IP. Behind Cloudflare, cf-connecting-ip is set by the edge
 * and cannot be forged by the client; the other headers are fallbacks for
 * local/proxy setups.
 */
export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
