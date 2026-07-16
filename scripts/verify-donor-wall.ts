/**
 * Donor public-wall approval: PENDING → APPROVED / REJECTED, audited, and only
 * PENDING non-anonymous donors are reviewable.
 *
 * Run after the seed:  npx tsx scripts/verify-donor-wall.ts
 */
import { PrismaClient } from "@prisma/client";
import { DonorNotReviewableError, approveDonorWall, listPendingWallDonors, rejectDonorWall } from "@/lib/services/donor-wall";

const prisma = new PrismaClient();
const T = Date.now();
let failures = 0;
const donorIds: string[] = [];
let adminId = "";
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }
async function expectThrow(label: string, ErrType: new (...a: never[]) => Error, fn: () => Promise<unknown>) {
  try { await fn(); check(label, false, "expected error"); } catch (e) { check(label, e instanceof ErrType, (e as Error)?.name); }
}

async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" }, select: { id: true } });
  adminId = admin.id;

  const pending = await prisma.donor.create({ data: { name: `Wall Pending ${T}`, email: `wall-p-${T}@x.test`, wallStatus: "PENDING", isAnonymous: false, avatarUrl: `/api/files/donors/a-${T}.jpg` } });
  const toReject = await prisma.donor.create({ data: { name: `Wall Reject ${T}`, email: `wall-r-${T}@x.test`, wallStatus: "PENDING", isAnonymous: false } });
  const anon = await prisma.donor.create({ data: { name: `Anon ${T}`, wallStatus: "NONE", isAnonymous: true } });
  donorIds.push(pending.id, toReject.id, anon.id);

  console.log("\nQueue");
  const queue = await listPendingWallDonors();
  check("PENDING non-anonymous donor is in the review queue", queue.some((d) => d.id === pending.id));
  check("anonymous donor is NOT in the queue", !queue.some((d) => d.id === anon.id));

  console.log("\nApprove / reject");
  await approveDonorWall(adminId, pending.id);
  check("approve → wallStatus APPROVED", (await prisma.donor.findUnique({ where: { id: pending.id } }))?.wallStatus === "APPROVED");
  check("approval audited", (await prisma.auditLog.count({ where: { entityId: pending.id, action: "donor.wall.approve" } })) === 1);

  await rejectDonorWall(adminId, toReject.id);
  check("decline → wallStatus REJECTED", (await prisma.donor.findUnique({ where: { id: toReject.id } }))?.wallStatus === "REJECTED");

  console.log("\nGuards");
  await expectThrow("re-approving a non-PENDING donor is refused", DonorNotReviewableError, () => approveDonorWall(adminId, pending.id));
  await expectThrow("reviewing an anonymous donor is refused", DonorNotReviewableError, () => approveDonorWall(adminId, anon.id));

  console.log(`\n${failures === 0 ? "✓ ALL DONOR-WALL CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: donorIds } } });
  await prisma.donor.deleteMany({ where: { id: { in: donorIds } } });
  console.log("  (cleaned up test data)");
}

main().catch((e) => { console.error("verify-donor-wall error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
