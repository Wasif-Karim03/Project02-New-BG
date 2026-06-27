import type { AccountStatus } from "@prisma/client";

/**
 * Sign-in gate (all providers). Only ACTIVE accounts may hold a session.
 * PENDING (awaiting approval), SUSPENDED, and REJECTED are refused. This is the
 * foundation Phase B's approval queue flips: PENDING -> ACTIVE enables login.
 *
 * Kept dependency-free (type-only import) so it can be unit-tested and reused
 * without pulling in Prisma/NextAuth.
 */
export function isSignInAllowed(status: AccountStatus): boolean {
  return status === "ACTIVE";
}
