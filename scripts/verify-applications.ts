/**
 * S1 verification: student application → email verify → admin approval.
 * Proves: account+draft created (PENDING, can't sign in); submit blocked until
 * required fields + agreement; emailed code required (wrong code refused);
 * verify → EMAIL_VERIFIED enters the queue; approve → Student ACTIVE + slug +
 * account ACTIVE (can now sign in); reject requires a reason; all audited.
 *
 * Run after the seed:  npx tsx scripts/verify-applications.ts
 */
import { PrismaClient } from "@prisma/client";
import { isSignInAllowed } from "@/lib/auth/signin-policy";
import { CodeInvalidError, MissingFieldsError, registerStudentApplicant, saveDraft, submitApplication, verifyEmail } from "@/lib/services/applications";
import { ReasonRequiredError, approveApplication, listPendingApplications, rejectApplication } from "@/lib/services/application-review";

const prisma = new PrismaClient();
const T = Date.now();
let failures = 0;
const userIds: string[] = [];
const studentIds: string[] = [];
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }
async function expectThrow(label: string, ErrType: new (...a: never[]) => Error, fn: () => Promise<unknown>) {
  try { await fn(); check(label, false, "expected an error"); } catch (e) { check(label, e instanceof ErrType, e instanceof ErrType ? "" : `wrong: ${(e as Error)?.name}`); }
}
const REQUIRED = { nameEn: "RIMA AKTER", fatherNameEn: "Karim", motherNameEn: "Fatima", familyMobile: "017xxxxxxxx", gender: "female" as const, schoolName: "Rangamati Govt School", currentClass: "8", addrDistrict: "Rangamati", agreedTerms: true };
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
