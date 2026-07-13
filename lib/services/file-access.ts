import { prisma } from "@/lib/prisma";

/** The user (applicant/student/donor) a stored file belongs to, or null if unknown. */
export async function fileOwnerUserId(fileUrl: string): Promise<string | null> {
  const app = await prisma.studentApplication.findFirst({
    where: { OR: [{ resultSheetUrl: fileUrl }, { photoUrl: fileUrl }] },
    select: { userId: true },
  });
  if (app) return app.userId;
  const student = await prisma.student.findFirst({ where: { portraitUrl: fileUrl }, select: { userId: true } });
  if (student) return student.userId;
  // Tribute images belong to the donor who submitted the gift.
  const tribute = await prisma.donation.findFirst({ where: { tributeImageUrl: fileUrl }, select: { donor: { select: { userId: true } } } });
  return tribute?.donor.userId ?? null;
}

/** Is this file a tribute photo the donor marked public? Then anyone may view it. */
async function isPublicTribute(fileUrl: string): Promise<boolean> {
  return (await prisma.donation.count({ where: { tributeImageUrl: fileUrl, tributePublic: true } })) > 0;
}

type Viewer = { id: string; role: string } | undefined;

/**
 * Authorization for a stored file (minors' documents). Allowed: an ADMIN, the
 * owner themselves, or a MENTOR with an ACTIVE assignment to the owning student.
 * Everyone else — including unauthenticated requests — is denied.
 */
export async function canViewFile(user: Viewer, fileUrl: string): Promise<boolean> {
  // A tribute photo the donor chose to make public is viewable by anyone.
  if (fileUrl.startsWith("/api/files/tributes/") && (await isPublicTribute(fileUrl))) return true;
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
