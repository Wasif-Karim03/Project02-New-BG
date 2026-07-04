/**
 * S3 verification: admin student "backend record" — edit fields (incl. registration
 * id uniqueness + funding), per-session education upsert, verified/active flags, and
 * the year-end deactivation. All audited.
 *
 * NOTE: deactivateAllStudents is GLOBAL; the test captures other active students and
 * restores them afterward so live data (e.g. an approved student) is untouched.
 *
 * Run after the seed:  npx tsx scripts/verify-student-record.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  RegistrationIdTakenError, deactivateAllStudents, setStudentFlags, updateStudentRecord, upsertStudentSession,
} from "@/lib/services/student-record";

const prisma = new PrismaClient();
const T = Date.now();
let failures = 0;
const studentIds: string[] = [];
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }
async function expectThrow(label: string, ErrType: new (...a: never[]) => Error, fn: () => Promise<unknown>) {
  try { await fn(); check(label, false, "expected error"); } catch (e) { check(label, e instanceof ErrType, e instanceof ErrType ? "" : `wrong: ${(e as Error)?.name}`); }
}

async function main() {
  const admin = (await prisma.user.findUniqueOrThrow({ where: { email: "admin@bridginggenerations.org" } })).id;
  const session = await prisma.academicSession.findFirstOrThrow({ where: { isCurrent: true } });

  const s1 = await prisma.student.create({ data: { status: "ACTIVE", slug: `rec1-${T}`, firstName: "Rec1", active: true } });
  const s2 = await prisma.student.create({ data: { status: "ACTIVE", slug: `rec2-${T}`, firstName: "Rec2", active: true } });
  studentIds.push(s1.id, s2.id);

  console.log("\nEdit record + funding");
  const upd = await updateStudentRecord(admin, s1.id, { registrationId: `BG-${T}`, requireAmount: 30000, paymentType: "INSTALLMENT", perInstallment: 3000, targetType: "YEAR", targetPeriod: "2026", verified: true, guardianName: "Uncle Rahim" });
  check("fields saved (registrationId, requireAmount, verified)", upd.registrationId === `BG-${T}` && upd.requireAmount === 30000 && upd.verified === true);
  check("update is audited", !!(await prisma.auditLog.findFirst({ where: { action: "student.record.update", entityId: s1.id } })));
  await expectThrow("duplicate registrationId refused", RegistrationIdTakenError, () => updateStudentRecord(admin, s2.id, { registrationId: `BG-${T}` }));

  console.log("\nPer-session education upsert");
  const row = await upsertStudentSession(admin, s1.id, { sessionId: session.id, institutionName: "Rangamati College", grade: "11", roll: "42", formerRoll: "51", totalStudent: "60" });
  check("session row created with education fields", row.institutionName === "Rangamati College" && row.grade === "11" && row.formerRoll === "51");
  const row2 = await upsertStudentSession(admin, s1.id, { sessionId: session.id, grade: "12" });
  check("re-upsert updates the same row (grade 11 → 12)", row2.id === row.id && row2.grade === "12");
  check("exactly one session row for that pair", (await prisma.studentSession.count({ where: { studentId: s1.id, sessionId: session.id } })) === 1);

  console.log("\nFlags + year-end deactivation");
  await setStudentFlags(admin, s2.id, { active: false });
  check("setStudentFlags deactivates s2", (await prisma.student.findUnique({ where: { id: s2.id } }))?.active === false);

  // Capture OTHER active students so we can restore them after the global run.
  const othersActive = (await prisma.student.findMany({ where: { active: true, id: { notIn: studentIds } }, select: { id: true } })).map((x) => x.id);
  const count = await deactivateAllStudents(admin);
  check("year-end deactivation sets s1 inactive", (await prisma.student.findUnique({ where: { id: s1.id } }))?.active === false);
  check("deactivation count includes our active student", count >= 1, `count=${count}`);
  check("year-end deactivation is audited", !!(await prisma.auditLog.findFirst({ where: { action: "student.yearend.deactivate" } })));
  if (othersActive.length) await prisma.student.updateMany({ where: { id: { in: othersActive } }, data: { active: true } });
  console.log(`  (restored ${othersActive.length} pre-existing active student(s))`);

  console.log(`\n${failures === 0 ? "✓ ALL STUDENT-RECORD CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: studentIds } } });
  await prisma.studentSession.deleteMany({ where: { studentId: { in: studentIds } } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  console.log("  (cleaned up test data)");
}

main().catch((e) => { console.error("verify-student-record error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
