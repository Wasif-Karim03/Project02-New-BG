# Stripe activation guide

The Stripe integration is **fully built and verified** — it's dormant only because no
API keys are set. Turning it on is configuration, not development. This guide is the
exact checklist.

> **Phase 8:** the **public donation page `/give`** now uses hosted Stripe Checkout for
> **one-time** card gifts (card data never touches our servers). The old mobile-banking
> "record my gift" claim form was removed from `/give`; offline gifts (bank / cash /
> mobile banking) are now recorded by an **admin** via `/offline-donations`. Amount floor
> is **$0.50** (Stripe's USD minimum), with a **$5,000** confirm step to catch typos and a
> **$100,000** hard cap. Donor receipts come from **Stripe** (our sender domain isn't
> verified); we still record a Receipt ledger row but do not double-email.

## What's already in place (no code to write)

| Piece | Where |
|---|---|
| Stripe client | `lib/stripe.ts` (reads `STRIPE_SECRET_KEY`) |
| One-time Checkout (public) | `createCheckoutSession()` · `lib/services/checkout.ts` · **public `/give`** (Phase 8) — amount / designation / tribute / note / anonymity travel in Checkout metadata |
| **Monthly** Checkout | `createSubscriptionCheckout()` (mode=subscription) · `/donate` "monthly" checkbox. **NOT offered on the public `/give` flow — one-time only.** Scaffolding retained (see note below). |
| Webhook endpoint | `POST /api/webhooks/stripe` → `lib/webhooks/stripe-handler.ts` |
| Signature verification | `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET` |
| Idempotency | event-level (`StripeEvent.eventId`) **and** row-level (Donation `@unique`) |
| Donations ledger | webhook-written, financial fields immutable; fee/net; refunds; disputes |
| Subscriptions | recorded from checkout; each invoice cycle → one linked Donation |
| Receipts | issued + emailed on a settled donation |
| Cancel | donor dashboard `/dashboard` → `requestCancelSubscription` |

Everything is proven offline by `npm run verify:stripe` and `npm run verify:subs`
(SDK-signed fixtures — no live account needed).

## Step 1 — Get keys (Stripe Dashboard → Developers → API keys)

Use **test mode** first. Set in `.env` (and later in the production host):

```
STRIPE_SECRET_KEY="sk_test_..."       # or sk_live_... in production
STRIPE_WEBHOOK_SECRET="whsec_..."     # from Step 2 / the CLI
```

## Step 2 — Register the webhook + enable EXACTLY these events

Dashboard → Developers → Webhooks → **Add endpoint**:

- **URL:** `https://<your-ops-domain>/api/webhooks/stripe`
- **Events to send** (the handler processes these — enabling only these keeps noise down):
  - `checkout.session.completed`   (one-time gift **and** subscription start)
  - `invoice.payment_succeeded`    (each recurring cycle → one Donation)
  - `charge.succeeded`             (fee/net enrichment from the balance transaction)
  - `charge.refunded`              (partial → refundedAmount; full → REFUNDED)
  - `charge.dispute.closed`        (lost → VOIDED)
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Copy the endpoint's **Signing secret** into `STRIPE_WEBHOOK_SECRET`.

> For fee/net enrichment, enable **balance-transaction expansion** on the charge webhook
> (or the handler can be switched to retrieve it) so `charge.balance_transaction.fee`
> is present — otherwise `netAmount` stays null until enriched.

## Step 3 — Local testing with the Stripe CLI

```bash
brew install stripe/stripe-cli/stripe   # or see stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
#   → prints a whsec_... — put it in STRIPE_WEBHOOK_SECRET for local
npm run dev
```

Then donate at `http://localhost:3000/donate` with a **test card** `4242 4242 4242 4242`,
any future expiry, any CVC. Watch the CLI forward events; the donation appears (e.g.
`/api/public/stats`, the student portal, `/roster/[id]`). Trigger edge cases:

```bash
stripe trigger checkout.session.completed
stripe trigger charge.refunded
stripe trigger customer.subscription.deleted
```

## Step 4 — Go live

- Swap `sk_test_`/`whsec_` for **live** values; point the webhook at the production URL.
- The webhook endpoint must be **HTTPS**.
- Confirm business/tax settings in Stripe for real 501(c)(3) receipts.
- Fee-free offline gifts (bank / cash / mobile banking) are recorded by an admin at
  `/offline-donations` — they write to the same ledger and totals as card gifts.

## Money-integrity guarantees (already enforced)

- The **ledger trusts Stripe, not the browser** — amounts come from `amount_total` /
  `amount_paid`, never a client field.
- A **duplicate webhook is a no-op** (both idempotency levels).
- Stripe rows' financial fields are **immutable** in the service layer — corrections are
  void-with-reason or an adjustment row.
- Bad/unsigned webhooks are rejected with **400** before any side effect.
