import { headers } from "next/headers";

// In-memory per-(bucket, IP) rate limiter for server actions + sensitive forms.
// Per-instance (fine for v1); a durable store (Redis) is the production upgrade.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** True if the call is allowed; false if the (bucket, IP) is over budget. */
export async function checkRateLimit(bucket: string, opts: { max: number; windowMs: number }): Promise<boolean> {
  const key = `${bucket}:${await clientIp()}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return true;
  }
  if (b.count >= opts.max) return false;
  b.count += 1;
  return true;
}
