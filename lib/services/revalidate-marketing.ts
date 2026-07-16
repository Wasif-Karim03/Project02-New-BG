// NB: no `import "server-only"` here — this module is imported by services that
// the tsx-run verify scripts exercise (where the server-only shim doesn't
// resolve). It's only ever imported server-side anyway, so the secret is safe.
const MARKETING_URL = process.env.NEXT_PUBLIC_MARKETING_URL?.replace(/\/$/, "");
const SECRET = process.env.REVALIDATE_SECRET;

// Cache tags, mirrored from the marketing app's lib/ops/publicApi.ts (OPS_TAGS).
export const MARKETING_TAGS = {
  students: "ops-students",
  stats: "ops-stats",
  donors: "ops-donors",
  projects: "ops-projects",
} as const;

/**
 * Tell the public marketing site to purge the given cache tags so a change
 * (student approved/hidden/deleted, donor approved for the wall, …) shows within
 * seconds instead of waiting out the site's time-based cache window.
 *
 * Best-effort: never throws and is time-boxed, so a slow or unreachable marketing
 * app can't block or roll back the admin action. No-ops when unconfigured
 * (local/CI), where the time-based revalidation remains the fallback.
 */
export async function revalidateMarketing(tags: string[]): Promise<void> {
  if (!MARKETING_URL || !SECRET) return;
  try {
    await fetch(`${MARKETING_URL}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-revalidate-secret": SECRET },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // best-effort — the marketing site's time-based cache still catches up
  }
}
