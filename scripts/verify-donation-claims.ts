/**
 * Free donation flow (F1): donor claim → admin confirm/decline. Proves a claim is
 * PENDING (doesn't count) until confirmed; confirm → SUCCEEDED (+receipt, counts);
 * decline needs a reason → FAILED; verified-email match; all audited.
 *
 * Run after the seed:  npx tsx scripts/verify-donation-claims.ts
 */
import { PrismaClient } from "@prisma/client";
import { NotPendingError, ReasonRequiredError, confirmDonation, declineDonation, listPendingDonations, submitDonationClaim } from "@/lib/services/donation-claims";
import { sumSucceededDonations } from "@/lib/services/totals";

const prisma = new PrismaClient();
const T = Date.now();
let failures = 0;
const donationIds: string[] = [];
const donorIds: string[] = [];
const userIds: string[] = [];
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }
async function expectThrow(label: string, ErrType: new (...a: never[]) => Error, fn: () => Promise<unknown>) {
  try { await fn(); check(label, false, "expected error"); } catch (e) { check(label, e instanceof ErrType, (e as Error)?.name); }
}
async function track(donationId: string) { donationIds.push(donationId); const d = await prisma.donation.findUnique({ where: { id: donationId }, select: { donorId: true } }); if (d) donorIds.push(d.donorId); }

async function main() {
  const admin = (await prisma.user.findUniqueOrThrow({ where: { email: "admin@bridginggenerations.org" } })).id;
  const verified = await prisma.user.create({ data: { email: `donorclaim-${T}@x.test`, name: "Verified Vera", role: "DONOR", status: "ACTIVE", emailVerified: new Date() } });
  userIds.push(verified.id);

  console.log("\nSubmit claim → PENDING (does not count yet)");
  const before = await sumSucceededDonations();
  const { donationId } = await submitDonationClaim({ donorName: "Guest Giver", amount: 3000, designationType: "GENERAL", method: "bkash", reference: "TRX123" });
  await track(donationId);
  const d1 = await prisma.donation.findUnique({ where: { id: donationId } });
  check("claim is PENDING, source OTHER, note captures method+ref", d1?.status === "PENDING" && d1?.source === "OTHER" && (d1?.note ?? "").includes("bkash") && (d1?.note ?? "").includes("TRX123"));
  check("PENDING claim does NOT count toward totals", (await sumSucceededDonations()) - before === 0);
  check("claim appears in the pending queue", (await listPendingDonations()).some((p) => p.id === donationId));
  check("submit is audited", !!(await prisma.auditLog.findFirst({ where: { action: "donation.claim.submit", entityId: donationId } })));

  console.log("\nVerified-email match");
  const { donationId: d2id } = await submitDonationClaim({ donorName: "Verified Vera", donorEmail: verified.email, amount: 2000, designationType: "GENERAL", method: "bank" });
  await track(d2id);
  const d2 = await prisma.donation.findUnique({ where: { id: d2id }, include: { donor: true } });
  check("verified email → matched to the account", d2?.donor.userId === verified.id);

  console.log("\nConfirm → SUCCEEDED (+receipt, counts)");
  const beforeConfirm = await sumSucceededDonations();
  await confirmDonation(admin, donationId);
  const confirmed = await prisma.donation.findUnique({ where: { id: donationId } });
  check("confirm → SUCCEEDED", confirmed?.status === "SUCCEEDED");
  check("now counts toward totals (+3000)", (await sumSucceededDonations()) - beforeConfirm === 3000);
  check("receipt was generated", !!(await prisma.receipt.findUnique({ where: { donationId } })));
  check("confirm is audited", !!(await prisma.auditLog.findFirst({ where: { action: "donation.claim.confirm", entityId: donationId } })));
  await expectThrow("cannot re-confirm a non-pending donation", NotPendingError, () => confirmDonation(admin, donationId));

  console.log("\nDecline (reason required)");
  await expectThrow("decline without a reason refused", ReasonRequiredError, () => declineDonation(admin, d2id, "  "));
  await declineDonation(admin, d2id, "No matching transfer found");
  check("decline → FAILED + reason in note/audit", (await prisma.donation.findUnique({ where: { id: d2id } }))?.status === "FAILED" && !!(await prisma.auditLog.findFirst({ where: { action: "donation.claim.decline", entityId: d2id } })));

  console.log(`\n${failures === 0 ? "✓ ALL DONATION-CLAIM CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: donationIds } } });
  await prisma.donation.deleteMany({ where: { id: { in: donationIds } } });
  await prisma.donor.deleteMany({ where: { id: { in: [...new Set(donorIds)] } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log("  (cleaned up test data)");
}

main().catch((e) => { console.error("verify-donation-claims error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
