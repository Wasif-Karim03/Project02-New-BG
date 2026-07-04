import { prisma } from "@/lib/prisma";

/** The user (applicant/student) a stored file belongs to, or null if unknown. */
export async function fileOwnerUserId(fileUrl: string): Promise<string | null> {
  const app = await prisma.studentApplication.findFirst({
    where: { OR: [{ resultSheetUrl: fileUrl }, { photoUrl: fileUrl }] },
    select: { userId: true },
  });
  if (app) return app.userId;
  const student = await prisma.student.findFirst({ where: { portraitUrl: fileUrl }, select: { userId: true } });
  return student?.userId ?? null;
}

type Viewer = { id: string; role: string } | undefined;

/**
 * Authorization for a stored file (minors' documents). Allowed: an ADMIN, the
 * owner themselves, or a MENTOR with an ACTIVE assignment to the owning student.
 * Everyone else — including unauthenticated requests — is denied.
 */
export async function canViewFile(user: Viewer, fileUrl: string): Promise<boolean> {
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
