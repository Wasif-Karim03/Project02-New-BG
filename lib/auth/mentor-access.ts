import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/services/audit";

/**
 * The ONE denial type. Thrown uniformly for every failure mode — not a mentor,
 * no session context, no active assignment, wrong session, not the owner — so a
 * caller can never distinguish "student doesn't exist" from "you're not allowed"
 * (no existence disclosure about a minor's record).
 */
export class AccessDeniedError extends Error {
  constructor() {
    super("Access denied");
    this.name = "AccessDeniedError";
  }
}

export type MentorAccessContext = {
  mentorId: string;
  sessionId: string;
  assignmentId: string;
};

/**
 * THE DOOR. A mentor (by User.id) may access a student ONLY when an ACTIVE
 * MentorAssignment exists for the relevant AcademicSession. Default-deny: any
 * missing piece throws AccessDeniedError. Session-scoped: pass `sessionId`, or
 * omit it to use the current AcademicSession.
 *
 * "Active" = active === true AND unassignedAt === null, so unassigning a mentor
 * (active=false / unassignedAt set) cuts access immediately.
 *
 * PURE: performs no writes and no logging, so it is trivially testable and can be
 * called from anywhere. Audit + operation live in withMentorAccess().
 */
export async function assertMentorCanAccess(
  mentorUserId: string,
  studentId: string,
  sessionId?: string,
): Promise<MentorAccessContext> {
  const mentor = await prisma.mentor.findUnique({ where: { userId: mentorUserId }, select: { id: true } });
  if (!mentor) throw new AccessDeniedError();

  let resolvedSessionId = sessionId;
  if (!resolvedSessionId) {
    const current = await prisma.academicSession.findFirst({ where: { isCurrent: true }, select: { id: true } });
    if (!current) throw new AccessDeniedError();
    resolvedSessionId = current.id;
  }

  const assignment = await prisma.mentorAssignment.findFirst({
    where: {
      mentorId: mentor.id,
      studentId,
      sessionId: resolvedSessionId,
      active: true,
      unassignedAt: null,
    },
    select: { id: true },
  });
  if (!assignment) throw new AccessDeniedError();

  return { mentorId: mentor.id, sessionId: resolvedSessionId, assignmentId: assignment.id };
}

/**
 * Every sensitive mentor read/write goes through here: it runs the guard, AUDITS
 * the outcome (granted → `action`; denied → `mentor.access.denied`), then runs the
 * operation. Audit is keyed by the STUDENT (the safeguarding subject) with the
 * mentor as actor, so "who accessed this student, when, and how" is one query.
 */
export async function withMentorAccess<T>(
  params: { mentorUserId: string; studentId: string; action: string; sessionId?: string },
  op: (ctx: MentorAccessContext) => Promise<T>,
): Promise<T> {
  const { mentorUserId, studentId, action, sessionId } = params;
  let ctx: MentorAccessContext;
  try {
    ctx = await assertMentorCanAccess(mentorUserId, studentId, sessionId);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      await recordAudit(prisma, {
        actorUserId: mentorUserId,
        action: "mentor.access.denied",
        entityType: "Student",
        entityId: studentId,
        reason: action,
      });
    }
    throw e;
  }

  try {
    const result = await op(ctx);
    await recordAudit(prisma, {
      actorUserId: mentorUserId,
      action,
      entityType: "Student",
      entityId: studentId,
      after: { sessionId: ctx.sessionId },
    });
    return result;
  } catch (e) {
    // The guard passed, but the operation itself denied access (e.g. owner-scope:
    // editing another mentor's evaluation). Still a denied attempt — audit it.
    if (e instanceof AccessDeniedError) {
      await recordAudit(prisma, {
        actorUserId: mentorUserId,
        action: "mentor.access.denied",
        entityType: "Student",
        entityId: studentId,
        reason: action,
      });
    }
    throw e;
  }
}
