import { AccessDeniedError, withMentorAccess } from "@/lib/auth/mentor-access";
import { prisma } from "@/lib/prisma";
import type { CreateEvaluationInput, UpdateEvaluationInput } from "@/lib/validation/evaluations";

/**
 * The mentor's own roster: students actively assigned to them for the session.
 * Self-scoped by construction (filtered to this mentor's active assignments), so
 * it returns nothing for an unassigned mentor. Detailed access to any one student
 * still goes through the guard (getStudentForMentor / evaluation ops).
 */
export async function listAssignedStudents(mentorUserId: string, sessionId?: string) {
  const mentor = await prisma.mentor.findUnique({ where: { userId: mentorUserId }, select: { id: true } });
  if (!mentor) return [];
  let resolvedSessionId = sessionId;
  if (!resolvedSessionId) {
    const current = await prisma.academicSession.findFirst({ where: { isCurrent: true }, select: { id: true } });
    if (!current) return [];
    resolvedSessionId = current.id;
  }
  const assignments = await prisma.mentorAssignment.findMany({
    where: { mentorId: mentor.id, sessionId: resolvedSessionId, active: true, unassignedAt: null },
    select: { student: { select: { id: true, firstName: true, slug: true, schoolId: true, status: true } } },
    orderBy: { assignedAt: "asc" },
  });
  return assignments.map((a) => a.student);
}

/**
 * Read a student a mentor is assigned to. There is no "read student" path that
 * bypasses the guard — this is the only mentor-facing accessor.
 */
export async function getStudentForMentor(mentorUserId: string, studentId: string, sessionId?: string) {
  return withMentorAccess({ mentorUserId, studentId, action: "student.read", sessionId }, async () => {
    return prisma.student.findUniqueOrThrow({ where: { id: studentId } });
  });
}

/** List a student's evaluations for the assigned session. */
export async function listEvaluationsForStudent(mentorUserId: string, studentId: string, sessionId?: string) {
  return withMentorAccess({ mentorUserId, studentId, action: "evaluation.read", sessionId }, async (ctx) => {
    return prisma.studentEvaluation.findMany({
      where: { studentId, sessionId: ctx.sessionId },
      orderBy: { date: "desc" },
    });
  });
}

/** Create an evaluation (contact log / remarks / file / publishConsent). */
export async function createEvaluation(
  mentorUserId: string,
  studentId: string,
  input: CreateEvaluationInput,
  sessionId?: string,
) {
  return withMentorAccess({ mentorUserId, studentId, action: "evaluation.create", sessionId }, async (ctx) => {
    return prisma.studentEvaluation.create({
      data: {
        studentId,
        mentorId: ctx.mentorId,
        sessionId: ctx.sessionId,
        evaluationType: input.evaluationType,
        date: input.date,
        contactPerson: input.contactPerson,
        contactBy: input.contactBy,
        remarks: input.remarks,
        fileUrl: input.fileUrl,
        publishConsent: input.publishConsent ?? false,
      },
    });
  });
}

/**
 * Update an evaluation. Routed through the guard on the evaluation's student, AND
 * owner-scoped: a mentor may only edit their OWN evaluation. Not-found is reported
 * as AccessDeniedError to avoid disclosing existence.
 */
export async function updateEvaluation(mentorUserId: string, evaluationId: string, input: UpdateEvaluationInput) {
  const evaluation = await prisma.studentEvaluation.findUnique({ where: { id: evaluationId } });
  if (!evaluation) throw new AccessDeniedError();

  return withMentorAccess(
    { mentorUserId, studentId: evaluation.studentId, action: "evaluation.update", sessionId: evaluation.sessionId ?? undefined },
    async (ctx) => {
      if (evaluation.mentorId !== ctx.mentorId) throw new AccessDeniedError();
      return prisma.studentEvaluation.update({
        where: { id: evaluationId },
        data: {
          evaluationType: input.evaluationType,
          date: input.date,
          contactPerson: input.contactPerson,
          contactBy: input.contactBy,
          remarks: input.remarks,
          fileUrl: input.fileUrl,
          publishConsent: input.publishConsent,
        },
      });
    },
  );
}

/** Delete an evaluation. Guarded + owner-scoped, same as update. */
export async function deleteEvaluation(mentorUserId: string, evaluationId: string) {
  const evaluation = await prisma.studentEvaluation.findUnique({ where: { id: evaluationId } });
  if (!evaluation) throw new AccessDeniedError();

  return withMentorAccess(
    { mentorUserId, studentId: evaluation.studentId, action: "evaluation.delete", sessionId: evaluation.sessionId ?? undefined },
    async (ctx) => {
      if (evaluation.mentorId !== ctx.mentorId) throw new AccessDeniedError();
      return prisma.studentEvaluation.delete({ where: { id: evaluationId } });
    },
  );
}
