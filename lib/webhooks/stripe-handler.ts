import type Stripe from "stripe";
import { applyDispute, applyRefund, enrichDonationFee, recordStripeDonationFromCheckout } from "@/lib/services/donations";
import { withStripeEventIdempotency } from "@/lib/services/stripe-events";
import {
  mapStripeSubStatus,
  recordSubscriptionCycleDonation,
  recordSubscriptionFromCheckout,
  updateSubscriptionStatus,
} from "@/lib/services/subscriptions";
import { getWebhookSecret, stripe } from "@/lib/stripe";

function toDate(unix: number | null | undefined): Date | null {
  return unix ? new Date(unix * 1000) : null;
}

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
          if (s.mode === "subscription") {
            // Persist the subscription only — NO donation here. The first cycle's
            // donation comes from invoice.payment_succeeded, so it's never doubled.
            await recordSubscriptionFromCheckout(tx, {
              id: s.id,
              subscription: typeof s.subscription === "string" ? s.subscription : (s.subscription?.id ?? ""),
              customer_details: s.customer_details ? { email: s.customer_details.email, name: s.customer_details.name } : null,
              metadata: s.metadata ?? null,
              amount_total: s.amount_total,
              currency: s.currency,
            });
          } else {
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
          }
          break;
        }
        case "invoice.payment_succeeded": {
          const inv = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } | null; payment_intent?: string | { id: string } | null; charge?: string | { id: string } | null };
          await recordSubscriptionCycleDonation(tx, {
            id: inv.id ?? "",
            subscription: typeof inv.subscription === "string" ? inv.subscription : (inv.subscription?.id ?? null),
            payment_intent: piId(inv.payment_intent),
            charge: typeof inv.charge === "string" ? inv.charge : (inv.charge?.id ?? null),
            amount_paid: inv.amount_paid,
            currency: inv.currency,
            created: inv.created,
          });
          break;
        }
        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          await updateSubscriptionStatus(tx, {
            stripeSubscriptionId: sub.id,
            status: mapStripeSubStatus(sub.status),
            currentPeriodEnd: toDate((sub as { current_period_end?: number }).current_period_end),
            canceledAt: toDate(sub.canceled_at),
          });
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          await updateSubscriptionStatus(tx, {
            stripeSubscriptionId: sub.id,
            status: "CANCELED",
            canceledAt: toDate(sub.canceled_at) ?? new Date(),
          });
          break;
        }
        case "charge.succeeded": {
          // Fee/net enrichment from the balance transaction (when expanded).
          const c = event.data.object as Stripe.Charge;
          const pi = piId(c.payment_intent);
          const bt = c.balance_transaction;
          const fee = bt && typeof bt === "object" ? (bt as { fee?: number }).fee ?? null : null;
          if (pi && fee != null) await enrichDonationFee(tx, { paymentIntentId: pi, fee });
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
