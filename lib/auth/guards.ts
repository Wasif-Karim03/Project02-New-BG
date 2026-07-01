import { auth } from "@/auth";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export type SessionUser = {
  id: string;
  role: "ADMIN" | "MENTOR" | "DONOR" | "STUDENT";
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";
  email?: string | null;
  name?: string | null;
};

/** Require an authenticated, ACTIVE user. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user || user.status !== "ACTIVE") throw new ForbiddenError("Authentication required");
  return user;
}

/** Require an ACTIVE admin. Used by every approval action. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ForbiddenError("Admin access required");
  return user;
}

/** Require an ACTIVE mentor (e.g. to register a student into the queue). */
export async function requireActiveMentor(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "MENTOR") throw new ForbiddenError("Mentor access required");
  return user;
}
