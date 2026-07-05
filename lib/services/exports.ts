import { toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

const money = (cents: number | null | undefined) => ((cents ?? 0) / 100).toFixed(2);
const day = (d: Date) => d.toISOString().slice(0, 10);

/** All donations (with net = amount − refunded) for accounting. Optional date range. */
export async function exportDonationsCsv(range?: { from?: Date; to?: Date }): Promise<string> {
  const occurredAt = range && (range.from || range.to) ? { gte: range.from, lte: range.to } : undefined;
  const donations = await prisma.donation.findMany({
    where: occurredAt ? { occurredAt } : undefined,
    include: { donor: { select: { name: true, email: true } }, student: { select: { firstName: true } }, project: { select: { title: true } } },
    orderBy: { occurredAt: "desc" },
  });
  const rows = donations.map((d) => ({
    date: day(d.occurredAt),
    donor: d.donor.name,
    email: d.donor.email ?? "",
    gross: money(d.amount),
    refunded: money(d.refundedAmount),
    net: money(d.amount - d.refundedAmount),
    currency: d.currency,
    source: d.source,
    status: d.status,
    designation: d.designationType,
    target: d.student?.firstName ?? d.project?.title ?? "",
    recurring: d.isRecurring ? "yes" : "",
    note: d.note ?? "",
  }));
  return toCsv(rows, [
    { key: "date", header: "Date" }, { key: "donor", header: "Donor" }, { key: "email", header: "Email" },
    { key: "gross", header: "Gross" }, { key: "refunded", header: "Refunded" }, { key: "net", header: "Net" },
    { key: "currency", header: "Currency" }, { key: "source", header: "Source" }, { key: "status", header: "Status" },
    { key: "designation", header: "Designation" }, { key: "target", header: "Target" }, { key: "recurring", header: "Recurring" }, { key: "note", header: "Note" },
  ]);
}

/** One row per donor with lifetime totals (SUCCEEDED, net of refunds). */
export async function exportDonorsCsv(): Promise<string> {
  const donors = await prisma.donor.findMany({
    include: { donations: { where: { status: "SUCCEEDED" }, select: { amount: true, refundedAmount: true } } },
    orderBy: { createdAt: "asc" },
  });
  const rows = donors.map((d) => ({
    name: d.name,
    email: d.email ?? "",
    anonymous: d.isAnonymous ? "yes" : "",
    gifts: d.donations.length,
    total: money(d.donations.reduce((s, x) => s + (x.amount - x.refundedAmount), 0)),
  }));
  return toCsv(rows, [
    { key: "name", header: "Name" }, { key: "email", header: "Email" }, { key: "anonymous", header: "Anonymous" },
    { key: "gifts", header: "Gifts" }, { key: "total", header: "Total given" },
  ]);
}

/** Operational student roster (no free-text bio/PII dump; the fields staff manage). */
export async function exportStudentsCsv(): Promise<string> {
  const students = await prisma.student.findMany({
    include: { school: { select: { name: true } } },
    orderBy: { firstName: "asc" },
  });
  const rows = students.map((s) => ({
    firstName: s.firstName,
    fullName: s.fullName ?? "",
    slug: s.slug ?? "",
    status: s.status,
    school: s.school?.name ?? "",
    registrationId: s.registrationId ?? "",
    verified: s.verified ? "yes" : "",
    active: s.active ? "yes" : "",
    requireAmount: money(s.requireAmount),
  }));
  return toCsv(rows, [
    { key: "firstName", header: "First name" }, { key: "fullName", header: "Full name" }, { key: "slug", header: "Slug" },
    { key: "status", header: "Status" }, { key: "school", header: "School" }, { key: "registrationId", header: "Registration ID" },
    { key: "verified", header: "Verified" }, { key: "active", header: "Active" }, { key: "requireAmount", header: "Require amount" },
  ]);
}
