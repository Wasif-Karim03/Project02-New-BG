import { stripe } from "@/lib/stripe";
import type { CheckoutInput } from "@/lib/validation/donations";

function productName(input: CheckoutInput): string {
  if (input.designationType === "STUDENT") return "Sponsor a student — Bridging Generations";
  if (input.designationType === "PROJECT") return "Support a project — Bridging Generations";
  return "Donation — Bridging Generations";
}

/**
 * Create a Stripe Checkout Session for a one-time directed gift. The amount is the
 * donor's validated choice (USD minor units, checked at the Zod boundary). The
 * LEDGER never trusts this number — the webhook records Stripe's reported
 * amount_total. Designation travels in metadata so the webhook can attribute it.
 * Requires a real STRIPE_SECRET_KEY (test or live).
 */
export async function createCheckoutSession(
  input: CheckoutInput,
  urls: { successUrl: string; cancelUrl: string },
) {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.amount,
          product_data: { name: productName(input) },
        },
      },
    ],
    customer_email: input.donorEmail,
    metadata: {
      designationType: input.designationType,
      ...(input.studentId ? { studentId: input.studentId } : {}),
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    },
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
  });
  return { id: session.id, url: session.url };
}
