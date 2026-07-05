import { prisma } from "@/lib/prisma";

/**
 * Live counts for the admin dashboard. "Action needed" counts mirror each queue
 * page exactly (approvals / applications / pending donations) so the badges match.
 */
export async function getAdminOverview() {
  const [pendingAccounts, loginlessStudents, pendingApplications, pendingDonations, activeStudents, activePledges, distinctDonors, totalAgg] = await Promise.all([
    prisma.user.count({ where: { status: "PENDING" } }),
    prisma.student.count({ where: { status: "PENDING", userId: null } }),
    prisma.studentApplication.count({ where: { status: "EMAIL_VERIFIED" } }),
    prisma.donation.count({ where: { status: "PENDING" } }),
    prisma.student.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "ACTIVE", stripeSubscriptionId: null } }),
    prisma.donation.findMany({ where: { status: "SUCCEEDED" }, select: { donorId: true }, distinct: ["donorId"] }),
    prisma.donation.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amount: true, refundedAmount: true } }),
  ]);
  return {
    pendingApprovals: pendingAccounts + loginlessStudents,
    pendingApplications,
    pendingDonations,
    activeStudents,
    activePledges,
    donorCount: distinctDonors.length,
    totalRaised: (totalAgg._sum.amount ?? 0) - (totalAgg._sum.refundedAmount ?? 0),
  };
}
