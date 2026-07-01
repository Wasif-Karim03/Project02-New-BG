/**
 * Phase B verification (browser-free). Exercises the real services and asserts
 * the guardrail + the required behaviors:
 *
 *   three entry paths, one queue, auto-approve still audited; guest donor no queue;
 *   PENDING cannot obtain a session until approved; after approval it can; a
 *   rejected one cannot and the reason is logged; rejection requires a reason.
 *
 * Run after the seed:  npx tsx scripts/verify-approvals.ts
 */
import { PrismaClient } from "@prisma/client";
import { isSignInAllowed } from "@/lib/auth/signin-policy";
import {
  adminCreateStudent,
  createGuestDonor,
  registerDonor,
  registerMentor,
  registerStudentByMentor,
  registerStudentSelf,
} from "@/lib/services/accounts";
import {
  approveStudent,
  approveUser,
  listPendingQueue,
  rejectStudent,
  rejectUser,
  ReasonRequiredError,
} from "@/lib/services/approvals";

const prisma = new PrismaClient();
const T = Date.now(); // unique-ish suffix for this run's emails
const dom = `phaseb-${T}.test`;

let failures = 0;
const userIds: string[] = [];
const studentIds: string[] = [];
const donorIds: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}
async function statusOfUser(id: string) {
  return (await prisma.user.findUnique({ where: { id }, select: { status: true } }))?.status;
}
async function auditExists(action: string, entityId: string, reason?: string) {
  const row = await prisma.auditLog.findFirst({ where: { action, entityId } });
  if (!row) return false;
  if (reason !== undefined && row.reason !== reason) return false;
  return true;
}

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: "admin@bridginggenerations.org" } });
  if (!admin) throw new Error("Seed the admin first (npm run db:seed)");

  console.log("\nEntry paths");
  const donor = await registerDonor({ email: `donor@${dom}`, password: "donor-password-1", name: "Donor One" });
  userIds.push(donor.userId); donorIds.push(donor.donorId);
  check("donor self-signup → User PENDING + Donor profile", donor.status === "PENDING" && !!donor.donorId);
  check("PENDING donor cannot obtain a session", isSignInAllowed("PENDING") === false);

  const mentor = await registerMentor({ email: `mentor@${dom}`, password: "mentor-password-1", name: "Mentor One" });
  userIds.push(mentor.userId);
  check("mentor self-signup → User PENDING + Mentor profile", mentor.status === "PENDING" && !!mentor.mentorId);

  const selfStudent = await registerStudentSelf({
    email: `student@${dom}`, password: "student-password-1", name: "Student One", firstName: "Rima",
  });
  userIds.push(selfStudent.userId); studentIds.push(selfStudent.studentId);
  check("student self-signup → User PENDING + Student PENDING", selfStudent.status === "PENDING" && selfStudent.recordStatus === "PENDING");

  // Promote the mentor to ACTIVE so it can register a student.
  await approveUser(admin.id, mentor.userId);
  const mentored = await registerStudentByMentor(mentor.userId, { firstName: "Anik" });
  studentIds.push(mentored.studentId);
  const mentoredRow = await prisma.student.findUnique({ where: { id: mentored.studentId } });
  check("mentor-registered student → Student PENDING, no login", mentoredRow?.status === "PENDING" && mentoredRow?.userId === null);
  check("mentor-registered student records createdById", mentoredRow?.createdById === mentor.userId);

  const adminStudent = await adminCreateStudent(admin.id, { firstName: "Sumi" });
  studentIds.push(adminStudent.studentId);
  check("admin-created student → auto-ACTIVE with slug", adminStudent.status === "ACTIVE" && !!adminStudent.slug);
  check("admin-created student STILL writes an AuditLog", await auditExists("student.create", adminStudent.studentId));

  const guest = await createGuestDonor({ name: "Guest Giver" });
  donorIds.push(guest.donorId);
  const guestRow = await prisma.donor.findUnique({ where: { id: guest.donorId } });
  check("guest donor → Donor row, no login, no approval", !!guestRow && guestRow.userId === null);

  console.log("\nOne queue");
  const queue = await listPendingQueue();
  const accountIds = queue.accounts.map((a) => a.id);
  check("queue lists PENDING accounts (donor + self-student)", accountIds.includes(donor.userId) && accountIds.includes(selfStudent.userId));
  check("queue lists login-less mentor-registered student", queue.loginlessStudents.some((s) => s.id === mentored.studentId));
  check("guest donor is NOT in the queue", !queue.loginlessStudents.some((s) => s.id === guest.donorId) && !accountIds.includes(guest.donorId));
  check("admin-created (ACTIVE) student is NOT in the queue", !queue.loginlessStudents.some((s) => s.id === adminStudent.studentId));

  console.log("\nApproval → session allowed; rejection → refused + reason logged");
  // Approve the donor account.
  await approveUser(admin.id, donor.userId);
  check("approved donor is ACTIVE → can obtain a session", (await statusOfUser(donor.userId)) === "ACTIVE" && isSignInAllowed("ACTIVE") === true);
  check("approval is audited (user.approve)", await auditExists("user.approve", donor.userId));

  // Approve the self-signup student account → cascades to the Student profile + slug.
  await approveUser(admin.id, selfStudent.userId);
  const selfStudentRow = await prisma.student.findUnique({ where: { id: selfStudent.studentId } });
  check("approving self-signup account cascades Student → ACTIVE + slug", selfStudentRow?.status === "ACTIVE" && !!selfStudentRow?.slug);

  // Reject the mentor-registered student WITH a reason.
  await rejectStudent(admin.id, mentored.studentId, "Duplicate of an existing record");
  const mentoredAfter = await prisma.student.findUnique({ where: { id: mentored.studentId } });
  check("rejected student → ARCHIVED", mentoredAfter?.status === "ARCHIVED");
  check("rejection reason is logged", await auditExists("student.reject", mentored.studentId, "Duplicate of an existing record"));

  // Reject the mentor account? It's already ACTIVE; instead reject a fresh pending one.
  const spammer = await registerDonor({ email: `spam@${dom}`, password: "spam-password-1", name: "Spammer" });
  userIds.push(spammer.userId); donorIds.push(spammer.donorId);
  await rejectUser(admin.id, spammer.userId, "Spam signup");
  check("rejected account → REJECTED → cannot obtain a session", (await statusOfUser(spammer.userId)) === "REJECTED" && isSignInAllowed("REJECTED") === false);
  check("account rejection reason is logged", await auditExists("user.reject", spammer.userId, "Spam signup"));

  // Rejection REQUIRES a reason.
  let threw = false;
  try {
    await rejectUser(admin.id, donor.userId, "   ");
  } catch (e) {
    threw = e instanceof ReasonRequiredError;
  }
  check("rejection without a reason is refused", threw);

  console.log(`\n${failures === 0 ? "✓ ALL APPROVAL CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  // FK-safe order; orphaned rows from SetNull relations removed explicitly.
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...userIds, ...studentIds] } } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.student.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.donor.deleteMany({ where: { id: { in: donorIds } } });
  await prisma.mentor.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log("  (cleaned up test data)");
}

main()
  .catch((e) => {
    console.error("verify-approvals error:", e);
    failures++;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
  });
