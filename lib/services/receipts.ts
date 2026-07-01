import type { Donation } from "@prisma/client";
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

  // Email delivery is a later step (Resend at handoff). In dev we log the intent
  // rather than send. Historical rows never reach here, so backfill stays silent.
  // eslint-disable-next-line no-console
  console.log(`[receipt] issued ${receipt.receiptNumber} for donation ${donation.id} (email send deferred)`);

  return receipt;
}
