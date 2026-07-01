import Stripe from "stripe";

// A key is required to construct the client; signature verification
// (constructEvent) only uses the webhook secret, so a placeholder is fine in
// environments that never call the Stripe API. Real test/live keys come from env.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");

/** Read at call time so tests/tools can set it before invoking the handler. */
export function getWebhookSecret(): string | undefined {
  return process.env.STRIPE_WEBHOOK_SECRET || undefined;
}
