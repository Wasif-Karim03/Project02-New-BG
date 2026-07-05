import { createHash, randomBytes } from "node:crypto";
import { sendEmail } from "@/lib/email";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/services/audit";

const TTL_MS = 60 * 60 * 1000; // 1 hour
const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

export class InvalidTokenError extends Error {
  constructor() { super("This reset link is invalid or has expired."); this.name = "InvalidTokenError"; }
}
export class WeakPasswordError extends Error {
  constructor() { super("Password must be at least 10 characters."); this.name = "WeakPasswordError"; }
}

/**
 * Email a reset link. The raw token is emailed; only its SHA-256 hash is stored.
 * ALWAYS behaves identically whether or not the email exists (no account
 * enumeration). Returns nothing observable to the caller.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized }, select: { id: true } });
  if (!user) return; // silent — don't reveal whether the account exists

  const raw = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + TTL_MS) },
  });
  const url = `${process.env.AUTH_URL || "http://localhost:3000"}/reset-password?token=${raw}`;
  await sendEmail({
    to: normalized,
    subject: "Reset your Bridging Generations password",
    text: `Reset your password using this link (valid for 1 hour):\n${url}\n\nIf you didn't request this, you can ignore this email.`,
  });
}

/** Consume a reset token and set the new password. Invalidates all the user's tokens. */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 10) throw new WeakPasswordError();
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw new InvalidTokenError();

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  await recordAudit(prisma, { actorUserId: row.userId, action: "user.password_reset", entityType: "User", entityId: row.userId });
}
