import { prisma } from "@/lib/prisma";

/**
 * Total raised = Σ (amount − refundedAmount) over SUCCEEDED donations, ALL sources
 * (STRIPE + CASH/CHECK/BANK/LEGACY + OTHER adjustments, which may be negative).
 * COMPUTED, never stored. USD-only (v1). Phase G exposes this via the public API;
 * defined here so Phase F can prove legacy rows count toward the total.
 */
export async function sumSucceededDonations(): Promise<number> {
  const agg = await prisma.donation.aggregate({
    where: { status: "SUCCEEDED" },
    _sum: { amount: true, refundedAmount: true },
  });
  return (agg._sum.amount ?? 0) - (agg._sum.refundedAmount ?? 0);
}
