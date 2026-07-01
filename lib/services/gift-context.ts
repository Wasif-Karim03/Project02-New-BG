import type { DesignationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type GiftContext = {
  amount: number; // minor units
  currency: string;
  designation: DesignationType;
  firstName: string | null;
};

/**
 * REAL gift context for the thank-you page — replaces the marketing site's
 * URL-param placeholder (`getGiftContext`). Keyed by the Checkout session id
 * (idempotencyKey) or the payment intent id. Returns null unless a matching
 * SUCCEEDED donation exists, so a spoofed/typed URL yields nothing.
 */
export async function getGiftContext(reference: string): Promise<GiftContext | null> {
  const donation = await prisma.donation.findFirst({
    where: {
      status: "SUCCEEDED",
      OR: [{ idempotencyKey: reference }, { stripePaymentIntentId: reference }],
    },
    include: { donor: { select: { name: true } } },
  });
  if (!donation) return null;

  const firstName = donation.donor?.name?.trim().split(/\s+/)[0] ?? null;
  return { amount: donation.amount, currency: donation.currency, designation: donation.designationType, firstName };
}
