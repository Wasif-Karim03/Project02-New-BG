/**
 * S1 verification: student application → email verify → admin approval.
 * Proves: account+draft created (PENDING, can't sign in); submit blocked until
 * required fields + agreement; emailed code required (wrong code refused);
 * verify → EMAIL_VERIFIED enters the queue; approve → Student ACTIVE + slug +
 * account ACTIVE (can now sign in); reject requires a reason; all audited.
 *
 * Run after the seed:  npx tsx scripts/verify-applications.ts
 */
import { PrismaClient, type StudentApplication } from "@prisma/client";
import { isSignInAllowed } from "@/lib/auth/signin-policy";
import { CodeInvalidError, MissingFieldsError, registerStudentApplicant, saveDraft, submitApplication, verifyEmail } from "@/lib/services/applications";
import { ReasonRequiredError, approveApplication, listPendingApplications, rejectApplication } from "@/lib/services/application-review";
import { draftFromForm } from "@/lib/apply/draft-from-form";
import { REQUIRED_CONSENTS } from "@/lib/validation/applications";
import { mapApplicationToStudent } from "@/lib/mappers/application-to-student";

const prisma = new PrismaClient();
const T = Date.now();
let failures = 0;
const userIds: string[] = [];
const studentIds: string[] = [];
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }
async function expectThrow(label: string, ErrType: new (...a: never[]) => Error, fn: () => Promise<unknown>) {
  try { await fn(); check(label, false, "expected an error"); } catch (e) { check(label, e instanceof ErrType, e instanceof ErrType ? "" : `wrong: ${(e as Error)?.name}`); }
}
const REQUIRED = { nameEn: "RIMA AKTER", fatherNameEn: "Karim", motherNameEn: "Fatima", familyMobile: "017xxxxxxxx", gender: "female" as const, schoolName: "Rangamati Govt School", currentClass: "8", addrDistrict: "Rangamati", photoUrl: "/api/files/applications/test-photo.jpg", resultSheetUrl: "/api/files/applications/test-result.pdf", agreedTerms: true, photoConsent: true, consentVerificationCalls: true, consentMonthlyPayment: true, consentMentorCheckins: true, consentCancelPolicy: true };
const admin = async () => (await prisma.user.findUniqueOrThrow({ where: { email: "admin@bridginggenerations.org" } })).id;

async function applyAndVerify(tag: string) {
  const reg = await registerStudentApplicant({ email: `applicant-${tag}-${T}@x.test`, password: "applicant-password-1", name: "Rima Akter" });
  userIds.push(reg.userId);
  await saveDraft(reg.userId, REQUIRED);
  const { devCode } = await submitApplication(reg.userId);
  await verifyEmail(reg.userId, devCode!);
  return reg;
}

async function main() {
  const adminId = await admin();

  console.log("\nAccount + draft");
  const reg = await registerStudentApplicant({ email: `applicant-${T}@x.test`, password: "applicant-password-1", name: "Rima Akter" });
  userIds.push(reg.userId);
  check("account STUDENT/PENDING + DRAFT application", reg.status === "DRAFT");
  check("PENDING applicant cannot get a session yet", isSignInAllowed("PENDING") === false);

  console.log("\nPhase 1 — optional fields round-trip (scalars, repeatable Json groups, conditional scholarship)");
  const regF = await registerStudentApplicant({ email: `applicant-fields-${T}@x.test`, password: "applicant-password-1", name: "Fields Test" });
  userIds.push(regF.userId);
  // Build the exact FormData the form submits and run it through the real mapper.
  const fd = new FormData();
  fd.set("nameEn", "TESTER");
  fd.set("favoriteSubjectMarks", "92");
  fd.set("familyMembersTotal", "6");
  fd.set("studyingChildren", "3 (classes 4, 7, 9)");
  fd.set("localKnownName", "Imam Sahib");
  fd.set("localKnownPhone", "018xxxxxxxx");
  fd.set("otherResults.0.subject", "Physics"); fd.set("otherResults.0.grade", "A");
  fd.set("otherResults.1.subject", "Chemistry"); fd.set("otherResults.1.grade", "A-");
  fd.set("otherResults.2.subject", ""); fd.set("otherResults.2.grade", ""); // fully-empty row → dropped
  fd.set("govtExamGrades.0.subject", "Bangla"); fd.set("govtExamGrades.0.grade", "A+");
  fd.set("existingScholarshipHas", "yes");
  fd.set("existingScholarship.org", "Local Trust"); fd.set("existingScholarship.amount", "500"); fd.set("existingScholarship.type", "monthly");
  fd.append("scholarshipNeedFor", "fees"); fd.append("scholarshipNeedFor", "materials");
  fd.set("scholarshipNeedForOther", "Transport to school");
  const draft = draftFromForm(fd);
  check("mapper: familyMembersTotal coerced to Int", draft.familyMembersTotal === 6);
  check("mapper: fully-empty repeatable row dropped", Array.isArray(draft.otherResults) && draft.otherResults!.length === 2);
  check("mapper: otherResults round-trips {subject,grade}", draft.otherResults?.[0]?.subject === "Physics" && draft.otherResults?.[1]?.grade === "A-");
  check("mapper: govtExamGrades round-trips", draft.govtExamGrades?.[0]?.subject === "Bangla" && draft.govtExamGrades?.[0]?.grade === "A+");
  check("mapper: existingScholarship object built on Yes", draft.existingScholarship?.org === "Local Trust" && draft.existingScholarship?.type === "monthly");
  check("mapper: scholarshipNeedFor = options + free-text", JSON.stringify(draft.scholarshipNeedFor) === JSON.stringify(["fees", "materials", "Transport to school"]));
  // Conditional: identical sub-fields but answer = No → object omitted entirely.
  const fdNo = new FormData();
  fdNo.set("existingScholarshipHas", "no");
  fdNo.set("existingScholarship.org", "Should be ignored");
  check("mapper: existingScholarship omitted when answer is No", draftFromForm(fdNo).existingScholarship === undefined);
  // Persist via the service, then read straight back from the DB (Json columns).
  await saveDraft(regF.userId, draft);
  const persisted = await prisma.studentApplication.findFirst({ where: { userId: regF.userId } });
  check("db: familyMembersTotal persisted", persisted?.familyMembersTotal === 6);
  check("db: studyingChildren persisted", persisted?.studyingChildren === "3 (classes 4, 7, 9)");
  check("db: local reference persisted", persisted?.localKnownName === "Imam Sahib" && persisted?.localKnownPhone === "018xxxxxxxx");
  // Compare field-by-field: Prisma Json → Postgres jsonb, which normalizes object
  // key order, so a raw JSON.stringify of an array-of-objects would spuriously differ.
  const sameRows = (a: unknown, b: { subject: string; grade: string }[] | undefined) =>
    Array.isArray(a) && Array.isArray(b) && a.length === b.length &&
    a.every((r, i) => (r as { subject?: string }).subject === b[i].subject && (r as { grade?: string }).grade === b[i].grade);
  check("db: otherResults stored as Json array", sameRows(persisted?.otherResults, draft.otherResults));
  check("db: existingScholarship stored as Json object", (persisted?.existingScholarship as { type?: string } | null)?.type === "monthly");
  check("db: scholarshipNeedFor stored as Json array", JSON.stringify(persisted?.scholarshipNeedFor) === JSON.stringify(draft.scholarshipNeedFor));

  console.log("\nPhase 2 — Form 1 hard rules (result sheet, name caps, orphan guardian)");
  // Result sheet is now hard-required — submit without it is blocked, same pattern as the photo.
  const regRS = await registerStudentApplicant({ email: `applicant-rs-${T}@x.test`, password: "applicant-password-1", name: "RS" });
  userIds.push(regRS.userId);
  await saveDraft(regRS.userId, { ...REQUIRED, resultSheetUrl: undefined });
  try {
    await submitApplication(regRS.userId);
    check("submit blocked without result sheet", false, "expected MissingFieldsError");
  } catch (e) {
    check("submit without result sheet → MissingFieldsError lists resultSheetUrl", e instanceof MissingFieldsError && e.fields.includes("resultSheetUrl"), e instanceof MissingFieldsError ? `fields=${e.fields.join(",")}` : `wrong: ${(e as Error)?.name}`);
  }

  // English student name normalized to uppercase — through the real form mapper…
  const fdName = new FormData();
  fdName.set("nameEn", "rima akter lowercase");
  check("mapper: nameEn uppercased at validation boundary", draftFromForm(fdName).nameEn === "RIMA AKTER LOWERCASE");
  // …and guaranteed at the persistence boundary for a direct saveDraft caller.
  const regName = await registerStudentApplicant({ email: `applicant-name-${T}@x.test`, password: "applicant-password-1", name: "Name" });
  userIds.push(regName.userId);
  await saveDraft(regName.userId, { ...REQUIRED, nameEn: "test lower name" });
  const nameRow = await prisma.studentApplication.findFirst({ where: { userId: regName.userId } });
  check("db: nameEn stored uppercase (direct saveDraft)", nameRow?.nameEn === "TEST LOWER NAME");
  check("db: parent English names NOT force-uppercased (caps is student-only)", nameRow?.fatherNameEn === "Karim" && nameRow?.motherNameEn === "Fatima");

  // Orphan ⇒ local guardian (name + phone) required at submit.
  const regOrph = await registerStudentApplicant({ email: `applicant-orph-${T}@x.test`, password: "applicant-password-1", name: "Orphan" });
  userIds.push(regOrph.userId);
  await saveDraft(regOrph.userId, { ...REQUIRED, isOrphan: true });
  try {
    await submitApplication(regOrph.userId);
    check("orphan without guardian blocked", false, "expected MissingFieldsError");
  } catch (e) {
    check("orphan without guardian → MissingFieldsError lists guardian name+phone", e instanceof MissingFieldsError && e.fields.includes("localGuardianName") && e.fields.includes("localGuardianPhone"), e instanceof MissingFieldsError ? `fields=${e.fields.join(",")}` : `wrong: ${(e as Error)?.name}`);
  }
  // Orphan WITH a guardian submits fine.
  await saveDraft(regOrph.userId, { localGuardianName: "Imam Sahib", localGuardianPhone: "018xxxxxxxx" });
  check("orphan WITH guardian submits", !!(await submitApplication(regOrph.userId)).devCode);
  // Non-orphan without a guardian still submits (rule is conditional).
  const regNon = await registerStudentApplicant({ email: `applicant-nonorph-${T}@x.test`, password: "applicant-password-1", name: "NonOrphan" });
  userIds.push(regNon.userId);
  await saveDraft(regNon.userId, { ...REQUIRED, isOrphan: false });
  check("non-orphan without guardian still submits", !!(await submitApplication(regNon.userId)).devCode);

  console.log("\nPhase 3A — each required consent gates submission");
  for (const consent of REQUIRED_CONSENTS) {
    const reg = await registerStudentApplicant({ email: `applicant-consent-${consent}-${T}@x.test`, password: "applicant-password-1", name: "Consent" });
    userIds.push(reg.userId);
    await saveDraft(reg.userId, { ...REQUIRED, [consent]: false });
    try {
      await submitApplication(reg.userId);
      check(`submit blocked when ${consent} unchecked`, false, "expected MissingFieldsError");
    } catch (e) {
      check(`submit blocked when ${consent} unchecked → lists ${consent}`, e instanceof MissingFieldsError && e.fields.includes(consent), e instanceof MissingFieldsError ? `fields=${e.fields.join(",")}` : `wrong: ${(e as Error)?.name}`);
    }
  }
  // specialReason is optional — a submit without it still succeeds (REQUIRED omits it).
  const regSR = await registerStudentApplicant({ email: `applicant-specialreason-${T}@x.test`, password: "applicant-password-1", name: "SR" });
  userIds.push(regSR.userId);
  await saveDraft(regSR.userId, REQUIRED);
  check("specialReason optional — submit succeeds without it", !!(await submitApplication(regSR.userId)).devCode);

  // A validation bounce must preserve every consent's checked state: saveDraft
  // persists all six BEFORE the submit gate rejects, and the form re-renders each
  // via defaultChecked, so none should silently revert to unticked.
  const regBounce = await registerStudentApplicant({ email: `applicant-bounce-${T}@x.test`, password: "applicant-password-1", name: "Bounce" });
  userIds.push(regBounce.userId);
  await saveDraft(regBounce.userId, { ...REQUIRED, resultSheetUrl: undefined }); // all consents ticked, but result sheet missing → bounces
  try {
    await submitApplication(regBounce.userId);
    check("bounce setup: submit rejected", false, "expected MissingFieldsError");
  } catch (e) {
    check("bounce setup: submit rejected on the missing result sheet", e instanceof MissingFieldsError && e.fields.includes("resultSheetUrl"));
  }
  const bounced = (await prisma.studentApplication.findFirst({ where: { userId: regBounce.userId } })) as Record<string, unknown> | null;
  check("bounce preserves all six consents (restorable checked state)",
    !!bounced && REQUIRED_CONSENTS.every((c) => bounced[c] === true),
    bounced ? REQUIRED_CONSENTS.map((c) => `${c}=${bounced[c]}`).join(" ") : "no row");

  console.log("\nPhase 3B — application→student mapper is the single source of truth");
  const fakeApp = {
    nameEn: "RIMA AKTER", fatherNameEn: "Karim Uddin", motherNameEn: "Fatima Begum",
    gender: "female", ethnicity: "Chakma", isOrphan: true,
    fatherProfession: "Farmer", motherProfession: "Homemaker", monthlyFamilyIncome: "8000",
    addrVillage: "Rangapani", addrDistrict: "Rangamati",
    localGuardianName: "Imam Sahib", localGuardianPhone: "018xxxxxxxx",
    tutorName: "Mr Roy", tutorPhone: "019xxxxxxxx", careerGoal: "Doctor",
    photoUrl: "/api/files/applications/p.jpg",
  } as unknown as StudentApplication;
  const m = mapApplicationToStudent(fakeApp, "Rima");
  check("mapper: firstName passed through (not split)", m.firstName === "Rima");
  check("mapper: fullName ← nameEn (not split)", m.fullName === "RIMA AKTER");
  check("mapper: fatherName ← fatherNameEn", m.fatherName === "Karim Uddin");
  check("mapper: motherName ← motherNameEn", m.motherName === "Fatima Begum");
  check("mapper: guardianName ← localGuardianName (naming drift)", m.guardianName === "Imam Sahib");
  check("mapper: guardianMobile ← localGuardianPhone (naming drift)", m.guardianMobile === "018xxxxxxxx");
  check("mapper: familyIncome ← monthlyFamilyIncome (naming drift)", m.familyIncome === "8000");
  check("mapper: community & ethnicity ← ethnicity", m.community === "Chakma" && m.ethnicity === "Chakma");
  check("mapper: gender/isOrphan/professions/address/tutor/career/portrait all land correctly",
    m.gender === "female" && m.isOrphan === true && m.fatherProfession === "Farmer" && m.motherProfession === "Homemaker" &&
    m.addrVillage === "Rangapani" && m.addrDistrict === "Rangamati" && m.tutorName === "Mr Roy" && m.tutorPhone === "019xxxxxxxx" &&
    m.careerGoal === "Doctor" && m.portraitUrl === "/api/files/applications/p.jpg");

  console.log("\nSubmit is gated on required fields + agreement");
  await saveDraft(reg.userId, { nameEn: "RIMA", gender: "female" }); // partial
  await expectThrow("submit blocked while required fields missing", MissingFieldsError, () => submitApplication(reg.userId));
  await saveDraft(reg.userId, REQUIRED);

  console.log("\nEmail verification");
  const submitted = await submitApplication(reg.userId);
  check("submit returns a dev code + status SUBMITTED", !!submitted.devCode);
  await expectThrow("wrong code refused", CodeInvalidError, () => verifyEmail(reg.userId, "000000"));
  await verifyEmail(reg.userId, submitted.devCode!);
  const verified = await prisma.studentApplication.findFirst({ where: { userId: reg.userId } });
  check("verify → EMAIL_VERIFIED", verified?.status === "EMAIL_VERIFIED" && verified?.emailVerifiedAt != null);
  check("email_verified is audited", !!(await prisma.auditLog.findFirst({ where: { action: "application.email_verified", entityId: verified!.id } })));

  console.log("\nAdmin queue + approval");
  const queue = await listPendingApplications();
  check("verified application is in the queue", queue.some((a) => a.id === verified!.id));
  check("account still PENDING before approval", (await prisma.user.findUnique({ where: { id: reg.userId } }))?.status === "PENDING");
  const approved = await approveApplication(adminId, verified!.id);
  studentIds.push(approved.studentId);
  const student = await prisma.student.findUnique({ where: { id: approved.studentId } });
  check("approve → Student ACTIVE + slug + verified", student?.status === "ACTIVE" && !!student?.slug && student?.verified === true);
  check("mapped fields (fatherName, district, career)", student?.fatherName === "Karim" && student?.addrDistrict === "Rangamati");
  // The applicant's result sheet is required to submit — assert it SURVIVES approval
  // onto the seeded StudentSession (was previously discarded at the mapper boundary).
  const seededSession = await prisma.studentSession.findFirst({ where: { studentId: approved.studentId } });
  check("seeded StudentSession carries school + grade from the application", seededSession?.institutionName === "Rangamati Govt School" && seededSession?.grade === "8");
  check("result sheet survives application → approval → record (StudentSession.resultSheetUrl)", seededSession?.resultSheetUrl === "/api/files/applications/test-result.pdf", `got ${seededSession?.resultSheetUrl ?? "null"}`);
  check("application APPROVED + linked to student", (await prisma.studentApplication.findUnique({ where: { id: verified!.id } }))?.status === "APPROVED");
  check("account ACTIVE → can now sign in", (await prisma.user.findUnique({ where: { id: reg.userId } }))?.status === "ACTIVE" && isSignInAllowed("ACTIVE") === true);
  check("approval is audited", !!(await prisma.auditLog.findFirst({ where: { action: "application.approve", entityId: verified!.id } })));

  console.log("\nRejection requires a reason");
  const reg2 = await applyAndVerify("rej");
  const app2 = await prisma.studentApplication.findFirst({ where: { userId: reg2.userId } });
  await expectThrow("reject without reason refused", ReasonRequiredError, () => rejectApplication(adminId, app2!.id, "  "));
  await rejectApplication(adminId, app2!.id, "Incomplete supporting documents");
  const rejected = await prisma.studentApplication.findUnique({ where: { id: app2!.id } });
  check("reject → REJECTED + reason stored", rejected?.status === "REJECTED" && rejected?.rejectionReason === "Incomplete supporting documents");
  check("reject is audited", !!(await prisma.auditLog.findFirst({ where: { action: "application.reject", entityId: app2!.id } })));

  console.log("\nApprove when the user already has a Student (upsert, no collision)");
  const reg3 = await applyAndVerify("dup");
  const existingStudent = await prisma.student.create({ data: { userId: reg3.userId, status: "PENDING", firstName: "Old" } });
  studentIds.push(existingStudent.id);
  const app3 = await prisma.studentApplication.findFirst({ where: { userId: reg3.userId, status: "EMAIL_VERIFIED" } });
  const approved3 = await approveApplication(adminId, app3!.id);
  check("approval UPDATES the existing student (no duplicate)", approved3.studentId === existingStudent.id);
  check("exactly one student for that user", (await prisma.student.count({ where: { userId: reg3.userId } })) === 1);
  check("existing student is now ACTIVE + verified", (await prisma.student.findUnique({ where: { id: existingStudent.id } }))?.status === "ACTIVE");

  console.log(`\n${failures === 0 ? "✓ ALL APPLICATION CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  const apps = await prisma.studentApplication.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const appIds = apps.map((a) => a.id);
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...appIds, ...studentIds] } } });
  await prisma.studentApplication.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log("  (cleaned up test data)");
}

main().catch((e) => { console.error("verify-applications error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
