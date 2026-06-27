/**
 * Phase A auth verification (browser-free). Exercises the SAME building blocks
 * the Auth.js Credentials provider uses (lib/password, lib/auth/signin-policy)
 * and replicates the authorize() + jwt()/session() callback logic to assert:
 *
 *   (a) the seeded ACTIVE admin can sign in (correct password + ACTIVE),
 *   (b) role + status are present on the JWT and the session,
 *   (c) PENDING and SUSPENDED accounts are refused (even with a correct password),
 *       and a wrong password is refused.
 *
 * Run after the seed:  npx tsx scripts/verify-auth.ts
 */
import { PrismaClient } from "@prisma/client";
import { isSignInAllowed } from "../lib/auth/signin-policy";
import { hashPassword, verifyPassword } from "../lib/password";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@bridginggenerations.org";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Admin-dev";
const TEMP_PASSWORD = "temp-pass-123";
const PENDING_EMAIL = "verify-pending@example.test";
const SUSPENDED_EMAIL = "verify-suspended@example.test";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}

// Mirror of auth.ts authorize(): email+password valid AND status allows sign-in.
async function simulateAuthorize(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  if (!isSignInAllowed(user.status)) return null; // refuse PENDING/SUSPENDED/REJECTED
  return { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status };
}

// Mirror of auth.ts jwt() + session() callbacks.
function simulateJwtAndSession(user: { id: string; role: string; status: string }) {
  const token = { uid: user.id, role: user.role, status: user.status };
  const session = { user: { id: token.uid, role: token.role, status: token.status } };
  return { token, session };
}

async function main() {
  console.log("\n(a) Seeded ACTIVE admin can sign in");
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  check("admin exists", !!admin, admin ? `id=${admin.id}` : "not found — run the seed first");
  if (admin) {
    check("admin.status is ACTIVE", admin.status === "ACTIVE", admin.status);
    check("admin.passwordHash is set", !!admin.passwordHash);
    check("password verifies", await verifyPassword(ADMIN_PASSWORD, admin.passwordHash));
    const authed = await simulateAuthorize(ADMIN_EMAIL, ADMIN_PASSWORD);
    check("authorize() returns the admin", !!authed, authed ? `role=${authed.role}` : "refused");

    console.log("\n(b) role + status present on JWT and session");
    if (authed) {
      const { token, session } = simulateJwtAndSession(authed);
      check("JWT carries role", token.role === "ADMIN", `role=${token.role}`);
      check("JWT carries status", token.status === "ACTIVE", `status=${token.status}`);
      check("session.user.role present", session.user.role === "ADMIN", `role=${session.user.role}`);
      check("session.user.status present", session.user.status === "ACTIVE", `status=${session.user.status}`);
      check("session.user.id present", !!session.user.id);
    }
  }

  console.log("\n(c) PENDING / SUSPENDED / wrong-password are refused");
  const hash = await hashPassword(TEMP_PASSWORD);
  await prisma.user.upsert({
    where: { email: PENDING_EMAIL },
    update: { status: "PENDING", passwordHash: hash, role: "DONOR" },
    create: { email: PENDING_EMAIL, name: "Pending Tester", role: "DONOR", status: "PENDING", passwordHash: hash },
  });
  await prisma.user.upsert({
    where: { email: SUSPENDED_EMAIL },
    update: { status: "SUSPENDED", passwordHash: hash, role: "MENTOR" },
    create: { email: SUSPENDED_EMAIL, name: "Suspended Tester", role: "MENTOR", status: "SUSPENDED", passwordHash: hash },
  });
  try {
    const pending = await simulateAuthorize(PENDING_EMAIL, TEMP_PASSWORD);
    check("PENDING refused despite correct password", pending === null);
    const suspended = await simulateAuthorize(SUSPENDED_EMAIL, TEMP_PASSWORD);
    check("SUSPENDED refused despite correct password", suspended === null);
    const wrongPw = await simulateAuthorize(ADMIN_EMAIL, "definitely-wrong");
    check("wrong password refused", wrongPw === null);
    // Sanity: the temp users DO have a valid password (proves refusal is the
    // status gate, not a password failure).
    const pendingRow = await prisma.user.findUnique({ where: { email: PENDING_EMAIL } });
    check("PENDING password itself is valid (so refusal is the status gate)", await verifyPassword(TEMP_PASSWORD, pendingRow!.passwordHash));
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [PENDING_EMAIL, SUSPENDED_EMAIL] } } });
    console.log("\n  (cleaned up temp test users)");
  }

  console.log(`\n${failures === 0 ? "✓ ALL AUTH CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}\n`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch(async (e) => {
    console.error("verify-auth failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
