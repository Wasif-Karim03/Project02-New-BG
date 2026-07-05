/**
 * Staff & user management: role changes (with Mentor row), status changes, invites
 * (ACTIVE account + set-password token), and the self-action / duplicate guards.
 *
 * Run after the seed:  npx tsx scripts/verify-user-management.ts
 */
import { PrismaClient } from "@prisma/client";
import { InviteEmailInUseError, SelfActionError, inviteStaff, setUserRole, setUserStatus } from "@/lib/services/user-management";

const prisma = new PrismaClient();
const T = Date.now();
let failures = 0;
const userIds: string[] = [];
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }
async function expectThrow(label: string, ErrType: new (...a: never[]) => Error, fn: () => Promise<unknown>) {
  try { await fn(); check(label, false, "expected error"); } catch (e) { check(label, e instanceof ErrType, (e as Error)?.name); }
}

async function main() {
  const seedAdmin = (await prisma.user.findUniqueOrThrow({ where: { email: "admin@bridginggenerations.org" } })).id;
  const adminA = await prisma.user.create({ data: { email: `admina-${T}@x.test`, role: "ADMIN", status: "ACTIVE" } });
  const donorD = await prisma.user.create({ data: { email: `donord-${T}@x.test`, role: "DONOR", status: "ACTIVE" } });
  userIds.push(adminA.id, donorD.id);

  console.log("\nRole changes");
  await setUserRole(seedAdmin, donorD.id, "MENTOR");
  check("DONOR → MENTOR updates role", (await prisma.user.findUnique({ where: { id: donorD.id } }))?.role === "MENTOR");
  check("promotion to MENTOR creates a Mentor row", !!(await prisma.mentor.findUnique({ where: { userId: donorD.id } })));
  check("role change audited", !!(await prisma.auditLog.findFirst({ where: { action: "user.role.change", entityId: donorD.id } })));

  console.log("\nSelf-action guards");
  await expectThrow("cannot demote yourself from admin", SelfActionError, () => setUserRole(adminA.id, adminA.id, "DONOR"));
  await expectThrow("cannot suspend your own account", SelfActionError, () => setUserStatus(adminA.id, adminA.id, "SUSPENDED"));
  check("admin A unchanged after refused self-actions", (await prisma.user.findUnique({ where: { id: adminA.id } }))?.role === "ADMIN");

  console.log("\nStatus changes");
  await setUserStatus(seedAdmin, donorD.id, "SUSPENDED");
  check("suspend sets SUSPENDED + audits", (await prisma.user.findUnique({ where: { id: donorD.id } }))?.status === "SUSPENDED" && !!(await prisma.auditLog.findFirst({ where: { action: "user.status.change", entityId: donorD.id } })));
  await setUserStatus(seedAdmin, donorD.id, "ACTIVE");
  check("reactivate sets ACTIVE", (await prisma.user.findUnique({ where: { id: donorD.id } }))?.status === "ACTIVE");

  console.log("\nInvite");
  const invited = await inviteStaff(seedAdmin, `invitee-${T}@x.test`, "MENTOR");
  userIds.push(invited.id);
  check("invitee is ACTIVE MENTOR with a Mentor row", invited.status === "ACTIVE" && invited.role === "MENTOR" && !!(await prisma.mentor.findUnique({ where: { userId: invited.id } })));
  check("invitee gets a set-password token", (await prisma.passwordResetToken.count({ where: { userId: invited.id } })) === 1);
  check("invite audited", !!(await prisma.auditLog.findFirst({ where: { action: "user.invite", entityId: invited.id } })));
  await expectThrow("duplicate-email invite refused", InviteEmailInUseError, () => inviteStaff(seedAdmin, donorD.email, "MENTOR"));

  console.log(`\n${failures === 0 ? "✓ ALL USER-MANAGEMENT CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: userIds } } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.mentor.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log("  (cleaned up test data)");
}

main().catch((e) => { console.error("verify-user-management error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
