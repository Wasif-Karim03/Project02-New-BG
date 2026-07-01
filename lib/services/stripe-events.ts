import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Event-level webhook idempotency (guard #1). Records the Stripe event id and runs
 * the handler in ONE transaction: a replayed event whose id already exists is a
 * no-op (returns processed:false), and the handler's work + the event record commit
 * together or not at all. StripeEvent.eventId being @unique is the ultimate guard
 * under concurrent delivery. Row-level @unique keys on Donation are guard #2.
 */
export async function withStripeEventIdempotency(
  event: { id: string; type: string },
  handler: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<{ processed: boolean }> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.stripeEvent.findUnique({ where: { eventId: event.id } });
    if (existing) return { processed: false };
    await tx.stripeEvent.create({ data: { eventId: event.id, type: event.type } });
    await handler(tx);
    return { processed: true };
  });
}
