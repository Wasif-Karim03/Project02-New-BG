/**
 * Phase C verification (browser-free). The NEGATIVE cases are the real proof:
 * every denial must be an AccessDeniedError PRODUCED BY THE GUARD, never an
 * empty-data accident. Asserts:
 *   - mentor A cannot access mentor B's assigned student
 *   - a mentor cannot access an unassigned student
 *   - access is session-scoped (assigned for the current term ≠ a past term)
 *   - a mentor unassigned after being assigned is refused going forward
 *   - an assigned mentor CAN access, scoped to the right session, and it's audited
 *   - evaluation CRUD works only within the guard (unassigned & non-owner denied)
 *
 * Run after the seed:  npx tsx scripts/verify-mentor-access.ts
 */
import { PrismaClient } from "@prisma/client";
import { AccessDeniedError, assertMentorCanAccess } from "@/lib/auth/mentor-access";
import { registerMentor } from "@/lib/services/accounts";
import { approveUser } from "@/lib/services/approvals";
import { adminCreateStudent } from "@/lib/services/accounts";
import { assignStudentToMentor, unassignStudentFromMentor } from "@/lib/services/assignments";
import {
  createEvaluation,
  deleteEvaluation,
  getStudentForMentor,
  listEvaluationsForStudent,
  updateEvaluation,
} from "@/lib/services/mentor";

const prisma = new PrismaClient();
const T = Date.now();
const dom = `phasec-${T}.test`;

let failures = 0;
const userIds: string[] = [];
const studentIds: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}
async function assertDenied(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(label, false, "expected AccessDeniedError but the call SUCCEEDED");
  } catch (e) {
    check(label, e instanceof AccessDeniedError, e instanceof AccessDeniedError ? "denied by guard" : `wrong error: ${(e as Error)?.name}`);
  }
}
async function auditExists(action: string, entityId: string, reason?: string) {
  const row = await prisma.auditLog.findFirst({ where: { action, entityId }, orderBy: { createdAt: "desc" } });
  if (!row) return false;
  if (reason !== undefined && row.reason !== reason) return false;
  return true;
}

async function makeActiveMentor(name: string) {
  const m = await registerMentor({ email: `${name}@${dom}`, password: "mentor-password-1", name });
  userIds.push(m.userId);
  await approveUser((await admin()).id, m.userId);
  return { userId: m.userId, mentorId: m.mentorId };
}
let _admin: { id: string } | null = null;
async function admin() {
  if (!_admin) {
    const a = await prisma.user.findUnique({ where: { email: "admin@bridginggenerations.org" } });
    if (!a) throw new Error("Seed the admin first");
    _admin = { id: a.id };
  }
  return _admin;
}

async function main() {
  const a = await admin();
  const current = await prisma.academicSession.findFirstOrThrow({ where: { isCurrent: true } });
  const past = await prisma.academicSession.findFirstOrThrow({ where: { label: "2024-2025" } });

  const mentorA = await makeActiveMentor("mentorA");
  const mentorB = await makeActiveMentor("mentorB");

  const s1 = await adminCreateStudent(a.id, { firstName: "Rima" });
  const s2 = await adminCreateStudent(a.id, { firstName: "Anik" });
  const s3 = await adminCreateStudent(a.id, { firstName: "Sumi" }); // never assigned
  studentIds.push(s1.studentId, s2.studentId, s3.studentId);

  await assignStudentToMentor(a.id, { mentorId: mentorA.mentorId, studentId: s1.studentId, sessionId: current.id });
  await assignStudentToMentor(a.id, { mentorId: mentorB.mentorId, studentId: s2.studentId, sessionId: current.id });

  console.log("\nNegative cases (must be guard-produced AccessDeniedError)");
  await assertDenied("mentor A cannot access mentor B's student", () => assertMentorCanAccess(mentorA.userId, s2.studentId));
  await assertDenied("mentor cannot access an unassigned student", () => assertMentorCanAccess(mentorA.userId, s3.studentId));
  await assertDenied("access is session-scoped (past term denied)", () => assertMentorCanAccess(mentorA.userId, s1.studentId, past.id));
  await assertDenied("unassigned mentor cannot create an evaluation", () => createEvaluation(mentorA.userId, s2.studentId, { remarks: "nope" }));

  console.log("\nPositive: assigned mentor, scoped to the right session, audited");
  const ctx = await assertMentorCanAccess(mentorA.userId, s1.studentId);
  check("assigned mentor A CAN access S1", !!ctx.assignmentId);
  check("access is scoped to the current session", ctx.sessionId === current.id, `sessionId=${ctx.sessionId}`);
  const student = await getStudentForMentor(mentorA.userId, s1.studentId);
  check("getStudentForMentor returns the student", student.id === s1.studentId);
  check("sensitive read is audited (student.read, keyed by student)", await auditExists("student.read", s1.studentId));

  console.log("\nEvaluation CRUD only within the guard");
  const evaln = await createEvaluation(mentorA.userId, s1.studentId, {
    remarks: "Home visit — attending regularly", contactPerson: "Guardian", contactBy: "MOBILE", publishConsent: false, fileUrl: "ref/visit-1.pdf",
  });
  check("create evaluation works (within guard)", evaln.studentId === s1.studentId && evaln.mentorId === mentorA.mentorId);
  check("evaluation is scoped to the session", evaln.sessionId === current.id);
  check("evaluation.create is audited", await auditExists("evaluation.create", s1.studentId));

  const list = await listEvaluationsForStudent(mentorA.userId, s1.studentId);
  check("list evaluations returns the created one", list.some((e) => e.id === evaln.id));

  const updated = await updateEvaluation(mentorA.userId, evaln.id, { remarks: "Updated after follow-up", publishConsent: true });
  check("update evaluation works for the owner", updated.remarks === "Updated after follow-up" && updated.publishConsent === true);

  // Ownership: give B access to S1 too, then B must STILL not edit A's evaluation.
  await assignStudentToMentor(a.id, { mentorId: mentorB.mentorId, studentId: s1.studentId, sessionId: current.id });
  await assertDenied("assigned-but-not-owner mentor cannot edit another's evaluation", () => updateEvaluation(mentorB.userId, evaln.id, { remarks: "hijack" }));
  await unassignStudentFromMentor(a.id, { mentorId: mentorB.mentorId, studentId: s1.studentId, sessionId: current.id });

  check("denied access attempt was audited (mentor.access.denied)", await auditExists("mentor.access.denied", s1.studentId, "evaluation.update"));

  const removed = await deleteEvaluation(mentorA.userId, evaln.id);
  check("delete evaluation works for the owner", removed.id === evaln.id);
  check("evaluation.delete is audited", await auditExists("evaluation.delete", s1.studentId));

  console.log("\nUnassign cuts access immediately");
  await unassignStudentFromMentor(a.id, { mentorId: mentorA.mentorId, studentId: s1.studentId, sessionId: current.id });
  await assertDenied("mentor unassigned after being assigned is refused going forward", () => assertMentorCanAccess(mentorA.userId, s1.studentId));
  await assertDenied("...and cannot create evaluations anymore", () => createEvaluation(mentorA.userId, s1.studentId, { remarks: "too late" }));

  console.log(`\n${failures === 0 ? "✓ ALL MENTOR-ACCESS CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...studentIds, ...userIds] } } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } }); // cascades assignments + evaluations
  await prisma.user.deleteMany({ where: { id: { in: userIds } } }); // cascades mentors
  console.log("  (cleaned up test data)");
}

main()
  .catch((e) => {
    console.error("verify-mentor-access error:", e);
    failures++;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
  });
