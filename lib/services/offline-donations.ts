import { type Db, recordAudit } from "@/lib/services/audit";
import { generateReceipt } from "@/lib/services/receipts";
import { prisma } from "@/lib/prisma";
import type { OfflineDonationInput } from "@/lib/validation/offline-donations";

/** Attempting to edit financial fields of a settled Stripe row is refused. */
export class StripeRowImmutableError extends Error {
  constructor() {
    super("Stripe donations are immutable — void with reason or post an adjustment instead.");
    this.name = "StripeRowImmutableError";
  }
}
export class ReasonRequiredError extends Error {
  constructor() {
    super("A reason is required.");
    this.name = "ReasonRequiredError";
  }
}
export class NotFoundError extends Error {
  constructor() {
    super("Donation not found");
    this.name = "NotFoundError";
  }
}
/** A voided donation is settled — it can't be edited or adjusted (only viewed). */
export class VoidedRowError extends Error {
  constructor() {
    super("This donation is voided — editing or adjusting it is not allowed.");
    this.name = "VoidedRowError";
  }
}

async function resolveDonor(db: Db, input: OfflineDonationInput) {
  if (input.donorId) {
    const donor = await db.donor.findUnique({ where: { id: input.donorId } });
    if (!donor) throw new NotFoundError();
    return donor;
  }
  // Admin-entered data is trusted: reuse an existing donor with this email rather
  // than inflating the donor list with a duplicate. Prefer a linked account.
  const email = input.donorEmail?.trim().toLowerCase();
  if (email) {
    const match = await db.donor.findFirst({
      where: { email },
      orderBy: [{ userId: "desc" }, { createdAt: "asc" }], // linked account first, else earliest guest
    });
    if (match) return match;
  }
  return db.donor.create({ data: { userId: null, name: input.donorName!, email: email ?? input.donorEmail } });
}

/**
 * Record an offline gift (CASH/CHECK/BANK/LEGACY/OTHER). Fully admin-owned:
 * amount & date are supplied by the admin. isHistorical backfill rows never get a
 * receipt (generateReceipt guards on it) but still count toward computed totals.
 */
export async function createOfflineDonation(adminUserId: string, input: OfflineDonationInput) {
  return prisma.$transaction(async (tx) => {
    const donor = await resolveDonor(tx, input);
    const donation = await tx.donation.create({
      data: {
        donorId: donor.id,
        designationType: input.designationType,
        studentId: input.studentId,
        projectId: input.projectId,
        sessionId: input.sessionId,
        amount: input.amount,
        currency: "USD",
        source: input.source,
        status: "SUCCEEDED",
        isHistorical: input.isHistorical,
        occurredAt: input.occurredAt,
        note: input.note,
        createdById: adminUserId,
      },
    });
    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: "donation.offline.create",
      entityType: "Donation",
      entityId: donation.id,
      after: { source: input.source, amount: input.amount, isHistorical: input.isHistorical },
    });
    await generateReceipt(tx, donation); // no-op when isHistorical
    return donation;
  });
}

/** Edit an offline (non-Stripe) row. Stripe rows are refused (immutable). */
export async function updateOfflineDonation(
  adminUserId: string,
  donationId: string,
  patch: { amount?: number; source?: OfflineDonationInput["source"]; occurredAt?: Date; note?: string },
) {
  return prisma.$transaction(async (tx) => {
    const donation = await tx.donation.findUnique({ where: { id: donationId } });
    if (!donation) throw new NotFoundError();
    if (donation.source === "STRIPE") throw new StripeRowImmutableError();
    if (donation.status === "VOIDED") throw new VoidedRowError();

    const updated = await tx.donation.update({
      where: { id: donationId },
      data: { amount: patch.amount, source: patch.source, occurredAt: patch.occurredAt, note: patch.note },
    });
    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: "donation.offline.update",
      entityType: "Donation",
      entityId: donationId,
      before: { amount: donation.amount, source: donation.source, occurredAt: donation.occurredAt, note: donation.note },
      after: { amount: updated.amount, source: updated.source, occurredAt: updated.occurredAt, note: updated.note },
    });
    return updated;
  });
}

/** Void any donation (incl. Stripe) with a required reason. Audited. */
export async function voidDonation(adminUserId: string, donationId: string, reason: string) {
  if (!reason?.trim()) throw new ReasonRequiredError();
  return prisma.$transaction(async (tx) => {
    const donation = await tx.donation.findUnique({ where: { id: donationId } });
    if (!donation) throw new NotFoundError();
    const updated = await tx.donation.update({
      where: { id: donationId },
      data: { status: "VOIDED", voidedById: adminUserId, voidedReason: reason.trim(), voidedAt: new Date() },
    });
    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: "donation.void",
      entityType: "Donation",
      entityId: donationId,
      before: { status: donation.status },
      after: { status: "VOIDED" },
      reason: reason.trim(),
    });
    return updated;
  });
}

/**
 * Post a correction as a NEW adjustment row (never edit a settled row). The
 * adjustment inherits the original's donor + designation; its amount may be
 * negative to reduce a computed total. Linked via correctionOfId.
 */
export async function postAdjustment(
  adminUserId: string,
  input: { correctionOfId: string; amount: number; note?: string },
) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.donation.findUnique({ where: { id: input.correctionOfId } });
    if (!original) throw new NotFoundError();
    // Never re-inject value into a voided gift (would corrupt live totals/reports).
    if (original.status === "VOIDED") throw new VoidedRowError();
    const adjustment = await tx.donation.create({
      data: {
        donorId: original.donorId,
        designationType: original.designationType,
        studentId: original.studentId,
        projectId: original.projectId,
        sessionId: original.sessionId,
        amount: input.amount,
        currency: "USD",
        source: "OTHER",
        status: "SUCCEEDED",
        isHistorical: original.isHistorical,
        occurredAt: new Date(),
        note: input.note,
        createdById: adminUserId,
        correctionOfId: original.id,
      },
    });
    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: "donation.adjustment.create",
      entityType: "Donation",
      entityId: adjustment.id,
      after: { correctionOfId: original.id, amount: input.amount },
    });
    return adjustment;
  });
}

/** Non-financial note edit — allowed on ANY row including Stripe. Audited. */
export async function updateDonationNote(adminUserId: string, donationId: string, note: string) {
  const donation = await prisma.donation.findUnique({ where: { id: donationId } });
  if (!donation) throw new NotFoundError();
  const updated = await prisma.donation.update({ where: { id: donationId }, data: { note } });
  await recordAudit(prisma, {
    actorUserId: adminUserId,
    action: "donation.note.update",
    entityType: "Donation",
    entityId: donationId,
    before: { note: donation.note },
    after: { note },
  });
  return updated;
}
