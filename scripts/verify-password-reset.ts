/**
 * Password reset verification: request creates a token (and does NOT enumerate
 * accounts), reset sets the new password + invalidates the token, and used/expired/
 * weak cases are refused.
 *
 * Run after the seed:  npx tsx scripts/verify-password-reset.ts
 */
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword } from "@/lib/password";
import { InvalidTokenError, WeakPasswordError, requestPasswordReset, resetPassword } from "@/lib/services/password-reset";

const prisma = new PrismaClient();
const T = Date.now();
const sha = (t: string) => createHash("sha256").update(t).digest("hex");
let failures = 0;
const userIds: string[] = [];
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }
async function expectThrow(label: string, ErrType: new (...a: never[]) => Error, fn: () => Promise<unknown>) {
  try { await fn(); check(label, false, "expected error"); } catch (e) { check(label, e instanceof ErrType, (e as Error)?.name); }
}
async function mkToken(userId: string, raw: string, expiresAt: Date) {
  return prisma.passwordResetToken.create({ data: { userId, tokenHash: sha(raw), expiresAt } });
}

async function main() {
  const user = await prisma.user.create({ data: { email: `pwreset-${T}@x.test`, role: "DONOR", status: "ACTIVE", passwordHash: await hashPassword("old-password-123") } });
  userIds.push(user.id);

  console.log("\nRequest (no account enumeration)");
  await requestPasswordReset(user.email);
  check("request creates a reset token for a real user", (await prisma.passwordResetToken.count({ where: { userId: user.id } })) === 1);
  await requestPasswordReset(`nobody-${T}@x.test`); // must not throw, must not create anything
  check("request for unknown email is a silent no-op", (await prisma.passwordResetToken.count({ where: { user: { email: `nobody-${T}@x.test` } } })) === 0);

  console.log("\nReset");
  const raw = randomBytes(16).toString("hex");
  await mkToken(user.id, raw, new Date(Date.now() + 3600_000));
  await resetPassword(raw, "brand-new-password");
  const after = await prisma.user.findUnique({ where: { id: user.id } });
  check("password is updated (new verifies, old doesn't)", (await verifyPassword("brand-new-password", after!.passwordHash)) && !(await verifyPassword("old-password-123", after!.passwordHash)));
  await expectThrow("a used token cannot be reused", InvalidTokenError, () => resetPassword(raw, "another-password-1"));

  console.log("\nRefusals");
  const expiredRaw = randomBytes(16).toString("hex");
  await mkToken(user.id, expiredRaw, new Date(Date.now() - 1000));
  await expectThrow("expired token refused", InvalidTokenError, () => resetPassword(expiredRaw, "another-password-1"));
  await expectThrow("unknown token refused", InvalidTokenError, () => resetPassword("deadbeef", "another-password-1"));
  const freshRaw = randomBytes(16).toString("hex");
  await mkToken(user.id, freshRaw, new Date(Date.now() + 3600_000));
  await expectThrow("weak password refused", WeakPasswordError, () => resetPassword(freshRaw, "short"));

  console.log(`\n${failures === 0 ? "✓ ALL PASSWORD-RESET CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: userIds } } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log("  (cleaned up test data)");
}

main().catch((e) => { console.error("verify-password-reset error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
