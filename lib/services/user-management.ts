import type { AccountStatus, Role } from "@prisma/client";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/services/audit";
import { createResetToken } from "@/lib/services/password-reset";

export class LastAdminError extends Error { constructor() { super("Cannot remove or suspend the last active admin."); this.name = "LastAdminError"; } }
export class SelfActionError extends Error { constructor(m: string) { super(m); this.name = "SelfActionError"; } }
export class InviteEmailInUseError extends Error { constructor() { super("An account with that email already exists."); this.name = "InviteEmailInUseError"; } }

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function activeAdminCount(excludeUserId?: string) {
  return prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE", ...(excludeUserId ? { id: { not: excludeUserId } } : {}) } });
}

export async function listUsers() {
  return prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, status: true, createdAt: true, emailVerified: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}

/** Change a user's role. Protects self-demotion and the last active admin. Audited. */
export async function setUserRole(adminUserId: string, userId: string, role: Role) {
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (userId === adminUserId && role !== "ADMIN") throw new SelfActionError("You cannot change your own admin role.");
  if (target.role === "ADMIN" && role !== "ADMIN" && (await activeAdminCount(userId)) === 0) throw new LastAdminError();

  const updated = await prisma.user.update({ where: { id: userId }, data: { role } });
  if (role === "MENTOR") await prisma.mentor.upsert({ where: { userId }, create: { userId }, update: {} });
  await recordAudit(prisma, { actorUserId: adminUserId, action: "user.role.change", entityType: "User", entityId: userId, before: { role: target.role }, after: { role } });
  return updated;
}

/** Suspend / reactivate an account. Protects self-suspension and the last admin. Audited. */
export async function setUserStatus(adminUserId: string, userId: string, status: AccountStatus) {
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (userId === adminUserId && status !== "ACTIVE") throw new SelfActionError("You cannot suspend your own account.");
  if (target.role === "ADMIN" && status !== "ACTIVE" && (await activeAdminCount(userId)) === 0) throw new LastAdminError();

  const updated = await prisma.user.update({ where: { id: userId }, data: { status } });
  await recordAudit(prisma, { actorUserId: adminUserId, action: "user.status.change", entityType: "User", entityId: userId, before: { status: target.status }, after: { status } });
  return updated;
}

/** Invite a staff member (admin or mentor): create an ACTIVE account + email a set-password link. */
export async function inviteStaff(adminUserId: string, email: string, role: "ADMIN" | "MENTOR") {
  const normalized = email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email: normalized }, select: { id: true } })) throw new InviteEmailInUseError();

  const user = await prisma.user.create({ data: { email: normalized, role, status: "ACTIVE", emailVerified: new Date() } });
  if (role === "MENTOR") await prisma.mentor.create({ data: { userId: user.id } });

  const raw = await createResetToken(user.id, INVITE_TTL_MS);
  const url = `${process.env.AUTH_URL || "http://localhost:3000"}/reset-password?token=${raw}`;
  await sendEmail({
    to: normalized,
    subject: "You've been invited to Bridging Generations",
    text: `You've been added as a ${role.toLowerCase()}. Set your password to sign in (link valid 7 days):\n${url}`,
  });
  await recordAudit(prisma, { actorUserId: adminUserId, action: "user.invite", entityType: "User", entityId: user.id, after: { email: normalized, role } });
  return user;
}
