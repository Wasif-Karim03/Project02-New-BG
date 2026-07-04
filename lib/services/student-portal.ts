import { prisma } from "@/lib/prisma";

export type StudentGift = {
  donorName: string; // "Anonymous" when the donor chose anonymity
  amount: number; // net minor units (amount - refunded)
  currency: string;
  date: Date;
  recurring: boolean;
};

export type StudentPortal = {
  student: {
    firstName: string;
    status: string;
    slug: string | null;
    schoolName: string | null;
    careerGoal: string | null;
    district: string | null;
    requireAmount: number | null;
  };
  gifts: StudentGift[];
  totalReceived: number; // net minor units
  sponsorCount: number; // distinct donors
  hasActiveSponsorship: boolean;
};

/**
 * The student's own portal view: their profile + the gifts directed to them.
 * Donor identities are ANONYMIZED here — a donor who chose isAnonymous shows as
 * "Anonymous" (mirrors the public donor-wall rule). Only SUCCEEDED donations
 * directed at THIS student are included. Returns null if the user has no student
 * record (e.g. not yet approved).
 */
export async function getStudentPortal(userId: string): Promise<StudentPortal | null> {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: {
      id: true, firstName: true, status: true, slug: true, careerGoal: true,
      addrDistrict: true, requireAmount: true, school: { select: { name: true } },
    },
  });
  if (!student) return null;

  const [donations, activeSub] = await Promise.all([
    prisma.donation.findMany({
      where: { studentId: student.id, status: "SUCCEEDED" },
      select: { amount: true, refundedAmount: true, currency: true, occurredAt: true, isRecurring: true, donorId: true, donor: { select: { name: true, isAnonymous: true } } },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.subscription.count({ where: { studentId: student.id, status: "ACTIVE" } }),
  ]);

  const gifts: StudentGift[] = donations.map((d) => ({
    donorName: d.donor.isAnonymous ? "Anonymous" : d.donor.name,
    amount: d.amount - d.refundedAmount,
    currency: d.currency,
    date: d.occurredAt,
    recurring: d.isRecurring,
  }));

  return {
    student: {
      firstName: student.firstName,
      status: student.status,
      slug: student.slug,
      schoolName: student.school?.name ?? null,
      careerGoal: student.careerGoal,
      district: student.addrDistrict,
      requireAmount: student.requireAmount,
    },
    gifts,
    totalReceived: gifts.reduce((s, g) => s + g.amount, 0),
    sponsorCount: new Set(donations.map((d) => d.donorId)).size,
    hasActiveSponsorship: activeSub > 0,
  };
}
