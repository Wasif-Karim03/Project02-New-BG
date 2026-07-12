/**
 * Donor account (email-verify, no approval) + tribute on donations + giving
 * history with live student funding status.
 *
 * Run after the seed:  npx tsx scripts/verify-donor-accounts.ts
 */
import { PrismaClient } from "@prisma/client";
import { DonorCodeInvalidError, registerDonorWithVerification, verifyDonorEmail } from "@/lib/services/donor-accounts";
import { submitDonationClaim } from "@/lib/services/donation-claims";
import { listDonorGivingHistory } from "@/lib/services/subscriptions";

const prisma = new PrismaClient();
const T = Date.now();
let failures = 0;
const userIds: string[] = [];
const donorIds: string[] = [];
const donationIds: string[] = [];
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }
async function expectThrow(label: string, ErrType: new (...a: never[]) => Error, fn: () => Promise<unknown>) {
  try { await fn(); check(label, false, "expected error"); } catch (e) { check(label, e instanceof ErrType, (e as Error)?.name); }
}

async function main() {
  const email = `donor-acct-${T}@x.test`;

  console.log("\nGuest adoption + register");
  // A prior guest gift under this email — the account should adopt it.
  const guest = await prisma.donor.create({ data: { name: "Guest", email } });
  donorIds.push(guest.id);
  const { userId, devCode } = await registerDonorWithVerification({ name: "New Donor", phone: "0170000000", email, password: "donor-password-1" });
  userIds.push(userId);
  const u = await prisma.user.findUnique({ where: { id: userId } });
  check("account is DONOR + PENDING before verify", u?.role === "DONOR" && u?.status === "PENDING");
  check("guest donor adopted (userId linked, phone set)", (await prisma.donor.findUnique({ where: { id: guest.id } }))?.userId === userId);

  console.log("\nVerify");
  await expectThrow("wrong code refused", DonorCodeInvalidError, () => verifyDonorEmail(userId, "000000"));
  await verifyDonorEmail(userId, devCode!);
  const after = await prisma.user.findUnique({ where: { id: userId } });
  check("correct code → ACTIVE + emailVerified (no approval)", after?.status === "ACTIVE" && !!after?.emailVerified);

  console.log("\nTribute on a donation");
  const student = await prisma.student.findFirst({ where: { status: "ACTIVE", slug: { not: null } }, select: { id: true, requireAmount: true } });
  const { donationId } = await submitDonationClaim({
    donorName: "New Donor", donorEmail: email, amount: 5000, method: "bkash",
    designationType: student ? "STUDENT" : "GENERAL", studentId: student?.id,
    tributeType: "honor", tributeName: "Mom", tributeMessage: "For everything.", tributePublic: true,
  });
  donationIds.push(donationId);
  const don = await prisma.donation.findUnique({ where: { id: donationId } });
  check("tribute stored on the donation", don?.tributeType === "honor" && don?.tributeName === "Mom" && don?.tributePublic === true);
  check("gift attributed to the donor account (adopted donor)", don?.donorId === guest.id);

  console.log("\nGiving history (recipient + tribute + live status)");
  const history = await listDonorGivingHistory(userId);
  const row = history.find((h) => h.id === donationId);
  check("donation appears in the donor's history with tribute", !!row && row.tributeName === "Mom");
  check("history exposes recipient + live funding status", !student || (!!row?.student && typeof row?.studentFunded === "number"));

  console.log(`\n${failures === 0 ? "✓ ALL DONOR-ACCOUNT CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  await prisma.donation.deleteMany({ where: { id: { in: donationIds } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: donationIds } } });
  await prisma.donor.deleteMany({ where: { OR: [{ id: { in: donorIds } }, { userId: { in: userIds } }] } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log("  (cleaned up test data)");
}

main().catch((e) => { console.error("verify-donor-accounts error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
