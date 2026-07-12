import type { DonationSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/services/audit";
import { resolveDonor } from "@/lib/services/donations";
import { generateReceipt } from "@/lib/services/receipts";
import type { DonationClaimInput, PaymentMethod } from "@/lib/validation/donation-claim";

export class NotFoundError extends Error { constructor() { super("Donation not found"); this.name = "NotFoundError"; } }
export class NotPendingError extends Error { constructor(s: string) { super(`Donation is not pending (status: ${s})`); this.name = "NotPendingError"; } }
export class ReasonRequiredError extends Error { constructor() { super("A reason is required."); this.name = "ReasonRequiredError"; } }

const METHOD_SOURCE: Record<PaymentMethod, DonationSource> = {
  bkash: "OTHER", nagad: "OTHER", rocket: "OTHER", bank: "BANK", cash: "CASH", other: "OTHER",
};

/**
 * Donor-submitted gift claim → a PENDING donation. It does NOT count toward totals
 * until an admin confirms the money actually arrived. Guest→account match by verified
 * email (same rule as everywhere). No processor, no fees.
 */
export async function submitDonationClaim(input: DonationClaimInput) {
  return prisma.$transaction(async (tx) => {
    const donor = await resolveDonor(tx, input.donorEmail, input.donorName);
    const note = [`via ${input.method}`, input.reference ? `ref ${input.reference}` : "", input.note ?? ""].filter(Boolean).join(" · ");
    const donation = await tx.donation.create({
      data: {
        donorId: donor.id,
        designationType: input.designationType,
        studentId: input.studentId,
        projectId: input.projectId,
        amount: input.amount,
        currency: "USD",
        source: METHOD_SOURCE[input.method],
        status: "PENDING", // awaiting admin verification
        occurredAt: new Date(),
        note,
        isHistorical: false,
        tributeType: input.tributeType,
        tributeName: input.tributeName,
        tributeMessage: input.tributeMessage,
        tributeImageUrl: input.tributeImageUrl,
        tributePublic: input.tributePublic ?? false,
      },
    });
    await recordAudit(tx, { actorUserId: null, action: "donation.claim.submit", entityType: "Donation", entityId: donation.id, after: { method: input.method, amount: input.amount } });
    return { donationId: donation.id };
  });
}

/** The admin verification queue: donation claims awaiting confirmation. */
export async function listPendingDonations() {
  return prisma.donation.findMany({
    where: { status: "PENDING" },
    select: {
      id: true, amount: true, currency: true, occurredAt: true, note: true, source: true, designationType: true,
      donor: { select: { name: true, email: true } }, student: { select: { firstName: true } }, project: { select: { title: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Confirm the money arrived → SUCCEEDED (counts in totals) + receipt. Audited. */
export async function confirmDonation(adminUserId: string, donationId: string) {
  return prisma.$transaction(async (tx) => {
    const d = await tx.donation.findUnique({ where: { id: donationId } });
    if (!d) throw new NotFoundError();
    if (d.status !== "PENDING") throw new NotPendingError(d.status);
    const updated = await tx.donation.update({ where: { id: donationId }, data: { status: "SUCCEEDED", createdById: adminUserId } });
    await recordAudit(tx, { actorUserId: adminUserId, action: "donation.claim.confirm", entityType: "Donation", entityId: donationId, before: { status: "PENDING" }, after: { status: "SUCCEEDED" } });
    await generateReceipt(tx, updated);
    return updated;
  });
}

/** Decline a claim (money never arrived / spam) → FAILED. Reason required. Audited. */
export async function declineDonation(adminUserId: string, donationId: string, reason: string) {
  if (!reason?.trim()) throw new ReasonRequiredError();
  return prisma.$transaction(async (tx) => {
    const d = await tx.donation.findUnique({ where: { id: donationId } });
    if (!d) throw new NotFoundError();
    if (d.status !== "PENDING") throw new NotPendingError(d.status);
    const updated = await tx.donation.update({
      where: { id: donationId },
      data: { status: "FAILED", note: [d.note, `declined: ${reason.trim()}`].filter(Boolean).join(" · ") },
    });
    await recordAudit(tx, { actorUserId: adminUserId, action: "donation.claim.decline", entityType: "Donation", entityId: donationId, before: { status: "PENDING" }, after: { status: "FAILED" }, reason: reason.trim() });
    return updated;
  });
}
