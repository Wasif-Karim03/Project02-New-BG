import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/services/audit";
import type { StudentRecordInput, StudentSessionInput } from "@/lib/validation/student-record";

export class NotFoundError extends Error {
  constructor() { super("Student not found"); this.name = "NotFoundError"; }
}
export class RegistrationIdTakenError extends Error {
  constructor() { super("That registration ID is already in use."); this.name = "RegistrationIdTakenError"; }
}

/** Full admin record: profile + funding + per-session education + real donor list. */
export async function getStudentRecord(studentId: string) {
  return prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { email: true } },
      sessions: { include: { session: { select: { label: true } } }, orderBy: { createdAt: "desc" } },
      donations: {
        where: { status: "SUCCEEDED" },
        select: { amount: true, refundedAmount: true, occurredAt: true, isRecurring: true, donor: { select: { name: true, isAnonymous: true } } },
        orderBy: { occurredAt: "desc" },
      },
    },
  });
}

export async function listStudentsForAdmin() {
  return prisma.student.findMany({
    where: { status: { in: ["ACTIVE", "PENDING"] } },
    select: { id: true, firstName: true, slug: true, status: true, verified: true, active: true, registrationId: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Edit the admin/funding fields on a Student. Audited. */
export async function updateStudentRecord(adminUserId: string, studentId: string, patch: StudentRecordInput) {
  const before = await prisma.student.findUnique({ where: { id: studentId } });
  if (!before) throw new NotFoundError();
  try {
    const updated = await prisma.student.update({ where: { id: studentId }, data: patch });
    await recordAudit(prisma, {
      actorUserId: adminUserId, action: "student.record.update", entityType: "Student", entityId: studentId,
      before: { firstName: before.firstName, registrationId: before.registrationId, schoolId: before.schoolId, requireAmount: before.requireAmount, verified: before.verified },
      after: { firstName: updated.firstName, registrationId: updated.registrationId, schoolId: updated.schoolId, requireAmount: updated.requireAmount, verified: updated.verified },
    });
    return updated;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new RegistrationIdTakenError();
    throw e;
  }
}

/** Add or update a per-session education row (Session / Institution / Grade / Roll / Former / Total). Audited. */
export async function upsertStudentSession(adminUserId: string, studentId: string, input: StudentSessionInput) {
  const { sessionId, ...data } = input;
  const row = await prisma.studentSession.upsert({
    where: { studentId_sessionId: { studentId, sessionId } },
    create: { studentId, sessionId, status: "ACTIVE", ...data },
    update: data,
  });
  // Re-enrolling a student for a session brings them back onto the public site
  // (year-end deactivation sets active=false; this is the re-activation path).
  await prisma.student.update({ where: { id: studentId }, data: { active: true } });
  await recordAudit(prisma, {
    actorUserId: adminUserId, action: "student.session.upsert", entityType: "Student", entityId: studentId,
    after: { sessionId, grade: data.grade },
  });
  return row;
}

/** Verified/active toggles. Audited. */
export async function setStudentFlags(
  adminUserId: string,
  studentId: string,
  flags: { verified?: boolean; active?: boolean; showOnWebsite?: boolean; showPhoto?: boolean },
) {
  const { showPhoto, ...rest } = flags;
  const data: Prisma.StudentUpdateInput = { ...rest };
  // "showPhoto" maps to the portrait-consent gate (minors' images): granting it
  // marks portrait consent GRANTED, ensures the WEBSITE scope, and clears any
  // revocation; ungranting sets it back to PENDING so the photo goes private.
  if (showPhoto !== undefined) {
    if (showPhoto) {
      const s = await prisma.student.findUnique({ where: { id: studentId }, select: { consentScopes: true } });
      if (!s) throw new NotFoundError();
      const scopes = new Set(s.consentScopes);
      scopes.add("WEBSITE");
      data.portraitConsent = "GRANTED";
      data.consentScopes = { set: [...scopes] };
      data.consentRevokedAt = null;
    } else {
      data.portraitConsent = "PENDING";
    }
  }
  const updated = await prisma.student.update({ where: { id: studentId }, data });
  await recordAudit(prisma, {
    actorUserId: adminUserId, action: "student.flags.set", entityType: "Student", entityId: studentId, after: flags,
  });
  return updated;
}

/**
 * Year-end deactivation. Sets active=false on every currently-active student.
 * Because the public projection now requires active=true, deactivated students
 * immediately drop off the public marketing site until they re-enroll for the new
 * session. Audited. This is a MANUAL admin action — there is no cron/scheduler;
 * an admin runs it from Settings or the Roster at year end.
 */
export async function deactivateAllStudents(adminUserId: string | null): Promise<number> {
  const res = await prisma.student.updateMany({ where: { active: true }, data: { active: false } });
  await recordAudit(prisma, {
    actorUserId: adminUserId, action: "student.yearend.deactivate", entityType: "Student", entityId: null,
    after: { deactivated: res.count },
  });
  return res.count;
}
