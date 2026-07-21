/**
 * Phase 6 verification: the 30 December year-end auto-deactivation cron.
 * Proves: an UNAUTHENTICATED request is rejected (401) and changes nothing; an
 * authenticated cron run deactivates every active student and writes an audit row;
 * a second run the same day is safe and does NOT double-apply (deactivates 0) while
 * still auditing. The cron reuses the same deactivateAllStudents service as the
 * manual button.
 *
 * deactivateAllStudents is GLOBAL — the test captures other active students and
 * restores them afterward so live data (e.g. an approved student) is untouched.
 *
 * Run after the seed:  npx tsx scripts/verify-year-end-cron.ts
 */
import { PrismaClient } from "@prisma/client";

import { GET } from "@/app/api/cron/year-end/route";

// The route reads process.env.CRON_SECRET at call time (inside GET), not at import,
// so setting it here — before any GET() call in main() — is sufficient.
const SECRET = `test-cron-secret-${Date.now()}`;
process.env.CRON_SECRET = SECRET;

const prisma = new PrismaClient();
const T = Date.now();
let failures = 0;
const studentIds: string[] = [];
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }
const call = (auth?: string) => GET(new Request("http://localhost/api/cron/year-end", auth ? { headers: { authorization: auth } } : undefined));

async function main() {
  const yearEndAuditsBefore = new Set((await prisma.auditLog.findMany({ where: { action: "student.yearend.deactivate" }, select: { id: true } })).map((a) => a.id));
  // Ensure at least one active student exists for the run to act on.
  const s = await prisma.student.create({ data: { status: "ACTIVE", slug: `cron-${T}`, firstName: "CronTest", active: true } });
  studentIds.push(s.id);
  const isActive = async () => (await prisma.student.findUnique({ where: { id: s.id } }))?.active;

  console.log("\nUnauthenticated / wrong-secret requests are rejected and change nothing");
  const noAuth = await call();
  check("no Authorization header → 401", noAuth.status === 401);
  check("...unauthenticated call deactivated nothing", (await isActive()) === true);
  const wrong = await call("Bearer wrong-secret");
  check("wrong bearer secret → 401", wrong.status === 401);
  check("...wrong-secret call deactivated nothing", (await isActive()) === true);

  console.log("\nAuthenticated cron run deactivates all active students + audits");
  // Snapshot other active students so we can restore them (this is a global action).
  const othersActive = (await prisma.student.findMany({ where: { active: true, id: { notIn: studentIds } }, select: { id: true } })).map((x) => x.id);
  const auditCountBefore = await prisma.auditLog.count({ where: { action: "student.yearend.deactivate" } });
  const ok = await call(`Bearer ${SECRET}`);
  check("authenticated cron request → 200", ok.status === 200);
  const body = await ok.json();
  check("response reports a numeric deactivated count ≥ 1", typeof body.deactivated === "number" && body.deactivated >= 1, `deactivated=${body.deactivated}`);
  check("the active student is now deactivated", (await isActive()) === false);
  check("an audit row was written for the run", (await prisma.auditLog.count({ where: { action: "student.yearend.deactivate" } })) === auditCountBefore + 1);

  console.log("\nRunning it again the same day is safe + does not double-apply");
  const ok2 = await call(`Bearer ${SECRET}`);
  const body2 = await ok2.json();
  check("second run → 200 and deactivated 0 (idempotent, no double-apply)", ok2.status === 200 && body2.deactivated === 0, `deactivated=${body2.deactivated}`);
  check("second run still writes its own audit row (each run is audited)", (await prisma.auditLog.count({ where: { action: "student.yearend.deactivate" } })) === auditCountBefore + 2);
  check("the student stays deactivated (never re-activated)", (await isActive()) === false);

  // Restore pre-existing active students so live data is untouched.
  if (othersActive.length) await prisma.student.updateMany({ where: { id: { in: othersActive } }, data: { active: true } });
  console.log(`  (restored ${othersActive.length} pre-existing active student(s))`);

  // Clean up the year-end audit rows this test created (entityId is null, so scope by id).
  const created = (await prisma.auditLog.findMany({ where: { action: "student.yearend.deactivate" }, select: { id: true } })).map((a) => a.id).filter((id) => !yearEndAuditsBefore.has(id));
  await prisma.auditLog.deleteMany({ where: { id: { in: created } } });

  console.log(`\n${failures === 0 ? "✓ ALL YEAR-END-CRON CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  console.log("  (cleaned up test data)");
}

main().catch((e) => { console.error("verify-year-end-cron error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
