import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/services/audit";
import { generateUniqueStudentSlug } from "@/lib/slug";

export class NotFoundError extends Error {
  constructor() { super("Application not found"); this.name = "NotFoundError"; }
}
export class NotReviewableError extends Error {
  constructor(status: string) { super(`Application is not awaiting review (status: ${status})`); this.name = "NotReviewableError"; }
}
export class ReasonRequiredError extends Error {
  constructor() { super("A reason is required to reject."); this.name = "ReasonRequiredError"; }
}

/** The application queue: EMAIL_VERIFIED, awaiting admin decision. */
export async function listPendingApplications() {
  return prisma.studentApplication.findMany({
    where: { status: "EMAIL_VERIFIED" },
    select: { id: true, nameEn: true, schoolName: true, addrDistrict: true, emailVerifiedAt: true, user: { select: { email: true } } },
    orderBy: { emailVerifiedAt: "asc" },
  });
}

/** Full application for admin review (sensitive read → audited). */
export async function getApplicationForReview(adminUserId: string, applicationId: string) {
  const app = await prisma.studentApplication.findUnique({ where: { id: applicationId }, include: { user: { select: { email: true } } } });
  if (!app) throw new NotFoundError();
  await recordAudit(prisma, { actorUserId: adminUserId, action: "application.read", entityType: "StudentApplication", entityId: applicationId });
  return app;
}

function firstNameFrom(nameEn: string | null, fallback: string): string {
  const t = nameEn?.trim().split(/\s+/)[0];
  return t && t.length > 0 ? t : fallback;
}

/**
 * Approve: create the Student (ACTIVE, slug, mapped fields), link it to the
 * application, and activate the applicant's account. Audited.
 */
export async function approveApplication(adminUserId: string, applicationId: string) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.studentApplication.findUnique({ where: { id: applicationId }, include: { user: true } });
    if (!app) throw new NotFoundError();
    if (app.status !== "EMAIL_VERIFIED") throw new NotReviewableError(app.status);

    const firstName = firstNameFrom(app.nameEn, app.user.name?.split(/\s+/)[0] ?? "Student");
    const slug = await generateUniqueStudentSlug(firstName);

    const student = await tx.student.create({
      data: {
        userId: app.userId,
        status: "ACTIVE",
        slug,
        verified: true,
        firstName,
        fullName: app.nameEn,
        fatherName: app.fatherNameEn,
        motherName: app.motherNameEn,
        gender: app.gender,
        community: app.ethnicity,
        ethnicity: app.ethnicity,
        isOrphan: app.isOrphan,
        fatherProfession: app.fatherProfession,
        motherProfession: app.motherProfession,
        familyIncome: app.monthlyFamilyIncome,
        addrVillage: app.addrVillage,
        addrDistrict: app.addrDistrict,
        guardianName: app.localGuardianName,
        guardianMobile: app.localGuardianPhone,
        tutorName: app.tutorName,
        tutorPhone: app.tutorPhone,
        careerGoal: app.careerGoal,
        portraitUrl: app.photoUrl,
        createdById: adminUserId,
        reviewedById: adminUserId,
        reviewedAt: new Date(),
      },
    });

    await tx.studentApplication.update({
      where: { id: applicationId },
      data: { status: "APPROVED", studentId: student.id, reviewedById: adminUserId, reviewedAt: new Date() },
    });
    await tx.user.update({ where: { id: app.userId }, data: { status: "ACTIVE", reviewedById: adminUserId, reviewedAt: new Date() } });

    await recordAudit(tx, {
      actorUserId: adminUserId, action: "application.approve", entityType: "StudentApplication", entityId: applicationId,
      after: { studentId: student.id, slug, userActivated: true },
    });
    return { studentId: student.id, slug };
  });
}

/** Reject (reason required). The account stays PENDING so they can re-apply. Audited. */
export async function rejectApplication(adminUserId: string, applicationId: string, reason: string) {
  if (!reason?.trim()) throw new ReasonRequiredError();
  return prisma.$transaction(async (tx) => {
    const app = await tx.studentApplication.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundError();
    if (app.status !== "EMAIL_VERIFIED") throw new NotReviewableError(app.status);

    const updated = await tx.studentApplication.update({
      where: { id: applicationId },
      data: { status: "REJECTED", reviewedById: adminUserId, reviewedAt: new Date(), rejectionReason: reason.trim() },
    });
    await recordAudit(tx, {
      actorUserId: adminUserId, action: "application.reject", entityType: "StudentApplication", entityId: applicationId,
      before: { status: "EMAIL_VERIFIED" }, after: { status: "REJECTED" }, reason: reason.trim(),
    });
    return updated;
  });
}
