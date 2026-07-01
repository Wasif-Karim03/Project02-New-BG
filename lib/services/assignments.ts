import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/services/audit";

/**
 * Admin assigns a student to a mentor for a session (idempotent per the
 * [mentorId, studentId, sessionId] unique). Re-assigning a previously
 * unassigned pair reactivates it. Audited.
 */
export async function assignStudentToMentor(
  adminUserId: string,
  params: { mentorId: string; studentId: string; sessionId: string },
) {
  const { mentorId, studentId, sessionId } = params;
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.mentorAssignment.upsert({
      where: { mentorId_studentId_sessionId: { mentorId, studentId, sessionId } },
      update: { active: true, unassignedAt: null, assignedById: adminUserId, assignedAt: new Date() },
      create: { mentorId, studentId, sessionId, assignedById: adminUserId, active: true },
    });
    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: "mentor.assign",
      entityType: "Student",
      entityId: studentId,
      after: { mentorId, sessionId, assignmentId: assignment.id },
    });
    return assignment;
  });
}

/**
 * Admin unassigns: active=false + unassignedAt=now. Because the access guard
 * requires active===true AND unassignedAt===null, this cuts access immediately.
 * Audited. No-op-safe if the assignment doesn't exist.
 */
export async function unassignStudentFromMentor(
  adminUserId: string,
  params: { mentorId: string; studentId: string; sessionId: string },
) {
  const { mentorId, studentId, sessionId } = params;
  return prisma.$transaction(async (tx) => {
    const existing = await tx.mentorAssignment.findUnique({
      where: { mentorId_studentId_sessionId: { mentorId, studentId, sessionId } },
    });
    if (!existing || !existing.active) return existing ?? null;

    const updated = await tx.mentorAssignment.update({
      where: { id: existing.id },
      data: { active: false, unassignedAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: "mentor.unassign",
      entityType: "Student",
      entityId: studentId,
      before: { active: true },
      after: { active: false, mentorId, sessionId },
    });
    return updated;
  });
}
