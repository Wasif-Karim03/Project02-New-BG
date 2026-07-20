import type { Prisma } from "@prisma/client";
import { withMentorAccess } from "@/lib/auth/mentor-access";
import { prisma } from "@/lib/prisma";
import type { MentorEvaluationInput } from "@/lib/validation/mentor-evaluation";

// The auto-filled identity header: student name, mentor name, private teacher,
// class/grade, current + former roll, institution — all derived from the student
// record + their session education row + the mentor's own name. Never re-typed by
// the mentor. Called only from inside the guard (ctx already authorized).
async function buildIdentityHeader(studentId: string, sessionId: string, mentorId: string) {
  const [student, sess, mentor] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, select: { fullName: true, firstName: true, tutorName: true } }),
    prisma.studentSession.findUnique({ where: { studentId_sessionId: { studentId, sessionId } }, select: { institutionName: true, grade: true, roll: true, formerRoll: true } }),
    prisma.mentor.findUnique({ where: { id: mentorId }, select: { user: { select: { name: true } } } }),
  ]);
  return {
    studentName: student?.fullName ?? student?.firstName ?? null,
    mentorName: mentor?.user.name ?? null,
    privateTeacher: student?.tutorName ?? null,
    classGrade: sess?.grade ?? null,
    currentRoll: sess?.roll ?? null,
    formerRoll: sess?.formerRoll ?? null,
    institution: sess?.institutionName ?? null,
  };
}

/** Read-only identity-header preview for the evaluation form. Guarded. */
export async function getEvaluationContext(mentorUserId: string, studentId: string, sessionId?: string) {
  return withMentorAccess({ mentorUserId, studentId, action: "mentor.evaluation.context", sessionId }, async (ctx) => {
    return buildIdentityHeader(studentId, ctx.sessionId, ctx.mentorId);
  });
}

/**
 * Submit a monthly evaluation (Form 4). Routed through the frozen mentor-access
 * guard — an unassigned mentor is denied with AccessDeniedError before any write.
 * The identity header is snapshotted from the student record at creation.
 */
export async function submitMentorEvaluation(mentorUserId: string, studentId: string, input: MentorEvaluationInput, sessionId?: string) {
  return withMentorAccess({ mentorUserId, studentId, action: "mentor.evaluation.create", sessionId }, async (ctx) => {
    const header = await buildIdentityHeader(studentId, ctx.sessionId, ctx.mentorId);
    return prisma.mentorEvaluation.create({
      data: {
        studentId,
        mentorId: ctx.mentorId,
        sessionId: ctx.sessionId,
        date: input.date ?? new Date(),
        ...header,
        studyHabits: (input.studyHabits ?? undefined) as Prisma.InputJsonValue | undefined,
        participation: input.participation,
        parentCommunication: input.parentCommunication,
        progressGrade: input.progressGrade,
        subjectNotes: (input.subjectNotes ?? undefined) as Prisma.InputJsonValue | undefined,
        overallEvaluation: input.overallEvaluation,
      },
    });
  });
}

/** List a student's monthly evaluations for the assigned session. Guarded. */
export async function listMentorEvaluations(mentorUserId: string, studentId: string, sessionId?: string) {
  return withMentorAccess({ mentorUserId, studentId, action: "mentor.evaluation.read", sessionId }, async (ctx) => {
    return prisma.mentorEvaluation.findMany({ where: { studentId, sessionId: ctx.sessionId }, orderBy: { date: "desc" } });
  });
}
