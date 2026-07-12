/**
 * Mentor application flow: register → draft → submit (email code) → verify →
 * admin approve (creates Mentor, activates user) → mentor profile readable.
 * Mirrors the student application flow.
 *
 * Run after the seed:  npx tsx scripts/verify-mentor-applications.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  MentorCodeInvalidError, MentorMissingFieldsError,
  approveMentorApplication, getMentorOwnProfile, listMentorApplications,
  registerMentorApplicant, saveMentorDraft, submitMentorApplication, verifyMentorEmail,
} from "@/lib/services/mentor-applications";

const prisma = new PrismaClient();
const T = Date.now();
let failures = 0;
const userIds: string[] = [];
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }
async function expectThrow(label: string, ErrType: new (...a: never[]) => Error, fn: () => Promise<unknown>) {
  try { await fn(); check(label, false, "expected error"); } catch (e) { check(label, e instanceof ErrType, (e as Error)?.name); }
}

async function main() {
  const admin = (await prisma.user.findUniqueOrThrow({ where: { email: "admin@bridginggenerations.org" } })).id;

  console.log("\nRegister + draft + submit");
  const { userId } = await registerMentorApplicant({ email: `mentor-${T}@x.test`, password: "mentor-password-1", name: "Test Mentor" });
  userIds.push(userId);
  const u = await prisma.user.findUnique({ where: { id: userId } });
  check("applicant user is MENTOR + PENDING", u?.role === "MENTOR" && u?.status === "PENDING");
  await expectThrow("submit before required fields is refused", MentorMissingFieldsError, () => submitMentorApplication(userId));

  await saveMentorDraft(userId, { fullName: "Test Mentor", phone: "0170000000", profession: "Teacher", country: "Bangladesh", motivation: "I want to help students learn.", agreedTerms: true });
  const { devCode } = await submitMentorApplication(userId);
  check("submit returns a dev code + status SUBMITTED", !!devCode && (await prisma.mentorApplication.findFirst({ where: { userId } }))?.status === "SUBMITTED");

  console.log("\nVerify email");
  await expectThrow("wrong code refused", MentorCodeInvalidError, () => verifyMentorEmail(userId, "000000"));
  await verifyMentorEmail(userId, devCode!);
  check("correct code → EMAIL_VERIFIED", (await prisma.mentorApplication.findFirst({ where: { userId } }))?.status === "EMAIL_VERIFIED");
  check("appears in the admin queue", (await listMentorApplications()).some((a) => a.userId === userId));

  console.log("\nAdmin approve");
  await approveMentorApplication(admin, (await prisma.mentorApplication.findFirstOrThrow({ where: { userId } })).id);
  const after = await prisma.user.findUnique({ where: { id: userId } });
  const mentor = await prisma.mentor.findUnique({ where: { userId } });
  const app = await prisma.mentorApplication.findFirst({ where: { userId } });
  check("approve → user ACTIVE, Mentor created, app APPROVED + linked", after?.status === "ACTIVE" && !!mentor && app?.status === "APPROVED" && app?.mentorId === mentor?.id);
  check("approval audited", !!(await prisma.auditLog.findFirst({ where: { action: "mentor.application.approve", entityId: app?.id ?? "" } })));

  console.log("\nMentor profile readable");
  const profile = await getMentorOwnProfile(userId);
  check("mentor can read their own submitted profile", profile?.profession === "Teacher" && profile?.motivation === "I want to help students learn.");

  console.log(`\n${failures === 0 ? "✓ ALL MENTOR-APPLICATION CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  const apps = await prisma.mentorApplication.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: apps.map((a) => a.id) } } });
  await prisma.mentorApplication.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.mentor.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log("  (cleaned up test data)");
}

main().catch((e) => { console.error("verify-mentor-applications error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
