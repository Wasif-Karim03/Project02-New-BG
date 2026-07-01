import type Stripe from "stripe";
import { applyDispute, applyRefund, recordStripeDonationFromCheckout } from "@/lib/services/donations";
import { withStripeEventIdempotency } from "@/lib/services/stripe-events";
import { getWebhookSecret, stripe } from "@/lib/stripe";

export type WebhookResult = { ok: boolean; status: number; message: string; processed?: boolean };

function piId(pi: string | { id: string } | null | undefined): string | null {
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

/**
 * Verify the Stripe signature, then process the event idempotently. Two-level
 * idempotency: StripeEvent.eventId (event-level, in withStripeEventIdempotency) and
 * the Donation @unique keys (row-level, in the donation service). A duplicate
 * delivery is a no-op. An unsigned/badly-signed request is rejected (400) before any
 * side effect.
 */
export async function handleStripeWebhook(rawBody: string, signature: string | null): Promise<WebhookResult> {
  const secret = getWebhookSecret();
  if (!secret) return { ok: false, status: 500, message: "webhook secret not configured" };

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? "", secret);
  } catch {
    return { ok: false, status: 400, message: "invalid signature" };
  }

  try {
    const { processed } = await withStripeEventIdempotency(event, async (tx) => {
      switch (event.type) {
        case "checkout.session.completed": {
          const s = event.data.object as Stripe.Checkout.Session & { feeAmount?: number | null };
          await recordStripeDonationFromCheckout(tx, {
            id: s.id,
            payment_intent: piId(s.payment_intent),
            amount_total: s.amount_total,
            currency: s.currency,
            customer_details: s.customer_details ? { email: s.customer_details.email, name: s.customer_details.name } : null,
            metadata: s.metadata ?? null,
            created: s.created,
            feeAmount: s.feeAmount ?? null,
            latest_charge: null,
          });
          break;
        }
        case "charge.refunded": {
          const c = event.data.object as Stripe.Charge;
          const pi = piId(c.payment_intent);
          if (pi) await applyRefund(tx, { paymentIntentId: pi, amountRefunded: c.amount_refunded });
          break;
        }
        case "charge.dispute.closed": {
          const d = event.data.object as Stripe.Dispute;
          const pi = piId(d.payment_intent);
          if (pi) await applyDispute(tx, { paymentIntentId: pi, disputeStatus: d.status });
          break;
        }
        default:
          break; // unhandled event types are acknowledged and ignored
      }
    });
    return { ok: true, status: 200, message: processed ? "processed" : "duplicate ignored", processed };
  } catch (e) {
    // A processing error (not a signature error) — 500 so Stripe retries.
    return { ok: false, status: 500, message: `processing error: ${(e as Error).message}` };
  }
}
