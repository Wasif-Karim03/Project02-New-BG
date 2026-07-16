import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/services/audit";
import { MARKETING_TAGS, revalidateMarketing } from "@/lib/services/revalidate-marketing";

/** A donor opted in to the public wall but not in a reviewable (PENDING) state. */
export class DonorNotReviewableError extends Error {
  constructor() {
    super("This donor is no longer awaiting wall review.");
    this.name = "DonorNotReviewableError";
  }
}

/**
 * Donors who asked to appear on the public Donors page and are awaiting an admin
 * decision (wallStatus=PENDING, not anonymous). Includes a net lifetime total for
 * context. This gates ONLY public visibility — every one of these can already log
 * in and donate.
 */
export async function listPendingWallDonors() {
  const donors = await prisma.donor.findMany({
    where: { wallStatus: "PENDING", isAnonymous: false },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      wallMessage: true,
      wallTier: true,
      createdAt: true,
      donations: { where: { status: "SUCCEEDED" }, select: { amount: true, refundedAmount: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return donors.map((d) => {
    const { donations, ...rest } = d;
    const totalGiven = donations.reduce((s, g) => s + (g.amount - g.refundedAmount), 0);
    return { ...rest, totalGiven, giftCount: donations.length };
  });
}

async function setWallStatus(adminUserId: string, donorId: string, status: "APPROVED" | "REJECTED") {
  const updated = await prisma.$transaction(async (tx) => {
    const donor = await tx.donor.findUnique({ where: { id: donorId }, select: { wallStatus: true, isAnonymous: true } });
    if (!donor || donor.wallStatus !== "PENDING" || donor.isAnonymous) throw new DonorNotReviewableError();
    const row = await tx.donor.update({ where: { id: donorId }, data: { wallStatus: status } });
    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: status === "APPROVED" ? "donor.wall.approve" : "donor.wall.reject",
      entityType: "Donor",
      entityId: donorId,
      before: { wallStatus: "PENDING" },
      after: { wallStatus: status },
    });
    return row;
  });
  // Approving/declining changes who shows on the public Donors wall.
  await revalidateMarketing([MARKETING_TAGS.donors, MARKETING_TAGS.stats]);
  return updated;
}

/** Approve a donor for the public Donors page (name + photo become visible). Audited. */
export function approveDonorWall(adminUserId: string, donorId: string) {
  return setWallStatus(adminUserId, donorId, "APPROVED");
}

/** Decline public listing (account + donations are unaffected; they just aren't shown). Audited. */
export function rejectDonorWall(adminUserId: string, donorId: string) {
  return setWallStatus(adminUserId, donorId, "REJECTED");
}
