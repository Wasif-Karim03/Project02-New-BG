import { prisma } from "@/lib/prisma";
import { portraitVisible } from "@/lib/public/consent";

/** The user (applicant/student/donor) a stored file belongs to, or null if unknown. */
export async function fileOwnerUserId(fileUrl: string): Promise<string | null> {
  const app = await prisma.studentApplication.findFirst({
    where: { OR: [{ resultSheetUrl: fileUrl }, { photoUrl: fileUrl }] },
    select: { userId: true },
  });
  if (app) return app.userId;
  const student = await prisma.student.findFirst({ where: { portraitUrl: fileUrl }, select: { userId: true } });
  if (student) return student.userId;
  // Mentor profile pictures belong to the mentor (application or approved record).
  const mentorApp = await prisma.mentorApplication.findFirst({ where: { photoUrl: fileUrl }, select: { userId: true } });
  if (mentorApp) return mentorApp.userId;
  const mentor = await prisma.mentor.findFirst({ where: { photoUrl: fileUrl }, select: { userId: true } });
  if (mentor) return mentor.userId;
  // Tribute images belong to the donor who submitted the gift.
  const tribute = await prisma.donation.findFirst({ where: { tributeImageUrl: fileUrl }, select: { donor: { select: { userId: true } } } });
  return tribute?.donor.userId ?? null;
}

/**
 * May ANYONE (including unauthenticated visitors) view this file? True for two
 * cases, both evaluated LIVE so revoking consent / un-publishing stops serving
 * within one cache window:
 *   1. a student portrait whose owner granted portrait consent for the WEBSITE, and
 *   2. a tribute photo the donor marked public.
 * These are exactly the files the public marketing site renders.
 */
export async function isPublicFile(fileUrl: string): Promise<boolean> {
  const student = await prisma.student.findFirst({
    where: { portraitUrl: fileUrl },
    select: { portraitConsent: true, storyConsent: true, consentScopes: true, consentRevokedAt: true },
  });
  if (student && portraitVisible(student)) return true;
  // Only a CONFIRMED (SUCCEEDED) public tribute is served openly — a PENDING or
  // declined claim must not earn free public image hosting before it's verified.
  return (await prisma.donation.count({ where: { tributeImageUrl: fileUrl, tributePublic: true, status: "SUCCEEDED" } })) > 0;
}

type Viewer = { id: string; role: string } | undefined;

/**
 * Authorization for a stored file (minors' documents). Allowed: an ADMIN, the
 * owner themselves, or a MENTOR with an ACTIVE assignment to the owning student.
 * Everyone else — including unauthenticated requests — is denied.
 */
export async function canViewFile(user: Viewer, fileUrl: string): Promise<boolean> {
  // Consent-gated portraits and public tributes are viewable by anyone.
  if (await isPublicFile(fileUrl)) return true;
  if (!user) return false;
  if (user.role === "ADMIN") return true;

  const ownerId = await fileOwnerUserId(fileUrl);
  if (!ownerId) return false;
  if (user.id === ownerId) return true;

  if (user.role === "MENTOR") {
    const [student, mentor] = await Promise.all([
      prisma.student.findUnique({ where: { userId: ownerId }, select: { id: true } }),
      prisma.mentor.findUnique({ where: { userId: user.id }, select: { id: true } }),
    ]);
    if (student && mentor) {
      const assigned = await prisma.mentorAssignment.count({
        where: { mentorId: mentor.id, studentId: student.id, active: true, unassignedAt: null },
      });
      return assigned > 0;
    }
  }
  return false;
}
