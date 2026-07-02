import type { DesignationType } from "@prisma/client";
import { type Db, recordAudit } from "@/lib/services/audit";
import { generateReceipt } from "@/lib/services/receipts";

/** The subset of a Checkout Session / PaymentIntent the ledger needs. */
export type StripeCheckoutData = {
  id: string; // checkout session id → idempotencyKey (row-level guard #2)
  payment_intent: string | null; // → stripePaymentIntentId (row-level guard #1)
  amount_total: number | null; // MINOR UNITS — the amount STRIPE charged
  currency: string | null;
  customer_details?: { email?: string | null; name?: string | null } | null;
  metadata?: Record<string, string> | null;
  created?: number; // unix seconds
  feeAmount?: number | null; // processor fee if known (from balance txn)
  latest_charge?: string | null;
};

class UntrustedWebhookError extends Error {}

/** Match a guest to an existing account by VERIFIED email only; else guest donor. */
export async function resolveDonor(db: Db, email: string | null | undefined, name: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  if (normalized) {
    const user = await db.user.findFirst({ where: { email: normalized, emailVerified: { not: null } } });
    if (user) {
      const existing = await db.donor.findUnique({ where: { userId: user.id } });
      if (existing) return existing;
      return db.donor.create({ data: { userId: user.id, name: name ?? user.name ?? "Donor", email: normalized } });
    }
  }
  return db.donor.create({ data: { userId: null, name: name ?? "Donor", email: normalized } });
}

/**
 * Create a Donation from a completed Checkout. WEBHOOK-ONLY caller. Idempotent at
 * the ROW level (stripePaymentIntentId + idempotencyKey are @unique): a second call
 * for the same charge is a no-op that returns the existing row. The amount and
 * currency come from STRIPE — never from the browser. USD is enforced. Financial
 * fields are written once here and never mutated by this service afterward.
 */
export async function recordStripeDonationFromCheckout(db: Db, data: StripeCheckoutData) {
  const paymentIntentId = data.payment_intent;
  if (!paymentIntentId) throw new UntrustedWebhookError("checkout session has no payment_intent");

  // Row-level idempotency (guard #2, complements event-level StripeEvent).
  const existing = await db.donation.findFirst({
    where: { OR: [{ stripePaymentIntentId: paymentIntentId }, { idempotencyKey: data.id }] },
  });
  if (existing) return existing;

  const amount = data.amount_total;
  const currency = data.currency?.toLowerCase();
  if (amount == null || amount <= 0) throw new UntrustedWebhookError("missing/invalid amount_total");
  if (currency !== "usd") throw new UntrustedWebhookError(`unsupported currency: ${currency}`); // USD only

  const md = data.metadata ?? {};
  const designationType = md.designationType as DesignationType;
  if (!["STUDENT", "PROJECT", "GENERAL"].includes(designationType)) {
    throw new UntrustedWebhookError("missing/invalid designationType metadata");
  }
  const studentId = designationType === "STUDENT" ? md.studentId : undefined;
  const projectId = designationType === "PROJECT" ? md.projectId : undefined;
  const sessionId = md.sessionId || undefined;

  const fee = data.feeAmount ?? null;
  const donor = await resolveDonor(db, data.customer_details?.email, data.customer_details?.name);

  const donation = await db.donation.create({
    data: {
      donorId: donor.id,
      designationType,
      studentId,
      projectId,
      sessionId,
      amount, // from Stripe
      currency: "USD",
      feeAmount: fee,
      netAmount: fee != null ? amount - fee : null,
      source: "STRIPE",
      status: "SUCCEEDED",
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: data.latest_charge ?? undefined,
      idempotencyKey: data.id,
      isHistorical: false,
      occurredAt: data.created ? new Date(data.created * 1000) : new Date(),
    },
  });

  await recordAudit(db, {
    actorUserId: null, // system (webhook)
    action: "donation.stripe.create",
    entityType: "Donation",
    entityId: donation.id,
    after: { amount, currency: "USD", status: "SUCCEEDED", source: "STRIPE" },
  });

  await generateReceipt(db, donation);
  return donation;
}

/**
 * Apply a refund. Stripe reports the CUMULATIVE refunded amount. Partial refund →
 * set refundedAmount, status stays SUCCEEDED. Full refund → refundedAmount ==
 * amount, status = REFUNDED. Only refundedAmount/status change — amount/currency/
 * occurredAt are immutable.
 */
export async function applyRefund(db: Db, params: { paymentIntentId: string; amountRefunded: number }) {
  const donation = await db.donation.findUnique({ where: { stripePaymentIntentId: params.paymentIntentId } });
  if (!donation) return null;

  const refundedAmount = Math.min(params.amountRefunded, donation.amount);
  const fully = refundedAmount >= donation.amount;

  const updated = await db.donation.update({
    where: { id: donation.id },
    data: { refundedAmount, status: fully ? "REFUNDED" : donation.status },
  });
  await recordAudit(db, {
    actorUserId: null,
    action: "donation.refund",
    entityType: "Donation",
    entityId: donation.id,
    before: { refundedAmount: donation.refundedAmount, status: donation.status },
    after: { refundedAmount, status: updated.status },
  });
  return updated;
}

/**
 * Apply a dispute outcome. A LOST dispute reverses the funds → status VOIDED (the
 * enum has no dedicated DISPUTED state; a first-class value is a possible future
 * enum addition). A won/other outcome leaves the donation unchanged.
 */
export async function applyDispute(db: Db, params: { paymentIntentId: string; disputeStatus: string }) {
  const donation = await db.donation.findUnique({ where: { stripePaymentIntentId: params.paymentIntentId } });
  if (!donation) return null;

  if (params.disputeStatus === "lost") {
    const updated = await db.donation.update({
      where: { id: donation.id },
      data: { status: "VOIDED", voidedReason: "stripe dispute lost", voidedAt: new Date() },
    });
    await recordAudit(db, {
      actorUserId: null,
      action: "donation.dispute.lost",
      entityType: "Donation",
      entityId: donation.id,
      before: { status: donation.status },
      after: { status: "VOIDED" },
      reason: "stripe dispute lost",
    });
    return updated;
  }
  // won / warning / other: record but do not change financial status.
  await recordAudit(db, {
    actorUserId: null,
    action: `donation.dispute.${params.disputeStatus}`,
    entityType: "Donation",
    entityId: donation.id,
  });
  return donation;
}

/**
 * Enrich a donation with the REAL processor fee from the charge's balance
 * transaction. Set feeAmount + netAmount = amount - fee. If the fee is genuinely
 * unknown (null) we do NOTHING — netAmount stays null, never synthesized. Runs on
 * the charge.succeeded webhook path, itself guarded by StripeEvent idempotency;
 * the update is also value-idempotent, so reprocessing yields the same result.
 */
export async function enrichDonationFee(db: Db, params: { paymentIntentId: string; fee: number | null | undefined }) {
  if (params.fee == null) return null;
  const donation = await db.donation.findUnique({ where: { stripePaymentIntentId: params.paymentIntentId } });
  if (!donation) return null;
  if (donation.feeAmount === params.fee && donation.netAmount === donation.amount - params.fee) return donation; // already enriched
  return db.donation.update({
    where: { id: donation.id },
    data: { feeAmount: params.fee, netAmount: donation.amount - params.fee },
  });
}
