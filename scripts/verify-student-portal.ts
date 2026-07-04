/**
 * S2 verification: the student portal shows only the student's OWN directed,
 * SUCCEEDED gifts; anonymous donors are shown as "Anonymous"; totals + sponsor
 * count are correct; general/other-student donations never leak in.
 *
 * Run after the seed:  npx tsx scripts/verify-student-portal.ts
 */
import { PrismaClient } from "@prisma/client";
import { getStudentPortal } from "@/lib/services/student-portal";

const prisma = new PrismaClient();
const T = Date.now();
let failures = 0;
const userIds: string[] = [];
const studentIds: string[] = [];
const donorIds: string[] = [];
const donationIds: string[] = [];
const subIds: string[] = [];
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }

async function mkDonation(data: Parameters<typeof prisma.donation.create>[0]["data"]) { const d = await prisma.donation.create({ data }); donationIds.push(d.id); return d; }

async function main() {
  const user = await prisma.user.create({ data: { email: `sp-${T}@x.test`, name: "Tuli", role: "STUDENT", status: "ACTIVE" } });
  userIds.push(user.id);
  const student = await prisma.student.create({ data: { userId: user.id, status: "ACTIVE", slug: `tuli-${T}`, firstName: "Tuli" } });
  const other = await prisma.student.create({ data: { status: "ACTIVE", slug: `other-${T}`, firstName: "Other" } });
  studentIds.push(student.id, other.id);

  const named = await prisma.donor.create({ data: { name: "Aunt Salma", isAnonymous: false } });
  const anon = await prisma.donor.create({ data: { name: "Secret Giver", isAnonymous: true } });
  const otherDonor = await prisma.donor.create({ data: { name: "General Gina", isAnonymous: false } });
  donorIds.push(named.id, anon.id, otherDonor.id);

  // Two directed gifts to our student (one recurring), + noise that must NOT show.
  await mkDonation({ donorId: named.id, designationType: "STUDENT", studentId: student.id, amount: 3000, currency: "USD", source: "CASH", status: "SUCCEEDED", occurredAt: new Date("2026-02-01") });
  await mkDonation({ donorId: anon.id, designationType: "STUDENT", studentId: student.id, amount: 5000, refundedAmount: 1000, currency: "USD", source: "CASH", status: "SUCCEEDED", occurredAt: new Date("2026-03-01"), isRecurring: true });
  await mkDonation({ donorId: otherDonor.id, designationType: "GENERAL", amount: 9999, currency: "USD", source: "CASH", status: "SUCCEEDED", occurredAt: new Date() }); // general → must not show
  await mkDonation({ donorId: named.id, designationType: "STUDENT", studentId: other.id, amount: 7777, currency: "USD", source: "CASH", status: "SUCCEEDED", occurredAt: new Date() }); // other student → must not show
  await mkDonation({ donorId: named.id, designationType: "STUDENT", studentId: student.id, amount: 2000, currency: "USD", source: "CASH", status: "VOIDED", occurredAt: new Date() }); // not SUCCEEDED → must not show
  const sub = await prisma.subscription.create({ data: { donorId: named.id, status: "ACTIVE", designationType: "STUDENT", studentId: student.id, amount: 3000, currency: "USD" } });
  subIds.push(sub.id);

  const portal = await getStudentPortal(user.id);
  check("portal returns the student", portal?.student.firstName === "Tuli");
  check("only the 2 directed SUCCEEDED gifts show", portal?.gifts.length === 2, `got ${portal?.gifts.length}`);
  check("anonymous donor shown as 'Anonymous'", portal?.gifts.some((g) => g.donorName === "Anonymous") === true);
  check("named donor shown by name", portal?.gifts.some((g) => g.donorName === "Aunt Salma") === true);
  check("the real donor name is NOT leaked for anon gift", !portal?.gifts.some((g) => g.donorName === "Secret Giver"));
  check("total = net (3000 + 4000) = 7000", portal?.totalReceived === 7000, `got ${portal?.totalReceived}`);
  check("sponsor count = 2 distinct donors", portal?.sponsorCount === 2, `got ${portal?.sponsorCount}`);
  check("hasActiveSponsorship = true", portal?.hasActiveSponsorship === true);
  check("general + other-student + voided gifts excluded", !portal?.gifts.some((g) => g.amount === 9999 || g.amount === 7777 || g.amount === 2000));

  console.log(`\n${failures === 0 ? "✓ ALL STUDENT-PORTAL CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  await prisma.subscription.deleteMany({ where: { id: { in: subIds } } });
  await prisma.donation.deleteMany({ where: { id: { in: donationIds } } });
  await prisma.donor.deleteMany({ where: { id: { in: donorIds } } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log("  (cleaned up test data)");
}

main().catch((e) => { console.error("verify-student-portal error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
