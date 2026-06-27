import type { AccountStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { isSignInAllowed } from "@/lib/auth/signin-policy";

// Re-export so existing importers (auth.ts) can keep getting it from here.
export { isSignInAllowed };

/** The minimal identity we put on the JWT/session. No PII beyond name/email. */
export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: AccountStatus;
};

/**
 * Verify an email + password pair. Returns the user identity iff the email exists
 * AND a password is set AND it matches. Does NOT enforce account status — callers
 * apply isSignInAllowed() separately so "correct password but PENDING" is still
 * refused, and so the refusal reason can be distinguished from a bad password.
 * Returns null (never throws) on any miss; the work is constant-ish either way.
 */
export async function verifyCredentials(email: string, password: string): Promise<AuthUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) return null;

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) return null;

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status };
}
