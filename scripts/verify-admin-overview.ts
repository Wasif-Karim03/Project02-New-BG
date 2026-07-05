/**
 * Admin dashboard overview: each count moves by exactly the expected delta when
 * known rows are added (robust to pre-existing data).
 *
 * Run after the seed:  npx tsx scripts/verify-admin-overview.ts
 */
import { PrismaClient } from "@prisma/client";
import { getAdminOverview } from "@/lib/services/admin-overview";

const prisma = new PrismaClient();
const T = Date.now();
let failures = 0;
const ids = { users: [] as string[], students: [] as string[], donors: [] as string[], donations: [] as string[], subs: [] as string[], apps: [] as string[] };
function check(label: string, got: number, want: number) { const ok = got === want; console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}  (Δ ${got}, want ${want})`); if (!ok) failures++; }

async function main() {
  const base = await getAdminOverview();

  // pendingApprovals +2: a PENDING account + a login-less PENDING student
  ids.users.push((await prisma.user.create({ data: { email: `pend-${T}@x.test`, role: "MENTOR", status: "PENDING" } })).id);
  ids.students.push((await prisma.student.create({ data: { status: "PENDING", slug: `pl-${T}`, firstName: "Pend" } })).id);
  // pendingApplications +1: an EMAIL_VERIFIED application (applicant user ACTIVE to not touch approvals)
  const applicant = await prisma.user.create({ data: { email: `appl-${T}@x.test`, role: "STUDENT", status: "ACTIVE" } });
  ids.users.push(applicant.id);
  ids.apps.push((await prisma.studentApplication.create({ data: { userId: applicant.id, status: "EMAIL_VERIFIED" } })).id);
  // activeStudents +1
  ids.students.push((await prisma.student.create({ data: { status: "ACTIVE", slug: `ac-${T}`, firstName: "Active" } })).id);
  // pendingDonations +1
  const d1 = await prisma.donor.create({ data: { name: "Pending Donor" } }); ids.donors.push(d1.id);
  ids.donations.push((await prisma.donation.create({ data: { donorId: d1.id, amount: 1000, currency: "USD", source: "OTHER", status: "PENDING", designationType: "GENERAL", occurredAt: new Date() } })).id);
  // donorCount +1 & totalRaised +5000
  const d2 = await prisma.donor.create({ data: { name: "Real Donor" } }); ids.donors.push(d2.id);
  ids.donations.push((await prisma.donation.create({ data: { donorId: d2.id, amount: 5000, currency: "USD", source: "BANK", status: "SUCCEEDED", designationType: "GENERAL", occurredAt: new Date() } })).id);
  // activePledges +1
  ids.subs.push((await prisma.subscription.create({ data: { donorId: d2.id, stripeSubscriptionId: null, status: "ACTIVE", designationType: "GENERAL", amount: 2000, currency: "USD", interval: "month" } })).id);

  const now = await getAdminOverview();
  check("pendingApprovals", now.pendingApprovals - base.pendingApprovals, 2);
  check("pendingApplications", now.pendingApplications - base.pendingApplications, 1);
  check("activeStudents", now.activeStudents - base.activeStudents, 1);
  check("pendingDonations", now.pendingDonations - base.pendingDonations, 1);
  check("donorCount", now.donorCount - base.donorCount, 1);
  check("totalRaised", now.totalRaised - base.totalRaised, 5000);
  check("activePledges", now.activePledges - base.activePledges, 1);

  console.log(`\n${failures === 0 ? "✓ ALL ADMIN-OVERVIEW CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  await prisma.donation.deleteMany({ where: { id: { in: ids.donations } } });
  await prisma.subscription.deleteMany({ where: { id: { in: ids.subs } } });
  await prisma.donor.deleteMany({ where: { id: { in: ids.donors } } });
  await prisma.studentApplication.deleteMany({ where: { id: { in: ids.apps } } });
  await prisma.student.deleteMany({ where: { id: { in: ids.students } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  console.log("  (cleaned up test data)");
}

main().catch((e) => { console.error("verify-admin-overview error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
