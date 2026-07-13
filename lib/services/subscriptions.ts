import type { DesignationType, SubscriptionStatus } from "@prisma/client";
import { getCurrentSessionId } from "@/lib/services/academic-session";
import { type Db, recordAudit } from "@/lib/services/audit";
import { resolveDonor } from "@/lib/services/donations";
import { generateReceipt } from "@/lib/services/receipts";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

class UntrustedWebhookError extends Error {}

/** Map Stripe's subscription status to our enum. */
export function mapStripeSubStatus(s: string): SubscriptionStatus {
  switch (s) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "unpaid":
      return "UNPAID";
    default:
      return "INCOMPLETE"; // incomplete / incomplete_expired / unknown
  }
}

function designationFromMetadata(md: Record<string, string>) {
  const designationType = md.designationType as DesignationType;
  if (!["STUDENT", "PROJECT", "GENERAL"].includes(designationType)) {
    throw new UntrustedWebhookError("missing/invalid designationType metadata");
  }
  const studentId = designationType === "STUDENT" ? md.studentId : undefined;
  const projectId = designationType === "PROJECT" ? md.projectId : undefined;
  // A STUDENT/PROJECT designation must carry its target id, or every cycle donation
  // it spawns would be an orphan. Reject as untrusted rather than persist a bad sub.
  if (designationType === "STUDENT" && !studentId) throw new UntrustedWebhookError("STUDENT designation missing studentId");
  if (designationType === "PROJECT" && !projectId) throw new UntrustedWebhookError("PROJECT designation missing projectId");
  return { designationType, studentId, projectId };
}

export type SubscriptionCheckoutData = {
  id: string;
  subscription: string;
  customer_details?: { email?: string | null; name?: string | null } | null;
  metadata?: Record<string, string> | null;
  amount_total?: number | null;
  currency?: string | null;
};

/**
 * Persist a Subscription from a mode=subscription Checkout. CRITICALLY, this does
 * NOT create a Donation — the first cycle's Donation comes from the first
 * invoice.payment_succeeded, so the first charge is never double-counted.
 * Idempotent on stripeSubscriptionId.
 */
export async function recordSubscriptionFromCheckout(db: Db, data: SubscriptionCheckoutData) {
  const existing = await db.subscription.findUnique({ where: { stripeSubscriptionId: data.subscription } });
  if (existing) return existing;

  const md = data.metadata ?? {};
  const { designationType, studentId, projectId } = designationFromMetadata(md);
  const currency = (data.currency ?? "usd").toLowerCase();
  if (currency !== "usd") throw new UntrustedWebhookError(`unsupported currency: ${currency}`);

  const donor = await resolveDonor(db, data.customer_details?.email, data.customer_details?.name);
  const amount = data.amount_total ?? Number(md.amount ?? 0);

  const sub = await db.subscription.create({
    data: {
      donorId: donor.id,
      stripeSubscriptionId: data.subscription,
      status: "ACTIVE",
      designationType,
      studentId,
      projectId,
      amount,
      currency: "USD",
      interval: md.interval || "month",
    },
  });
  await recordAudit(db, {
    actorUserId: null,
    action: "subscription.create",
    entityType: "Subscription",
    entityId: sub.id,
    after: { stripeSubscriptionId: data.subscription, designationType, amount },
  });
  return sub;
}

export type InvoiceData = {
  id: string; // → idempotencyKey (row-level guard)
  subscription: string | null;
  payment_intent: string | null;
  charge?: string | null;
  amount_paid: number | null;
  currency: string | null;
  created?: number;
};

/**
 * Create exactly ONE Donation for a paid subscription invoice. Idempotent at the
 * row level (idempotencyKey = invoice.id, plus stripePaymentIntentId @unique): a
 * retried invoice.payment_succeeded is a no-op. Attributes the cycle to the parent
 * subscription's designation and the CURRENT AcademicSession. If the subscription
 * isn't persisted yet (event ordering), throws so Stripe retries.
 */
export async function recordSubscriptionCycleDonation(db: Db, invoice: InvoiceData) {
  if (!invoice.subscription) return null;
  const sub = await db.subscription.findUnique({ where: { stripeSubscriptionId: invoice.subscription } });
  if (!sub) throw new UntrustedWebhookError("subscription not persisted yet — retry after checkout.session.completed");

  const paymentIntentId = invoice.payment_intent;
  const existing = await db.donation.findFirst({
    where: {
      OR: [{ idempotencyKey: invoice.id }, ...(paymentIntentId ? [{ stripePaymentIntentId: paymentIntentId }] : [])],
    },
  });
  if (existing) return existing; // retry / first-cycle dedupe

  const amount = invoice.amount_paid;
  const currency = invoice.currency?.toLowerCase();
  if (amount == null || amount <= 0) throw new UntrustedWebhookError("missing/invalid amount_paid");
  if (currency !== "usd") throw new UntrustedWebhookError(`unsupported currency: ${currency}`);

  const sessionId = await getCurrentSessionId(db);

  const donation = await db.donation.create({
    data: {
      donorId: sub.donorId,
      designationType: sub.designationType,
      studentId: sub.studentId,
      projectId: sub.projectId,
      sessionId, // current academic session for attribution
      amount,
      currency: "USD",
      source: "STRIPE",
      status: "SUCCEEDED",
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: invoice.charge ?? undefined,
      idempotencyKey: invoice.id,
      isRecurring: true,
      subscriptionId: sub.id,
      isHistorical: false,
      occurredAt: invoice.created ? new Date(invoice.created * 1000) : new Date(),
    },
  });
  await recordAudit(db, {
    actorUserId: null,
    action: "donation.subscription.cycle",
    entityType: "Donation",
    entityId: donation.id,
    after: { subscriptionId: sub.id, amount, sessionId },
  });
  await generateReceipt(db, donation);
  return donation;
}

export async function updateSubscriptionStatus(
  db: Db,
  params: { stripeSubscriptionId: string; status: SubscriptionStatus; currentPeriodEnd?: Date | null; canceledAt?: Date | null },
) {
  const sub = await db.subscription.findUnique({ where: { stripeSubscriptionId: params.stripeSubscriptionId } });
  if (!sub) return null;
  const updated = await db.subscription.update({
    where: { id: sub.id },
    data: { status: params.status, currentPeriodEnd: params.currentPeriodEnd ?? undefined, canceledAt: params.canceledAt ?? undefined },
  });
  await recordAudit(db, {
    actorUserId: null,
    action: "subscription.status",
    entityType: "Subscription",
    entityId: sub.id,
    before: { status: sub.status },
    after: { status: params.status },
  });
  return updated;
}

// ── Donor dashboard + admin reads ───────────────────────────────────────────

export async function listDonorSubscriptions(donorUserId: string) {
  const donor = await prisma.donor.findUnique({ where: { userId: donorUserId }, select: { id: true } });
  if (!donor) return [];
  return prisma.subscription.findMany({
    where: { donorId: donor.id },
    include: { student: { select: { firstName: true } }, project: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listDonorGivingHistory(donorUserId: string) {
  const donor = await prisma.donor.findUnique({ where: { userId: donorUserId }, select: { id: true } });
  if (!donor) return [];
  const donations = await prisma.donation.findMany({
    where: { donorId: donor.id },
    select: {
      id: true, amount: true, currency: true, status: true, occurredAt: true, isRecurring: true, designationType: true, refundedAmount: true,
      tributeType: true, tributeName: true, tributeMessage: true, tributeImageUrl: true,
      student: { select: { id: true, firstName: true, slug: true, requireAmount: true, status: true } },
      project: { select: { title: true, slug: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });
  // Live funding status for each recipient student — computed on read, so admin
  // edits and new gifts always reflect here (single source of truth).
  const studentIds = [...new Set(donations.map((d) => d.student?.id).filter((x): x is string => !!x))];
  const raised = studentIds.length
    ? await prisma.donation.groupBy({ by: ["studentId"], where: { studentId: { in: studentIds }, status: "SUCCEEDED", designationType: "STUDENT" }, _sum: { amount: true, refundedAmount: true } })
    : [];
  const fundedMap = new Map(raised.map((r) => [r.studentId as string, Math.max(0, (r._sum.amount ?? 0) - (r._sum.refundedAmount ?? 0))]));
  return donations.map((d) => ({ ...d, studentFunded: d.student ? fundedMap.get(d.student.id) ?? 0 : null }));
}

export async function listActiveSponsorships() {
  return prisma.subscription.findMany({
    where: { status: "ACTIVE" },
    include: { donor: { select: { name: true } }, student: { select: { firstName: true } }, project: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Donor requests cancellation. Ownership-checked. Asks Stripe to cancel; the
 * customer.subscription.deleted/updated webhook is the source of truth that flips
 * our status to CANCELED. Requires a real STRIPE_SECRET_KEY.
 */
export async function requestCancelSubscription(donorUserId: string, subscriptionId: string) {
  const donor = await prisma.donor.findUnique({ where: { userId: donorUserId }, select: { id: true } });
  if (!donor) throw new Error("No donor profile");
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub || sub.donorId !== donor.id) throw new Error("Forbidden");
  if (!sub.stripeSubscriptionId) throw new Error("No linked Stripe subscription");
  await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
  return { requested: true };
}
