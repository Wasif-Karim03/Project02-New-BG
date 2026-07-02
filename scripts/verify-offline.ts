/**
 * Phase F verification. Proves:
 *   - offline gift (CASH) is created, editable, audited; a receipt is issued
 *   - a LEGACY isHistorical row gets NO receipt but STILL counts toward totals
 *   - editing a Stripe row is refused (immutable); void + adjustment are the path
 *   - void-with-reason works (empty reason refused); a negative adjustment reduces totals
 *   - CSV import: dry-run validates with NO writes; commit writes valid rows as
 *     isHistorical LEGACY donations, skipping (and reporting) invalid ones
 *
 * Run after the seed:  npx tsx scripts/verify-offline.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  ReasonRequiredError,
  StripeRowImmutableError,
  createOfflineDonation,
  postAdjustment,
  updateDonationNote,
  updateOfflineDonation,
  voidDonation,
} from "@/lib/services/offline-donations";
import { commitImport, dryRunImport } from "@/lib/services/legacy-import";
import { sumSucceededDonations } from "@/lib/services/totals";

const prisma = new PrismaClient();
const T = Date.now();
const MARK = `imp-${T}`;
const CSV_MARK = `csv-${T}`;

let failures = 0;
const donationIds: string[] = [];
const donorIds: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}
async function expectThrow(label: string, ErrType: new (...a: never[]) => Error, fn: () => Promise<unknown>) {
  try { await fn(); check(label, false, "expected an error but it succeeded"); }
  catch (e) { check(label, e instanceof ErrType, e instanceof ErrType ? "" : `wrong error: ${(e as Error)?.name}`); }
}

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@bridginggenerations.org" } });
  const project = await prisma.project.create({ data: { title: `Legacy Proj ${T}`, slug: `legacy-proj-${T}`, fundingGoal: 1_000_000, currency: "USD" } });

  console.log("\nOffline create (CASH, non-historical) — editable, audited, receipted");
  const cash = await createOfflineDonation(admin.id, { amount: 4000, currency: "usd", source: "CASH", designationType: "GENERAL", occurredAt: new Date("2026-01-15"), isHistorical: false, donorName: "Cash Carla", note: MARK } as never);
  donationIds.push(cash.id); donorIds.push(cash.donorId);
  check("CASH donation SUCCEEDED, source CASH, createdBy admin", cash.status === "SUCCEEDED" && cash.source === "CASH" && cash.createdById === admin.id);
  check("non-historical → receipt issued", !!(await prisma.receipt.findUnique({ where: { donationId: cash.id } })));
  const edited = await updateOfflineDonation(admin.id, cash.id, { amount: 4500, note: `${MARK} corrected` });
  check("offline row is editable (amount 4000 → 4500)", edited.amount === 4500);
  check("edit is audited", !!(await prisma.auditLog.findFirst({ where: { action: "donation.offline.update", entityId: cash.id } })));

  console.log("\nLEGACY isHistorical — no receipt, but counts toward totals");
  const before = await sumSucceededDonations();
  const legacy = await createOfflineDonation(admin.id, { amount: 5000, currency: "usd", source: "LEGACY", designationType: "GENERAL", occurredAt: new Date("2019-06-01"), isHistorical: true, donorName: "Legacy Larry", note: MARK } as never);
  donationIds.push(legacy.id); donorIds.push(legacy.donorId);
  check("isHistorical → NO receipt", !(await prisma.receipt.findUnique({ where: { donationId: legacy.id } })));
  check("legacy row STILL counts toward totals (+5000)", (await sumSucceededDonations()) - before === 5000);

  console.log("\nStripe row is immutable; void + adjustment are the correction path");
  const stripeDonor = await prisma.donor.create({ data: { userId: null, name: "Stripe Steve" } });
  donorIds.push(stripeDonor.id);
  const stripeRow = await prisma.donation.create({ data: { donorId: stripeDonor.id, designationType: "GENERAL", amount: 9000, currency: "USD", source: "STRIPE", status: "SUCCEEDED", stripePaymentIntentId: `pi_${T}_imm`, idempotencyKey: `cs_${T}_imm`, occurredAt: new Date() } });
  donationIds.push(stripeRow.id);
  await expectThrow("editing a Stripe row is refused", StripeRowImmutableError, () => updateOfflineDonation(admin.id, stripeRow.id, { amount: 1 }));
  const noted = await updateDonationNote(admin.id, stripeRow.id, "donor called to confirm");
  check("non-financial note edit IS allowed on a Stripe row", noted.note === "donor called to confirm");

  console.log("\nVoid-with-reason and negative adjustment");
  await expectThrow("void without a reason is refused", ReasonRequiredError, () => voidDonation(admin.id, cash.id, "   "));
  const voided = await voidDonation(admin.id, cash.id, "entered twice");
  check("void sets VOIDED with reason, audited", voided.status === "VOIDED" && !!(await prisma.auditLog.findFirst({ where: { action: "donation.void", entityId: cash.id } })));
  const beforeAdj = await sumSucceededDonations();
  const adj = await postAdjustment(admin.id, { correctionOfId: legacy.id, amount: -500, note: `${MARK} overcount fix` });
  donationIds.push(adj.id);
  check("adjustment row links to original & is negative", adj.correctionOfId === legacy.id && adj.amount === -500);
  check("negative adjustment reduces the total (−500)", (await sumSucceededDonations()) - beforeAdj === -500);

  console.log("\nCSV import — dry-run (no writes) then commit");
  const csv = [
    "donorName,donorEmail,amountUsd,designationType,targetSlug,occurredAt,note",
    `Alice Alum,alice@x.test,25,GENERAL,,2020-03-01,${CSV_MARK}`,
    `Bob Board,,100,PROJECT,${project.slug},2021-09-15,${CSV_MARK}`,
    `Broken Row,,notanumber,GENERAL,,2020-01-01,${CSV_MARK}`,
  ].join("\n");

  const countLegacyBefore = await prisma.donation.count({ where: { note: CSV_MARK, source: "LEGACY" } });
  const preview = await dryRunImport(csv);
  check("dry-run: 2 valid, 1 error", preview.validCount === 2 && preview.errorCount === 1, JSON.stringify(preview.errors));
  check("dry-run performs NO writes", (await prisma.donation.count({ where: { note: CSV_MARK, source: "LEGACY" } })) === countLegacyBefore);

  const result = await commitImport(admin.id, csv);
  check("commit: imported 2, skipped 1", result.imported === 2 && result.skipped === 1);
  const imported = await prisma.donation.findMany({ where: { note: CSV_MARK, source: "LEGACY" } });
  const csvIds = imported.map((d) => d.id);
  donationIds.push(...csvIds);
  donorIds.push(...imported.map((d) => d.donorId));
  check("imported rows are isHistorical LEGACY", imported.length === 2 && imported.every((d) => d.isHistorical && d.source === "LEGACY"));
  check("imported rows have NO receipts", (await prisma.receipt.count({ where: { donationId: { in: csvIds } } })) === 0);

  console.log(`\n${failures === 0 ? "✓ ALL OFFLINE/LEGACY CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
  await cleanup(project.id);
}

async function cleanup(projectId: string) {
  const all = [...new Set(donationIds)];
  await prisma.auditLog.deleteMany({ where: { entityId: { in: all } } });
  await prisma.donation.deleteMany({ where: { id: { in: all } } });
  await prisma.donor.deleteMany({ where: { id: { in: [...new Set(donorIds)] } } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  console.log("  (cleaned up test data)");
}

main()
  .catch((e) => { console.error("verify-offline error:", e); failures++; })
  .finally(async () => { await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
