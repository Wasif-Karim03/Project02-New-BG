import { deactivateAllStudents } from "@/lib/services/student-record";

// Year-end auto-deactivation — the "30 December all students are deactivated" rule.
//
// SCHEDULE (see vercel.json `crons`): "0 17 30 12 *" runs at 17:00 UTC on 30 Dec.
// Bangladesh is Asia/Dhaka = UTC+6 all year (no DST), so 17:00 UTC == 23:00 on
// 30 December in Dhaka — the whole of Dec 30 stays active for students/admins in
// Bangladesh, and the reset lands at the very end of that day. Vercel crons run in
// UTC, hence 23:00 Dhaka − 6h = 17:00 UTC (same calendar day).
//
// SECURITY: Vercel's native cron authentication — Vercel injects
// `Authorization: Bearer $CRON_SECRET` on scheduled invocations. Any request
// without the exact bearer secret is rejected (401), so an anonymous request can't
// trigger the reset. Fails closed if CRON_SECRET is unset.
//
// This calls the SAME deactivateAllStudents service the manual admin button uses
// (no duplicated logic). That service is idempotent (updateMany where active=true →
// active=false), so running this twice on the same day deactivates 0 the second
// time and never double-applies; it writes an audit row on every run. Deactivation
// ONLY — it never deletes and never re-activates (re-enrolling for the new session
// stays a manual admin action).
export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  // actorUserId = null → recorded in the audit log as a system/cron-initiated run.
  const deactivated = await deactivateAllStudents(null);
  return Response.json({ ok: true, deactivated });
}
