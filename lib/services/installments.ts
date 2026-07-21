import { recordAudit } from "@/lib/services/audit";
import { prisma } from "@/lib/prisma";
import { MARKETING_TAGS, revalidateMarketing } from "@/lib/services/revalidate-marketing";
import type { CreateSeriesInput, MarkInstallmentInput } from "@/lib/validation/installments";

export class NotFoundError extends Error {
  constructor(m = "Not found") { super(m); this.name = "NotFoundError"; }
}
export class SeriesExistsError extends Error {
  constructor() { super("An installment series with that label already exists for this student."); this.name = "SeriesExistsError"; }
}

// Progress derived from the installment rows — "N of 12 paid, next due <month>".
export type SeriesProgress = {
  seriesId: string;
  label: string;
  total: number; // installment count
  paid: number; // how many are marked paid
  totalAmount: number; // yearly award total, minor units
  paidAmount: number; // sum of paid installments, minor units
  currency: string;
  nextDueMonth: string | null; // earliest UNPAID due month ("YYYY-MM"); null once complete
  complete: boolean;
};

type InstallmentRow = { index: number; amount: number; paidAt: Date | null; dueMonth: string };
type SeriesShape = { id: string; label: string; totalAmount: number; currency: string; installments: InstallmentRow[] };

// Pure — progress is a read over the rows, never a stored counter, so it can never
// drift and re-marking can never double-count.
export function computeProgress(series: SeriesShape): SeriesProgress {
  const sorted = [...series.installments].sort((a, b) => a.index - b.index);
  const paidRows = sorted.filter((i) => i.paidAt != null);
  const nextUnpaid = sorted.find((i) => i.paidAt == null);
  return {
    seriesId: series.id,
    label: series.label,
    total: sorted.length,
    paid: paidRows.length,
    totalAmount: series.totalAmount,
    paidAmount: paidRows.reduce((s, i) => s + i.amount, 0),
    currency: series.currency,
    nextDueMonth: nextUnpaid ? nextUnpaid.dueMonth : null,
    complete: sorted.length > 0 && paidRows.length === sorted.length,
  };
}

// Build N consecutive "YYYY-MM" due months from a start year/month, rolling the
// year over correctly (e.g. start 2026-11, count 4 → 2026-11, 2026-12, 2027-01, 2027-02).
function buildInstallments(input: CreateSeriesInput): { index: number; dueMonth: string; amount: number }[] {
  return Array.from({ length: input.count }, (_, i) => {
    const monthIndex = input.startMonth - 1 + i; // 0-based months since year start
    const year = input.startYear + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    return { index: i + 1, dueMonth: `${year}-${String(month).padStart(2, "0")}`, amount: input.perInstallment };
  });
}

/**
 * Create a linked monthly installment series for a student's yearly award. Additive
 * only — this NEVER creates Donation rows or touches money aggregation. One series
 * per (student, label): a duplicate label is rejected (SeriesExistsError). Audited.
 */
export async function createInstallmentSeries(adminUserId: string | null, studentId: string, input: CreateSeriesInput) {
  const series = await prisma.$transaction(async (tx) => {
    const dup = await tx.installmentSeries.findUnique({ where: { studentId_label: { studentId, label: input.label } }, select: { id: true } });
    if (dup) throw new SeriesExistsError();
    const created = await tx.installmentSeries.create({
      data: {
        studentId,
        sessionId: input.sessionId ?? null,
        label: input.label,
        totalAmount: input.totalAmount,
        perInstallment: input.perInstallment,
        currency: "USD",
        createdById: adminUserId,
        installments: { create: buildInstallments(input) },
      },
      include: { installments: { orderBy: { index: "asc" } } },
    });
    await recordAudit(tx, {
      actorUserId: adminUserId, action: "installment.series.create", entityType: "InstallmentSeries", entityId: created.id,
      after: { studentId, label: input.label, count: input.count, totalAmount: input.totalAmount, perInstallment: input.perInstallment },
    });
    return created;
  });
  await revalidateMarketing([MARKETING_TAGS.students, MARKETING_TAGS.stats]);
  return series;
}

/**
 * Mark ONE monthly installment paid, with an OPTIONAL transaction reference / method
 * and an OPTIONAL link to the real Donation that settled it. IDEMPOTENT: if the row
 * is already paid, the original paidAt is preserved (never moved) and nothing is
 * double-applied — marking twice is safe. No money is minted; this is a tracking
 * overlay on top of the frozen money model. Audited each call (the no-op case is
 * tagged so the audit trail stays honest).
 */
export async function markInstallmentPaid(adminUserId: string | null, installmentId: string, input: MarkInstallmentInput) {
  const result = await prisma.$transaction(async (tx) => {
    const inst = await tx.installment.findUnique({ where: { id: installmentId } });
    if (!inst) throw new NotFoundError("Installment not found");
    const alreadyPaid = inst.paidAt != null;
    const updated = await tx.installment.update({
      where: { id: installmentId },
      data: {
        paidAt: inst.paidAt ?? new Date(), // preserve original timestamp — never moves
        txnRef: input.txnRef ?? inst.txnRef,
        method: input.method ?? inst.method,
        donationId: input.donationId ?? inst.donationId,
        markedById: adminUserId,
      },
    });
    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: alreadyPaid ? "installment.mark.paid.noop" : "installment.mark.paid",
      entityType: "Installment", entityId: installmentId,
      before: { paidAt: inst.paidAt, txnRef: inst.txnRef },
      after: { paidAt: updated.paidAt, txnRef: updated.txnRef, method: updated.method, donationId: updated.donationId },
    });
    return { installment: updated, alreadyPaid };
  });
  await revalidateMarketing([MARKETING_TAGS.students, MARKETING_TAGS.stats]);
  return result;
}

/** The student's latest series + its installments + computed progress (admin record page). */
export async function getStudentSeriesWithProgress(studentId: string) {
  const series = await prisma.installmentSeries.findFirst({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    include: { installments: { orderBy: { index: "asc" } } },
  });
  if (!series) return null;
  return { series, installments: series.installments, progress: computeProgress(series) };
}

/**
 * Series progress for every student a donor supports (via a subscription OR a
 * SUCCEEDED directed donation) — surfaced on the donor dashboard. One (latest)
 * series per student.
 */
export async function listDonorSeriesProgress(donorUserId: string): Promise<{ studentId: string; studentName: string; progress: SeriesProgress }[]> {
  const donor = await prisma.donor.findUnique({ where: { userId: donorUserId }, select: { id: true } });
  if (!donor) return [];
  const [subs, dons] = await Promise.all([
    prisma.subscription.findMany({ where: { donorId: donor.id, studentId: { not: null } }, select: { studentId: true } }),
    prisma.donation.findMany({ where: { donorId: donor.id, designationType: "STUDENT", status: "SUCCEEDED", studentId: { not: null } }, select: { studentId: true } }),
  ]);
  const studentIds = [...new Set([...subs, ...dons].map((x) => x.studentId).filter((v): v is string => Boolean(v)))];
  if (studentIds.length === 0) return [];
  const series = await prisma.installmentSeries.findMany({
    where: { studentId: { in: studentIds } },
    orderBy: { createdAt: "desc" },
    include: { installments: { orderBy: { index: "asc" } }, student: { select: { firstName: true } } },
  });
  const seen = new Set<string>();
  const out: { studentId: string; studentName: string; progress: SeriesProgress }[] = [];
  for (const s of series) {
    if (seen.has(s.studentId)) continue; // keep only the newest series per student
    seen.add(s.studentId);
    out.push({ studentId: s.studentId, studentName: s.student.firstName, progress: computeProgress(s) });
  }
  return out;
}
