import type { Donation } from "@prisma/client";
import { sendEmail } from "@/lib/email";
import type { Db } from "@/lib/services/audit";

/**
 * Generate a 501(c)(3) receipt for a settled donation and (in a later phase) email
 * it. GUARDS:
 *   - isHistorical rows NEVER get a receipt (backfill/legacy — Phase F sets this;
 *     the guard is in place now so backfilled rows never trigger automations).
 *   - only SUCCEEDED donations are receipted.
 * Idempotent: one receipt per donation (Receipt.donationId is @unique).
 */
export async function generateReceipt(db: Db, donation: Donation) {
  if (donation.isHistorical) return null; // never for backfilled rows
  if (donation.status !== "SUCCEEDED") return null;

  const existing = await db.receipt.findUnique({ where: { donationId: donation.id } });
  if (existing) return existing;

  const donor = await db.donor.findUnique({ where: { id: donation.donorId } });

  const receipt = await db.receipt.create({
    data: {
      donationId: donation.id,
      receiptNumber: `RCPT-${donation.id}`,
      amount: donation.amount,
      currency: donation.currency,
      donorName: donor?.name,
      donorEmail: donor?.email,
      status: "ISSUED",
      issuedAt: new Date(),
    },
  });

  // Email the receipt via the shared transport (console in dev, SMTP once
  // EMAIL_SERVER is set). Historical rows never reach here, so backfill stays silent.
  if (donor?.email) {
    await sendEmail({
      to: donor.email,
      subject: `Your Bridging Generations donation receipt ${receipt.receiptNumber}`,
      text: `Thank you, ${donor.name ?? "friend"}. This confirms your tax-deductible gift of ${(donation.amount / 100).toFixed(2)} ${donation.currency}. Receipt number: ${receipt.receiptNumber}.`,
    });
    await db.receipt.update({ where: { id: receipt.id }, data: { status: "SENT", sentAt: new Date() } });
  }

  return receipt;
}
