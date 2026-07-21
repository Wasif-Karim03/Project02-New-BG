/**
 * Phase 5 verification: the monthly mentor evaluation (Form 4). Proves it round-
 * trips, the identity header auto-populates from the student record, the 6-point +
 * grade enums validate, and — the real safeguard — that a mentor submitting OR
 * reading an evaluation for a NON-ASSIGNED student is denied by the FROZEN
 * mentor-access guard with AccessDeniedError (write and read both).
 *
 * Run after the seed:  npx tsx scripts/verify-mentor-evaluation.ts
 */
import { PrismaClient } from "@prisma/client";
import { AccessDeniedError } from "@/lib/auth/mentor-access";
import { registerMentor, adminCreateStudent } from "@/lib/services/accounts";
import { approveUser } from "@/lib/services/approvals";
import { assignStudentToMentor } from "@/lib/services/assignments";
import { getEvaluationContext, listMentorEvaluations, submitMentorEvaluation } from "@/lib/services/mentor-evaluation";
import { PROGRESS_GRADE_BANDS, STUDY_HABIT_ITEMS, mentorEvaluationSchema } from "@/lib/validation/mentor-evaluation";

const prisma = new PrismaClient();
const T = Date.now();
const dom = `phase5-${T}.test`;
let failures = 0;
const userIds: string[] = [];
const studentIds: string[] = [];
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }
async function assertDenied(label: string, fn: () => Promise<unknown>) {
  try { await fn(); check(label, false, "expected AccessDeniedError but the call SUCCEEDED"); }
  catch (e) { check(label, e instanceof AccessDeniedError, e instanceof AccessDeniedError ? "denied by guard" : `wrong error: ${(e as Error)?.name}`); }
}
async function auditExists(action: string, entityId: string, reason?: string) {
  // Match the reason in the query — several denied attempts (create/read/context)
  // can be audited for the same student, so "most recent" isn't necessarily the one.
  const row = await prisma.auditLog.findFirst({ where: { action, entityId, ...(reason !== undefined ? { reason } : {}) }, orderBy: { createdAt: "desc" } });
  return !!row;
}
let _admin: string | null = null;
async function admin() {
  if (!_admin) _admin = (await prisma.user.findUniqueOrThrow({ where: { email: "admin@bridginggenerations.org" } })).id;
  return _admin;
}
async function makeActiveMentor(name: string) {
  const m = await registerMentor({ email: `${name}@${dom}`, password: "mentor-password-1", name });
  userIds.push(m.userId);
  await approveUser(await admin(), m.userId);
  return { userId: m.userId, mentorId: m.mentorId };
}

async function main() {
  const a = await admin();
  const current = await prisma.academicSession.findFirstOrThrow({ where: { isCurrent: true } });
  const mentorA = await makeActiveMentor("mentorA");
  const mentorB = await makeActiveMentor("mentorB");
  const s1 = await adminCreateStudent(a, { firstName: "Rima" });
  const s2 = await adminCreateStudent(a, { firstName: "Anik" });
  studentIds.push(s1.studentId, s2.studentId);
  await assignStudentToMentor(a, { mentorId: mentorA.mentorId, studentId: s1.studentId, sessionId: current.id });
  await assignStudentToMentor(a, { mentorId: mentorB.mentorId, studentId: s2.studentId, sessionId: current.id });

  // Give s1 the data the identity header auto-fills from.
  await prisma.student.update({ where: { id: s1.studentId }, data: { fullName: "Rima Akter", tutorName: "Mr Roy" } });
  await prisma.studentSession.create({ data: { studentId: s1.studentId, sessionId: current.id, institutionName: "Rangamati College", grade: "11", roll: "42", formerRoll: "51", status: "ACTIVE" } });

  console.log("\nIdentity header auto-populates from the student record");
  const ctx = await getEvaluationContext(mentorA.userId, s1.studentId);
  check("header: student, teacher, class, rolls, institution, mentor all auto-filled",
    ctx.studentName === "Rima Akter" && ctx.privateTeacher === "Mr Roy" && ctx.institution === "Rangamati College" &&
    ctx.classGrade === "11" && ctx.currentRoll === "42" && ctx.formerRoll === "51" && ctx.mentorName === "mentorA",
    JSON.stringify(ctx));

  console.log("\nFull evaluation round-trips (within the guard)");
  const yesNoQ = STUDY_HABIT_ITEMS.find((x) => x.type === "yes_no")!;
  const openQ = STUDY_HABIT_ITEMS.find((x) => x.type === "open_text")!;
  const created = await submitMentorEvaluation(mentorA.userId, s1.studentId, {
    date: new Date("2026-03-15T00:00:00.000Z"),
    studyHabits: [
      { question: yesNoQ.text, type: "yes_no", answer: "yes", comment: "সকালে পড়ে" },
      { question: openQ.text, type: "open_text", answer: null, comment: "প্রতিদিন সন্ধ্যায় শেষ করি" },
    ],
    participation: "VERY_GOOD",
    parentCommunication: "GOOD",
    progressGrade: "B",
    subjectNotes: [{ subject: "Math", note: "Improving" }, { subject: "English", note: "Strong" }],
    overallEvaluation: "Steady progress overall.",
  });
  check("evaluation created + owned by the assigned mentor", created.studentId === s1.studentId && created.mentorId === mentorA.mentorId && created.sessionId === current.id);
  check("identity header snapshotted onto the evaluation", created.studentName === "Rima Akter" && created.institution === "Rangamati College");
  check("6-point ratings + grade persist", created.participation === "VERY_GOOD" && created.parentCommunication === "GOOD" && created.progressGrade === "B");
  const back = (await listMentorEvaluations(mentorA.userId, s1.studentId)).find((e) => e.id === created.id);
  check("evaluation reads back through the guard", !!back && back.overallEvaluation === "Steady progress overall.");
  const sh = back?.studyHabits as { question: string; type?: string; answer: string | null; comment?: string }[] | undefined;
  check("yes_no answer round-trips (verbatim question + type + answer + comment)", !!sh && sh[0]!.question === yesNoQ.text && sh[0]!.type === "yes_no" && sh[0]!.answer === "yes" && sh[0]!.comment === "সকালে পড়ে");
  check("open_text answer round-trips (type open_text, answer null, response in comment)", !!sh && sh[1]!.type === "open_text" && sh[1]!.answer === null && sh[1]!.comment === "প্রতিদিন সন্ধ্যায় শেষ করি");
  check("study-habit item list has both a guidance instruction and typed questions", STUDY_HABIT_ITEMS.some((x) => x.type === "guidance") && STUDY_HABIT_ITEMS.some((x) => x.type === "yes_no") && STUDY_HABIT_ITEMS.some((x) => x.type === "open_text"));
  const sn = back?.subjectNotes as { subject: string; note?: string }[] | undefined;
  check("per-subject notes round-trip through Json", !!sn && sn.some((x) => x.subject === "Math" && x.note === "Improving"));
  check("evaluation create is audited", await auditExists("mentor.evaluation.create", s1.studentId));

  console.log("\n6-point + grade enums validate");
  check("valid enums accepted", mentorEvaluationSchema.safeParse({ participation: "EXCELLENT", parentCommunication: "POOR", progressGrade: "A" }).success);
  check("invalid 6-point rating rejected", !mentorEvaluationSchema.safeParse({ participation: "AMAZING" }).success);
  check("invalid grade rejected", !mentorEvaluationSchema.safeParse({ progressGrade: "E" }).success);
  check("corrected grade bands: A 4.5–5.0, B 3.5–4.4, C 2.5–3.4, D 1.7–2.5", PROGRESS_GRADE_BANDS.A === "4.5–5.0" && PROGRESS_GRADE_BANDS.B === "3.5–4.4" && PROGRESS_GRADE_BANDS.C === "2.5–3.4" && PROGRESS_GRADE_BANDS.D === "1.7–2.5");

  console.log("\nCross-student access is denied by the FROZEN guard (write AND read)");
  await assertDenied("WRITE denied: mentor A cannot submit an evaluation for mentor B's student", () => submitMentorEvaluation(mentorA.userId, s2.studentId, { overallEvaluation: "nope" }));
  await assertDenied("READ denied: mentor A cannot list mentor B's student's evaluations", () => listMentorEvaluations(mentorA.userId, s2.studentId));
  await assertDenied("CONTEXT denied: mentor A cannot auto-fill a header for mentor B's student", () => getEvaluationContext(mentorA.userId, s2.studentId));
  check("cross-student WRITE denial is audited (mentor.access.denied)", await auditExists("mentor.access.denied", s2.studentId, "mentor.evaluation.create"));
  check("no evaluation was written for the non-assigned student", (await prisma.mentorEvaluation.count({ where: { studentId: s2.studentId } })) === 0);

  console.log(`\n${failures === 0 ? "✓ ALL MENTOR-EVALUATION CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...studentIds, ...userIds] } } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } }); // cascades assignments + evaluations + mentorEvaluations + sessions
  await prisma.user.deleteMany({ where: { id: { in: userIds } } }); // cascades mentors
  console.log("  (cleaned up test data)");
}

main().catch((e) => { console.error("verify-mentor-evaluation error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
