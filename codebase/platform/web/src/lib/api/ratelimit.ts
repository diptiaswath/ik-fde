// Fixed-window in-memory rate limiter keyed by api-key hash.
// NOTE: per-instance / soft on Vercel serverless — each lambda gets its own
// memory, so this is a teaching/dev guard, not a hard distributed limit. A real
// deployment would back this with Redis/Upstash.

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 120; // per key per window

type Bucket = { count: number; resetAt: number };

const globalForRl = globalThis as unknown as {
  __meridianRateBuckets?: Map<string, Bucket>;
};

function buckets(): Map<string, Bucket> {
  if (!globalForRl.__meridianRateBuckets) {
    globalForRl.__meridianRateBuckets = new Map();
  }
  return globalForRl.__meridianRateBuckets;
}

export function checkRateLimit(keyHash: string): {
  ok: boolean;
  retryAfter?: number;
} {
  const now = Date.now();
  const map = buckets();
  const b = map.get(keyHash);
  if (!b || now >= b.resetAt) {
    map.set(keyHash, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  if (b.count >= MAX_REQUESTS) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true };
}
