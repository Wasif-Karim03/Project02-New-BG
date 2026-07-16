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
  if (tribute) return tribute.donor.userId;
  // Donor profile pictures belong to the donor's linked account.
  const donor = await prisma.donor.findFirst({ where: { avatarUrl: fileUrl }, select: { userId: true } });
  return donor?.userId ?? null;
}

/** Whether a public file is served with the "BG" watermark, and whether it's public at all. */
export type PublicFilePolicy = { public: boolean; watermark: boolean };

/**
 * May ANYONE (including unauthenticated visitors) view this file, and is it
 * watermarked? All evaluated LIVE so revoking consent / un-publishing stops
 * serving within one cache window. Public cases:
 *   1. a student portrait whose owner granted portrait consent for the WEBSITE
 *      (watermarked — it's a minor's image on the sponsorship page),
 *   2. a tribute photo the donor marked public (watermarked), and
 *   3. an APPROVED, non-anonymous donor's profile picture (NOT watermarked — it's
 *      the donor's own photo on the Donors wall, not a student portrait).
 * These are exactly the files the public marketing site renders.
 */
export async function isPublicFile(fileUrl: string): Promise<PublicFilePolicy> {
  const student = await prisma.student.findFirst({
    where: { portraitUrl: fileUrl },
    select: { portraitConsent: true, storyConsent: true, consentScopes: true, consentRevokedAt: true },
  });
  if (student && portraitVisible(student)) return { public: true, watermark: true };
  // Only a CONFIRMED (SUCCEEDED) public tribute is served openly — a PENDING or
  // declined claim must not earn free public image hosting before it's verified.
  const tribute = await prisma.donation.count({ where: { tributeImageUrl: fileUrl, tributePublic: true, status: "SUCCEEDED" } });
  if (tribute > 0) return { public: true, watermark: true };
  // A donor's profile picture goes public only once an admin approves the donor
  // for the wall AND they aren't anonymous. Served without the BG watermark.
  const donor = await prisma.donor.count({ where: { avatarUrl: fileUrl, wallStatus: "APPROVED", isAnonymous: false } });
  if (donor > 0) return { public: true, watermark: false };
  return { public: false, watermark: false };
}

type Viewer = { id: string; role: string } | undefined;

/**
 * Authorization for a stored file (minors' documents). Allowed: an ADMIN, the
 * owner themselves, or a MENTOR with an ACTIVE assignment to the owning student.
 * Everyone else — including unauthenticated requests — is denied.
 */
export async function canViewFile(user: Viewer, fileUrl: string): Promise<boolean> {
  // Consent-gated portraits, public tributes, and approved donor avatars are viewable by anyone.
  if ((await isPublicFile(fileUrl)).public) return true;
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
