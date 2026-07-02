// Lightweight per-IP rate limiter + cache headers for the public read-only API.
// The limiter is in-memory (per instance) — fine for v1; a durable store (Redis)
// is the production upgrade. Kept provider-agnostic (no vendor SDK).

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX = 60; // requests
const WINDOW_MS = 60_000; // per minute

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Returns a 429 Response if the caller is over budget, else null. */
export function enforceRateLimit(req: Request): Response | null {
  const ip = clientIp(req);
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }
  if (b.count >= MAX) {
    return new Response("Too many requests", { status: 429, headers: { "Retry-After": String(Math.ceil((b.resetAt - now) / 1000)) } });
  }
  b.count += 1;
  return null;
}

/** JSON with CDN cache headers (5 min fresh, 10 min stale-while-revalidate). */
export function cachedJson(data: unknown): Response {
  return Response.json(data, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
