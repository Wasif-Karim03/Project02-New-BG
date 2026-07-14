import { prisma } from "@/lib/prisma";
import { sendDecisionEmail } from "@/lib/services/account-emails";
import { recordAudit } from "@/lib/services/audit";
import { generateUniqueStudentSlug } from "@/lib/slug";

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}
export class NotPendingError extends Error {
  constructor(what: string, status: string) {
    super(`${what} is not PENDING (current status: ${status})`);
    this.name = "NotPendingError";
  }
}
export class ReasonRequiredError extends Error {
  constructor() {
    super("A reason is required to reject.");
    this.name = "ReasonRequiredError";
  }
}

/**
 * The ONE approval queue. Two kinds of items funnel here:
 *   - accounts: PENDING Users (donor/mentor/student self-signups)
 *   - loginlessStudents: PENDING Students with no User (mentor-registered)
 * Self-signup students are represented by their User (the account); approving the
 * account cascades to the linked Student, so they are not double-listed.
 */
export async function listPendingQueue() {
  const [accounts, loginlessStudents] = await Promise.all([
    prisma.user.findMany({
      where: { status: "PENDING" },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.student.findMany({
      where: { status: "PENDING", userId: null },
      select: { id: true, firstName: true, schoolId: true, createdById: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { accounts, loginlessStudents };
}

// ── Account (User) decisions ────────────────────────────────────────────────

export async function approveUser(adminUserId: string, userId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, include: { student: true } });
    if (!user) throw new NotFoundError("User");
    if (user.status !== "PENDING") throw new NotPendingError("User", user.status);

    const updated = await tx.user.update({
      where: { id: userId },
      data: { status: "ACTIVE", reviewedById: adminUserId, reviewedAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: "user.approve",
      entityType: "User",
      entityId: userId,
      before: { status: "PENDING" },
      after: { status: "ACTIVE" },
    });

    // Cascade: a self-signup student's Student profile activates with the account
    // and receives its immutable public slug here.
    if (user.student && user.student.status === "PENDING") {
      const slug = user.student.slug ?? (await generateUniqueStudentSlug(user.student.firstName));
      await tx.student.update({
        where: { id: user.student.id },
        data: { status: "ACTIVE", slug, reviewedById: adminUserId, reviewedAt: new Date() },
      });
      await recordAudit(tx, {
        actorUserId: adminUserId,
        action: "student.approve",
        entityType: "Student",
        entityId: user.student.id,
        before: { status: "PENDING" },
        after: { status: "ACTIVE", slug },
        reason: "cascade from account approval",
      });
    }
    return { updated, email: user.email, name: user.name, role: user.role };
  });
  await sendDecisionEmail({ to: result.email, name: result.name, role: result.role, approved: true });
  return result.updated;
}

export async function rejectUser(adminUserId: string, userId: string, reason: string) {
  if (!reason?.trim()) throw new ReasonRequiredError();
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, include: { student: true } });
    if (!user) throw new NotFoundError("User");
    if (user.status !== "PENDING") throw new NotPendingError("User", user.status);

    const updated = await tx.user.update({
      where: { id: userId },
      data: { status: "REJECTED", reviewedById: adminUserId, reviewedAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: "user.reject",
      entityType: "User",
      entityId: userId,
      before: { status: "PENDING" },
      after: { status: "REJECTED" },
      reason: reason.trim(),
    });

    if (user.student && user.student.status === "PENDING") {
      await tx.student.update({
        where: { id: user.student.id },
        data: { status: "ARCHIVED", reviewedById: adminUserId, reviewedAt: new Date() },
      });
      await recordAudit(tx, {
        actorUserId: adminUserId,
        action: "student.reject",
        entityType: "Student",
        entityId: user.student.id,
        before: { status: "PENDING" },
        after: { status: "ARCHIVED" },
        reason: reason.trim(),
      });
    }
    return { updated, email: user.email, name: user.name, role: user.role };
  });
  await sendDecisionEmail({ to: result.email, name: result.name, role: result.role, approved: false });
  return result.updated;
}

// ── Login-less Student decisions (mentor-registered) ────────────────────────

export async function approveStudent(adminUserId: string, studentId: string) {
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundError("Student");
    if (student.status !== "PENDING") throw new NotPendingError("Student", student.status);

    const slug = student.slug ?? (await generateUniqueStudentSlug(student.firstName));
    const updated = await tx.student.update({
      where: { id: studentId },
      data: { status: "ACTIVE", slug, reviewedById: adminUserId, reviewedAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: "student.approve",
      entityType: "Student",
      entityId: studentId,
      before: { status: "PENDING" },
      after: { status: "ACTIVE", slug },
    });
    return updated;
  });
}

export async function rejectStudent(adminUserId: string, studentId: string, reason: string) {
  if (!reason?.trim()) throw new ReasonRequiredError();
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundError("Student");
    if (student.status !== "PENDING") throw new NotPendingError("Student", student.status);

    const updated = await tx.student.update({
      where: { id: studentId },
      data: { status: "ARCHIVED", reviewedById: adminUserId, reviewedAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: "student.reject",
      entityType: "Student",
      entityId: studentId,
      before: { status: "PENDING" },
      after: { status: "ARCHIVED" },
      reason: reason.trim(),
    });
    return updated;
  });
}
