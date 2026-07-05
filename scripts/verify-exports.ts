/**
 * CSV exports: donations (with net + date-range filter + escaping), donors
 * (lifetime totals), and students. Content checks on the generated CSV strings.
 *
 * Run after the seed:  npx tsx scripts/verify-exports.ts
 */
import { PrismaClient } from "@prisma/client";
import { exportDonationsCsv, exportDonorsCsv, exportStudentsCsv } from "@/lib/services/exports";

const prisma = new PrismaClient();
const T = Date.now();
let failures = 0;
const donationIds: string[] = [];
const donorIds: string[] = [];
const studentIds: string[] = [];
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }

async function main() {
  const donorName = `Export Donor ${T}`;
  const donor = await prisma.donor.create({ data: { name: donorName } }); donorIds.push(donor.id);
  const don = await prisma.donation.create({ data: { donorId: donor.id, amount: 5000, refundedAmount: 0, currency: "USD", source: "BANK", status: "SUCCEEDED", designationType: "GENERAL", occurredAt: new Date("2026-03-15"), note: "gift, with comma" } });
  donationIds.push(don.id);
  const student = await prisma.student.create({ data: { status: "ACTIVE", firstName: `Exp${T}`, slug: `exp-${T}` } }); studentIds.push(student.id);

  console.log("\nDonations CSV");
  const dcsv = await exportDonationsCsv();
  check("has a header row", dcsv.startsWith("Date,Donor,Email,Gross,Refunded,Net,"));
  check("includes the donation (donor + net 50.00)", dcsv.includes(donorName) && dcsv.includes("50.00"));
  check("escapes a comma in the note (quoted)", dcsv.includes('"gift, with comma"'));

  console.log("\nDate-range filter");
  const outOfRange = await exportDonationsCsv({ from: new Date("2026-06-01"), to: new Date("2026-06-30") });
  check("donation excluded when outside the range", !outOfRange.includes(donorName));
  const inRange = await exportDonationsCsv({ from: new Date("2026-03-01"), to: new Date("2026-03-31") });
  check("donation included when inside the range", inRange.includes(donorName));

  console.log("\nDonors CSV");
  const donorsCsv = await exportDonorsCsv();
  check("donor row with lifetime total 50.00", donorsCsv.includes(donorName) && donorsCsv.includes("50.00"));

  console.log("\nStudents CSV");
  const studentsCsv = await exportStudentsCsv();
  check("has a header row + the student", studentsCsv.startsWith("First name,Full name,Slug,") && studentsCsv.includes(`Exp${T}`));

  console.log(`\n${failures === 0 ? "✓ ALL EXPORT CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  await prisma.donation.deleteMany({ where: { id: { in: donationIds } } });
  await prisma.donor.deleteMany({ where: { id: { in: donorIds } } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  console.log("  (cleaned up test data)");
}

main().catch((e) => { console.error("verify-exports error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
