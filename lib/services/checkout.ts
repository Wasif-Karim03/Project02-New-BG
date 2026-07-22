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
    // Designation + tribute + note + anonymity travel in metadata so the webhook can
    // attribute them (Stripe caps each value at 500 chars; giftAttributionMetadata caps).
    metadata: { ...designationMetadata(input), ...giftAttributionMetadata(input) },
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
  });
  return { id: session.id, url: session.url };
}

function designationMetadata(input: CheckoutInput): Record<string, string> {
  return {
    designationType: input.designationType,
    ...(input.studentId ? { studentId: input.studentId } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
  };
}

/**
 * Optional tribute / note / anonymity, added ONLY to the one-time session metadata so
 * the webhook can attribute them. Only present values are included; each is capped to
 * Stripe's 500-char metadata-value limit. The subscription checkout is left untouched.
 */
function giftAttributionMetadata(input: CheckoutInput): Record<string, string> {
  const md: Record<string, string> = {};
  if (input.isAnonymous) md.isAnonymous = "true";
  if (input.note) md.note = input.note.slice(0, 500);
  if (input.tributeType) md.tributeType = input.tributeType;
  if (input.tributeName) md.tributeName = input.tributeName.slice(0, 500);
  if (input.tributeMessage) md.tributeMessage = input.tributeMessage.slice(0, 500);
  if (input.tributePublic) md.tributePublic = "true";
  return md;
}

/**
 * Create a Stripe Checkout Session for a RECURRING sponsorship (mode=subscription
 * with an inline recurring price). The webhook records the Subscription on
 * checkout.session.completed and a Donation on each invoice.payment_succeeded (the
 * first cycle is never double-counted). Metadata is set on BOTH the session and the
 * subscription so attribution survives. Requires a real STRIPE_SECRET_KEY.
 */
export async function createSubscriptionCheckout(
  input: CheckoutInput,
  urls: { successUrl: string; cancelUrl: string },
  interval: "month" | "year" = "month",
) {
  // Include the per-cycle amount: mode=subscription checkouts return a null
  // amount_total on the session, so the webhook falls back to md.amount to record
  // Subscription.amount. (Cycle Donations still take their amount from each invoice.)
  const metadata = { ...designationMetadata(input), interval, amount: String(input.amount) };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.amount,
          recurring: { interval },
          product_data: { name: `${productName(input)} (${interval}ly)` },
        },
      },
    ],
    customer_email: input.donorEmail,
    metadata,
    subscription_data: { metadata },
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
  });
  return { id: session.id, url: session.url };
}
