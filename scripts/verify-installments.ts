/**
 * Phase 7 verification — linked monthly installment series (yearly award paid monthly
 * via the live bKash/Nagad/Rocket path, NOT Stripe). Proves:
 *   - creating a 12-month series builds 12 installments with correct consecutive due
 *     months (year rolls over) and per-installment amounts; progress starts 0/12
 *   - marking an installment paid WITH a txn reference records paidAt + the ref, and
 *     advances progress (N of 12, next due = the next month, paidAmount accrues)
 *   - marking an installment paid WITHOUT a ref is fine (ref stays null)
 *   - IDEMPOTENT: marking the SAME installment twice does NOT double-apply — the paid
 *     count, paidAt timestamp, amount, and row count are all unchanged
 *   - it never mints a Donation (the frozen money model is untouched) and audits each run
 *   - a duplicate series label for the same student is rejected
 *
 * Isolation: creates its OWN student + series and tears everything down. Uses the real
 * service functions (not a reimplementation).
 *
 * Run after the seed:  npx tsx scripts/verify-installments.ts
 */
import { PrismaClient } from "@prisma/client";
import { SeriesAmountMismatchError, SeriesExistsError, createInstallmentSeries, getStudentSeriesWithProgress, markInstallmentPaid } from "@/lib/services/installments";
import { createSeriesSchema } from "@/lib/validation/installments";

const prisma = new PrismaClient();
// Per-RUN unique token (time + pid + random) so concurrent runs never collide on a
// unique slug/label.
const T = `${Date.now()}${process.pid}${Math.floor(Math.random() * 1e6)}`;
let failures = 0;
const studentIds: string[] = [];
const seriesIds: string[] = [];
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }

async function main() {
  const student = await prisma.student.create({ data: { status: "ACTIVE", slug: `inst-${T}`, firstName: "InstallTest", active: true } });
  studentIds.push(student.id);

  console.log("\nCreate a 12-month series (start 2026-11 → rolls into 2027)");
  const series = await createInstallmentSeries(null, student.id, {
    label: `${T} award`, count: 12, totalAmount: 120000, perInstallment: 10000, startYear: 2026, startMonth: 11,
  });
  seriesIds.push(series.id);
  const rows = await prisma.installment.findMany({ where: { seriesId: series.id }, orderBy: { index: "asc" } });
  check("12 installments created", rows.length === 12, `got ${rows.length}`);
  check("each installment amount = perInstallment (10000)", rows.every((r) => r.amount === 10000));
  check("first due month = 2026-11", rows[0]?.dueMonth === "2026-11", `got ${rows[0]?.dueMonth}`);
  check("due months roll the year (index 3 = 2027-01)", rows[2]?.dueMonth === "2027-01", `got ${rows[2]?.dueMonth}`);
  check("last due month = 2027-10", rows[11]?.dueMonth === "2027-10", `got ${rows[11]?.dueMonth}`);

  const p0 = (await getStudentSeriesWithProgress(student.id))!.progress;
  check("progress starts 0 of 12", p0.paid === 0 && p0.total === 12);
  check("next due = first month (2026-11)", p0.nextDueMonth === "2026-11", `got ${p0.nextDueMonth}`);
  check("not complete", p0.complete === false);

  console.log("\nMark installment #1 paid WITH a transaction reference");
  const r1 = await markInstallmentPaid(null, rows[0].id, { txnRef: `TXN-${T}`, method: "bkash" });
  check("returned installment now has paidAt", r1.installment.paidAt != null);
  check("txn ref stored on the installment", r1.installment.txnRef === `TXN-${T}`);
  check("method stored", r1.installment.method === "bkash");
  const p1 = (await getStudentSeriesWithProgress(student.id))!.progress;
  check("progress 1 of 12", p1.paid === 1 && p1.total === 12, `got ${p1.paid}/${p1.total}`);
  check("paidAmount = 10000", p1.paidAmount === 10000, `got ${p1.paidAmount}`);
  check("next due advanced to 2026-12", p1.nextDueMonth === "2026-12", `got ${p1.nextDueMonth}`);
  // Scoped to THIS installment's id (not a global action-prefix count) so concurrent runs can't skew it.
  check("an audit row was written for the mark", (await prisma.auditLog.count({ where: { entityId: rows[0].id, action: { startsWith: "installment.mark" } } })) === 1);

  console.log("\nMark installment #2 paid WITHOUT a reference (ref is optional)");
  const r2 = await markInstallmentPaid(null, rows[1].id, {});
  check("paidAt set", r2.installment.paidAt != null);
  check("txn ref stays null when omitted", r2.installment.txnRef === null);
  const p2 = (await getStudentSeriesWithProgress(student.id))!.progress;
  check("progress 2 of 12", p2.paid === 2, `got ${p2.paid}`);

  console.log("\nMarking the SAME installment (#1) again is safe — no double-apply");
  const firstPaidAt = r1.installment.paidAt!.getTime();
  const r1again = await markInstallmentPaid(null, rows[0].id, { txnRef: `TXN-${T}` });
  check("second mark reports alreadyPaid", r1again.alreadyPaid === true);
  check("paidAt NOT moved (original timestamp preserved)", r1again.installment.paidAt!.getTime() === firstPaidAt);
  const p3 = (await getStudentSeriesWithProgress(student.id))!.progress;
  check("progress still 2 of 12 (not double-counted)", p3.paid === 2, `got ${p3.paid}`);
  check("paidAmount still 20000 (not double-applied)", p3.paidAmount === 20000, `got ${p3.paidAmount}`);
  check("still exactly 12 installment rows (no duplicates)", (await prisma.installment.count({ where: { seriesId: series.id } })) === 12);

  console.log("\nMoney model untouched + duplicate series rejected");
  // Isolated to THIS test's student (created fresh with no donations): if the series /
  // marks minted any money, it would show here — robust to concurrent donation writes.
  check("NO Donation rows were created by the series/marks", (await prisma.donation.count({ where: { studentId: student.id } })) === 0, "installments never mint money");
  let dupRejected = false;
  try { await createInstallmentSeries(null, student.id, { label: `${T} award`, count: 12, totalAmount: 120000, perInstallment: 10000, startYear: 2026, startMonth: 11 }); }
  catch (e) { dupRejected = e instanceof SeriesExistsError; }
  check("duplicate series label rejected (SeriesExistsError)", dupRejected);

  console.log("\nYearly total must equal per-installment × months (no misleading progress)");
  // The form boundary (schema) rejects 12 × $500 with a $5000 total.
  const badParse = createSeriesSchema.safeParse({ label: "x", count: 12, perInstallment: 50000, totalAmount: 500000, startYear: 2026, startMonth: 1 });
  check("schema rejects total ≠ per × months (12×$500 with $5000 total)", !badParse.success);
  // A consistent one parses fine (12 × $500 = $6000 total).
  const goodParse = createSeriesSchema.safeParse({ label: "x", count: 12, perInstallment: 50000, totalAmount: 600000, startYear: 2026, startMonth: 1 });
  check("schema accepts a consistent total (12×$500 = $6000)", goodParse.success);
  // The service guard also rejects a direct mismatched call.
  let mismatchRejected = false;
  try { await createInstallmentSeries(null, student.id, { label: `${T} mismatch`, count: 12, perInstallment: 50000, totalAmount: 500000, startYear: 2026, startMonth: 1 }); }
  catch (e) { mismatchRejected = e instanceof SeriesAmountMismatchError; }
  check("service rejects mismatched total (SeriesAmountMismatchError)", mismatchRejected);

  console.log(`\n${failures === 0 ? "✓ ALL INSTALLMENT CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  // Installments cascade with the series; audit rows are scoped by the ids we created.
  const instIds = (await prisma.installment.findMany({ where: { seriesId: { in: seriesIds } }, select: { id: true } })).map((i) => i.id);
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...seriesIds, ...instIds] } } });
  await prisma.installmentSeries.deleteMany({ where: { id: { in: seriesIds } } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  console.log("  (cleaned up test data)");
}

main()
  .catch((e) => { console.error("verify-installments error:", e); failures++; })
  .finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
