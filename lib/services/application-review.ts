import type { ConsentScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSessionId } from "@/lib/services/academic-session";
import { sendDecisionEmail } from "@/lib/services/account-emails";
import { recordAudit } from "@/lib/services/audit";
import { MARKETING_TAGS, revalidateMarketing } from "@/lib/services/revalidate-marketing";
import { generateUniqueStudentSlug, slugify } from "@/lib/slug";

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
    select: { id: true, nameEn: true, schoolName: true, addrDistrict: true, photoUrl: true, emailVerifiedAt: true, user: { select: { email: true } } },
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
  const result = await prisma.$transaction(async (tx) => {
    const app = await tx.studentApplication.findUnique({ where: { id: applicationId }, include: { user: true } });
    if (!app) throw new NotFoundError();
    if (app.status !== "EMAIL_VERIFIED") throw new NotReviewableError(app.status);

    const firstName = firstNameFrom(app.nameEn, app.user.name?.split(/\s+/)[0] ?? "Student");
    // If the user already has a Student (e.g. a prior signup), UPDATE it — never
    // create a second (Student.userId is unique). Keep an existing slug (immutable).
    const existing = await tx.student.findUnique({ where: { userId: app.userId }, select: { slug: true, registrationId: true } });
    const slug = existing?.slug ?? (await generateUniqueStudentSlug(firstName));
    // Auto-assign a unique registration ID (BG-<year>-<0001…>) on first approval;
    // preserve any existing one. Sequential from the highest ID this year; the
    // registrationId @unique constraint is the final guard against a race.
    let registrationId = existing?.registrationId ?? null;
    if (!registrationId) {
      const prefix = `BG-${new Date().getFullYear()}-`;
      const last = await tx.student.findFirst({
        where: { registrationId: { startsWith: prefix } },
        orderBy: { registrationId: "desc" },
        select: { registrationId: true },
      });
      const n = last?.registrationId ? Number.parseInt(last.registrationId.slice(prefix.length), 10) : 0;
      registrationId = `${prefix}${String((Number.isNaN(n) ? 0 : n) + 1).padStart(4, "0")}`;
    }

    // School: the application stores a free-text school name. Find-or-create a
    // School row by name so the student carries a real schoolId (and the public
    // page / portal can show the school), rather than dropping the name.
    let schoolId: string | null = null;
    if (app.schoolName?.trim()) {
      const name = app.schoolName.trim();
      let school = await tx.school.findFirst({ where: { name }, select: { id: true } });
      if (!school) {
        const base = slugify(name);
        let uniqueSlug = base;
        for (let i = 2; await tx.school.findUnique({ where: { slug: uniqueSlug }, select: { id: true } }); i++) {
          uniqueSlug = `${base}-${i}`;
        }
        school = await tx.school.create({ data: { name, slug: uniqueSlug }, select: { id: true } });
      }
      schoolId = school.id;
    }

    const mapped = {
      status: "ACTIVE" as const,
      slug,
      registrationId,
      schoolId,
      verified: true,
      active: true, // (re-)approval brings the student onto the public site
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
      // Publish the photo ONLY if the applicant consented to public display (the
      // required "photoConsent" checkbox, recorded on the application). The image
      // is served watermarked; admin can still toggle visibility per-student.
      portraitConsent: app.photoConsent ? ("GRANTED" as const) : ("PENDING" as const),
      consentScopes: app.photoConsent ? (["WEBSITE"] as ConsentScope[]) : ([] as ConsentScope[]),
      consentRevokedAt: null,
      reviewedById: adminUserId,
      reviewedAt: new Date(),
    };
    const student = await tx.student.upsert({
      where: { userId: app.userId },
      create: { userId: app.userId, createdById: adminUserId, ...mapped },
      update: mapped,
    });

    // Seed a per-session enrollment for the current academic session so the
    // school + grade (free-text `currentClass`) surface on the portal / public
    // page. Upsert keeps this idempotent if the student is re-approved.
    const currentSessionId = await getCurrentSessionId(tx);
    if (currentSessionId) {
      await tx.studentSession.upsert({
        where: { studentId_sessionId: { studentId: student.id, sessionId: currentSessionId } },
        create: {
          studentId: student.id,
          sessionId: currentSessionId,
          schoolId,
          institutionName: app.schoolName,
          grade: app.currentClass,
          roll: app.roll,
          totalStudent: app.totalStudents,
          status: "ACTIVE",
        },
        update: {
          schoolId,
          institutionName: app.schoolName,
          grade: app.currentClass,
          roll: app.roll,
          totalStudent: app.totalStudents,
          status: "ACTIVE",
        },
      });
    }

    await tx.studentApplication.update({
      where: { id: applicationId },
      data: { status: "APPROVED", studentId: student.id, reviewedById: adminUserId, reviewedAt: new Date() },
    });
    await tx.user.update({ where: { id: app.userId }, data: { status: "ACTIVE", reviewedById: adminUserId, reviewedAt: new Date() } });

    await recordAudit(tx, {
      actorUserId: adminUserId, action: "application.approve", entityType: "StudentApplication", entityId: applicationId,
      after: { studentId: student.id, slug, userActivated: true },
    });
    return { studentId: student.id, slug, email: app.user.email, name: firstName };
  });
  // Notify the applicant after the transaction commits (best-effort).
  await sendDecisionEmail({ to: result.email, name: result.name, role: "STUDENT", approved: true });
  // Refresh the public site so the new student appears within seconds.
  await revalidateMarketing([MARKETING_TAGS.students, MARKETING_TAGS.stats]);
  return { studentId: result.studentId, slug: result.slug };
}

/**
 * Reject (reason required). REJECTION POLICY (shared with mentor rejection):
 * rejected accounts STAY ABLE TO RE-APPLY — only the application moves to
 * REJECTED, and the User account is left PENDING so the applicant can submit a
 * fresh application (getOrCreateDraft opens a new DRAFT). Audited.
 */
export async function rejectApplication(adminUserId: string, applicationId: string, reason: string) {
  if (!reason?.trim()) throw new ReasonRequiredError();
  const result = await prisma.$transaction(async (tx) => {
    const app = await tx.studentApplication.findUnique({ where: { id: applicationId }, include: { user: true } });
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
    return { updated, email: app.user.email, name: app.nameEn ?? app.user.name };
  });
  await sendDecisionEmail({ to: result.email, name: result.name, role: "STUDENT", approved: false });
  return result.updated;
}
