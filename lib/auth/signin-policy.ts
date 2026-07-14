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

/**
 * Why a set of VALID credentials is still refused a session. Used by the login
 * action to show a distinct, friendly message ("awaiting review" vs "not
 * approved") — but ONLY after the password has been verified, so a wrong
 * password never reveals whether an account exists (non-enumerating).
 * Returns null when the status is allowed to sign in.
 */
export type SignInBlockReason = "pending" | "rejected" | "suspended";

export function signInBlockReason(status: AccountStatus): SignInBlockReason | null {
  switch (status) {
    case "PENDING":
      return "pending";
    case "REJECTED":
      return "rejected";
    case "SUSPENDED":
      return "suspended";
    default:
      return null; // ACTIVE
  }
}
