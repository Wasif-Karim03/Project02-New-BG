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
  RegistrationIdTakenError, deactivateAllStudents, deleteStudentSession, getStudentRecord, setStudentFlags, updateStudentRecord, upsertStudentSession,
} from "@/lib/services/student-record";
import { approveApplication } from "@/lib/services/application-review";
import { saveUpload, readUpload } from "@/lib/storage";

const prisma = new PrismaClient();
const T = Date.now();
let failures = 0;
const studentIds: string[] = [];
const userIds: string[] = [];
const donorIds: string[] = [];
const mentorIds: string[] = [];
const appIds: string[] = [];
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

  console.log("\nPhase 4 — DOB round-trip (application → approval → roster)");
  const dobUser = await prisma.user.create({ data: { email: `rec-dob-${T}@x.test`, role: "STUDENT", status: "PENDING", name: "Dob Test" } });
  userIds.push(dobUser.id);
  const dobDate = new Date("2008-03-15T00:00:00.000Z");
  const dobApp = await prisma.studentApplication.create({ data: { userId: dobUser.id, status: "EMAIL_VERIFIED", nameEn: "DOB STUDENT", fatherNameEn: "Karim", motherNameEn: "Fatima", dob: dobDate, localGuardianName: "Guardian", localGuardianPhone: "018", monthlyFamilyIncome: "5000", fatherProfession: "Farmer" } });
  appIds.push(dobApp.id);
  const dobApproved = await approveApplication(admin, dobApp.id);
  studentIds.push(dobApproved.studentId);
  const dobStudent = await prisma.student.findUnique({ where: { id: dobApproved.studentId } });
  check("DOB maps application → student.dob at approval (via mapper)", dobStudent?.dob?.getTime() === dobDate.getTime());
  const newDob = new Date("2009-06-20T00:00:00.000Z");
  const dobEdited = await updateStudentRecord(admin, dobApproved.studentId, { dob: newDob });
  check("DOB editable in the roster record", dobEdited.dob?.getTime() === newDob.getTime());

  console.log("\nPhase 4 — new record fields persist");
  const rich = await updateStudentRecord(admin, s1.id, { fatherPhone: "01711111111", motherPhone: "01822222222", incomeSource: "Farming", ethnicity: "Chakma", isOrphan: true, selectionNote: "Top of class; single-earner family." });
  check("father/mother phone + income source persist", rich.fatherPhone === "01711111111" && rich.motherPhone === "01822222222" && rich.incomeSource === "Farming");
  check("ethnicity + orphan + selection note editable", rich.ethnicity === "Chakma" && rich.isOrphan === true && !!rich.selectionNote?.includes("single-earner"));

  console.log("\nPhase 4 — per-session degree level, result sheet, edit + delete");
  const uni = await upsertStudentSession(admin, s1.id, { sessionId: session.id, institutionName: "Chittagong University", degreeLevel: "BA", resultSheetUrl: "/api/files/student-sessions/test.pdf" });
  check("degree level + per-session result sheet persist", uni.degreeLevel === "BA" && uni.resultSheetUrl === "/api/files/student-sessions/test.pdf");
  const key = await saveUpload("student-sessions", "application/pdf", Buffer.from("%PDF-1.4 per-session result"));
  const back = await readUpload(key);
  check("per-session result upload round-trips (saveUpload → readUpload)", key.startsWith("student-sessions/") && back.bytes.toString().includes("%PDF"));
  await deleteStudentSession(admin, s1.id, session.id);
  check("education row is deletable", (await prisma.studentSession.count({ where: { studentId: s1.id, sessionId: session.id } })) === 0);
  check("session delete is audited", !!(await prisma.auditLog.findFirst({ where: { action: "student.session.delete", entityId: s1.id } })));

  console.log("\nPhase 4 — mentor + donor surface on the record");
  const mentorUser = await prisma.user.create({ data: { email: `rec-mentor-${T}@x.test`, role: "MENTOR", status: "ACTIVE", name: "Mentor Bob" } });
  userIds.push(mentorUser.id);
  const mentor = await prisma.mentor.create({ data: { userId: mentorUser.id } });
  mentorIds.push(mentor.id);
  const assignedAt = new Date("2026-02-01T00:00:00.000Z");
  await prisma.mentorAssignment.create({ data: { mentorId: mentor.id, studentId: s1.id, sessionId: session.id, assignedAt, active: true } });
  const donor = await prisma.donor.create({ data: { name: "Donor Dana" } });
  donorIds.push(donor.id);
  await prisma.donation.create({ data: { donorId: donor.id, studentId: s1.id, amount: 5000, status: "SUCCEEDED", designationType: "STUDENT", source: "CASH", occurredAt: new Date("2026-03-01T00:00:00.000Z") } });
  const rec = await getStudentRecord(s1.id);
  check("record surfaces mentor name + id + assignedAt", rec?.assignments.length === 1 && rec.assignments[0]!.mentor.id === mentor.id && rec.assignments[0]!.mentor.user.name === "Mentor Bob" && rec.assignments[0]!.assignedAt.getTime() === assignedAt.getTime());
  check("record surfaces donor name + id + date", !!rec?.donations.some((dn) => dn.donor.id === donor.id && dn.donor.name === "Donor Dana"));

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
  await prisma.donation.deleteMany({ where: { OR: [{ studentId: { in: studentIds } }, { donorId: { in: donorIds } }] } });
  await prisma.mentorAssignment.deleteMany({ where: { studentId: { in: studentIds } } });
  await prisma.studentApplication.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...studentIds, ...appIds] } } });
  await prisma.studentSession.deleteMany({ where: { studentId: { in: studentIds } } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.mentor.deleteMany({ where: { id: { in: mentorIds } } });
  await prisma.donor.deleteMany({ where: { id: { in: donorIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log("  (cleaned up test data)");
}

main().catch((e) => { console.error("verify-student-record error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
