/**
 * Manual pledges (F2): create a no-Stripe recurring pledge, log payments as they
 * arrive (→ SUCCEEDED linked Donations + receipts, counting toward totals), the
 * "due" flag flips after payment, and cancel ends it. All audited.
 *
 * Run after the seed:  npx tsx scripts/verify-pledges.ts
 */
import { PrismaClient } from "@prisma/client";
import { cancelManualPledge, createManualPledge, listManualPledges, recordPledgePayment } from "@/lib/services/pledges";
import { sumSucceededDonations } from "@/lib/services/totals";

const prisma = new PrismaClient();
const T = Date.now();
let failures = 0;
const subIds: string[] = [];
const donorIds: string[] = [];
const donationIds: string[] = [];
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }

async function main() {
  const admin = (await prisma.user.findUniqueOrThrow({ where: { email: "admin@bridginggenerations.org" } })).id;

  console.log("\nCreate pledge (no Stripe)");
  const pledge = await createManualPledge(admin, { donorName: `Pledger ${T}`, amount: 3000, interval: "month", designationType: "GENERAL" });
  subIds.push(pledge.id); donorIds.push(pledge.donorId);
  check("pledge is a Subscription with NO stripe id, ACTIVE", pledge.stripeSubscriptionId === null && pledge.status === "ACTIVE");
  check("pledge.create audited", !!(await prisma.auditLog.findFirst({ where: { action: "pledge.create", entityId: pledge.id } })));
  let listed = await listManualPledges();
  check("appears in active pledges, marked DUE (no payment yet)", listed.some((p) => p.id === pledge.id && p.due === true));

  console.log("\nLog a payment → SUCCEEDED linked donation (+receipt, counts)");
  const before = await sumSucceededDonations();
  const don = await recordPledgePayment(admin, pledge.id, { method: "bkash", reference: "TRX-1" });
  donationIds.push(don.id);
  check("payment → SUCCEEDED, recurring, linked to the pledge", don.status === "SUCCEEDED" && don.isRecurring === true && don.subscriptionId === pledge.id);
  check("amount defaulted to the pledge amount (3000)", don.amount === 3000);
  check("counts toward totals (+3000)", (await sumSucceededDonations()) - before === 3000);
  check("receipt generated + payment audited", !!(await prisma.receipt.findUnique({ where: { donationId: don.id } })) && !!(await prisma.auditLog.findFirst({ where: { action: "pledge.payment", entityId: pledge.id } })));
  listed = await listManualPledges();
  check("pledge is no longer DUE after payment this period", listed.find((p) => p.id === pledge.id)?.due === false);

  console.log("\nCancel");
  await cancelManualPledge(admin, pledge.id);
  check("cancel → CANCELED, drops off active pledges", (await prisma.subscription.findUnique({ where: { id: pledge.id } }))?.status === "CANCELED" && !(await listManualPledges()).some((p) => p.id === pledge.id));

  console.log(`\n${failures === 0 ? "✓ ALL PLEDGE CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...subIds, ...donationIds] } } });
  await prisma.donation.deleteMany({ where: { id: { in: donationIds } } });
  await prisma.subscription.deleteMany({ where: { id: { in: subIds } } });
  await prisma.donor.deleteMany({ where: { id: { in: [...new Set(donorIds)] } } });
  console.log("  (cleaned up test data)");
}

main().catch((e) => { console.error("verify-pledges error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
