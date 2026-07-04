import { getCurrentSessionId } from "@/lib/services/academic-session";
import { recordAudit } from "@/lib/services/audit";
import { resolveDonor } from "@/lib/services/donations";
import { generateReceipt } from "@/lib/services/receipts";
import { prisma } from "@/lib/prisma";
import type { CreatePledgeInput, RecordPaymentInput } from "@/lib/validation/pledges";

export class NotFoundError extends Error { constructor() { super("Pledge not found"); this.name = "NotFoundError"; } }

/**
 * A manual recurring pledge = a Subscription with NO Stripe id (nothing auto-charges).
 * The donor commits to give monthly/yearly; the admin logs each payment as it arrives.
 */
export async function createManualPledge(adminUserId: string, input: CreatePledgeInput) {
  return prisma.$transaction(async (tx) => {
    const donor = await resolveDonor(tx, input.donorEmail, input.donorName);
    const sub = await tx.subscription.create({
      data: {
        donorId: donor.id,
        stripeSubscriptionId: null, // manual — no processor
        status: "ACTIVE",
        designationType: input.designationType,
        studentId: input.studentId,
        projectId: input.projectId,
        amount: input.amount,
        currency: "USD",
        interval: input.interval,
      },
    });
    await recordAudit(tx, { actorUserId: adminUserId, action: "pledge.create", entityType: "Subscription", entityId: sub.id, after: { amount: input.amount, interval: input.interval } });
    return sub;
  });
}

/** Log one cycle's payment against a pledge → a SUCCEEDED Donation (+receipt). Audited. */
export async function recordPledgePayment(adminUserId: string, subscriptionId: string, input: RecordPaymentInput) {
  return prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundError();
    const sessionId = await getCurrentSessionId(tx);
    const note = [`pledge payment via ${input.method}`, input.reference ? `ref ${input.reference}` : ""].filter(Boolean).join(" · ");
    const donation = await tx.donation.create({
      data: {
        donorId: sub.donorId,
        designationType: sub.designationType,
        studentId: sub.studentId,
        projectId: sub.projectId,
        sessionId,
        amount: input.amount ?? sub.amount,
        currency: "USD",
        source: input.method === "bank" ? "BANK" : input.method === "cash" ? "CASH" : "OTHER",
        status: "SUCCEEDED",
        isRecurring: true,
        subscriptionId: sub.id,
        isHistorical: false,
        occurredAt: input.occurredAt ?? new Date(),
        note,
        createdById: adminUserId,
      },
    });
    await recordAudit(tx, { actorUserId: adminUserId, action: "pledge.payment", entityType: "Subscription", entityId: sub.id, after: { donationId: donation.id, amount: donation.amount } });
    await generateReceipt(tx, donation);
    return donation;
  });
}

export async function cancelManualPledge(adminUserId: string, subscriptionId: string) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw new NotFoundError();
  const updated = await prisma.subscription.update({ where: { id: subscriptionId }, data: { status: "CANCELED", canceledAt: new Date() } });
  await recordAudit(prisma, { actorUserId: adminUserId, action: "pledge.cancel", entityType: "Subscription", entityId: subscriptionId, before: { status: sub.status }, after: { status: "CANCELED" } });
  return updated;
}

/** Active manual pledges with last-payment + a "due this period" flag (admin view). */
export async function listManualPledges() {
  const subs = await prisma.subscription.findMany({
    where: { stripeSubscriptionId: null, status: "ACTIVE" },
    include: {
      donor: { select: { name: true } },
      student: { select: { firstName: true } },
      project: { select: { title: true } },
      donations: { where: { status: "SUCCEEDED" }, select: { occurredAt: true }, orderBy: { occurredAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  const periodStart = (interval: string) => (interval === "year" ? new Date(now.getFullYear(), 0, 1) : new Date(now.getFullYear(), now.getMonth(), 1));
  return subs.map((s) => {
    const last = s.donations[0]?.occurredAt ?? null;
    return {
      id: s.id, amount: s.amount, currency: s.currency, interval: s.interval,
      donorName: s.donor.name, target: s.student?.firstName ?? s.project?.title ?? "General",
      lastPayment: last, due: !last || last < periodStart(s.interval),
    };
  });
}
