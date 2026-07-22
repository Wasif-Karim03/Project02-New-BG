/**
 * Phase E verification (offline, SDK-signed fixtures, no live keys). Proves:
 *   - subscription checkout persists a Subscription but creates NO donation
 *   - FIRST CYCLE is not double-counted: checkout(sub) + first invoice → exactly ONE
 *   - a retried invoice.payment_succeeded is a no-op (event- AND row-level)
 *   - a monthly cycle creates one Donation attributed to the CURRENT session
 *   - fee/net enrichment lands on the cycle donation and is idempotent
 *   - lifecycle maps (past_due → PAST_DUE), cancel → CANCELED, no further donations,
 *     canceled subs drop out of active sponsorships
 *
 * Run after the seed:  npx tsx scripts/verify-subscriptions.ts
 */
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_bg_local";

import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { adminCreateStudent } from "@/lib/services/accounts";
import { listActiveSponsorships } from "@/lib/services/subscriptions";
import { handleStripeWebhook } from "@/lib/webhooks/stripe-handler";

const prisma = new PrismaClient();
const signer = new Stripe("sk_test_dummy_for_signing_only");
const SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
const T = Date.now();

let failures = 0;
const eventIds: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}
async function deliver(eventObj: { id: string }) {
  eventIds.push(eventObj.id);
  const payload = JSON.stringify(eventObj);
  const header = signer.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return handleStripeWebhook(payload, header);
}
const SUB = `sub_${T}`;
function subCheckout(id: string, o: { session: string; email: string; studentId: string; amount: number }) {
  return { id, object: "event", type: "checkout.session.completed", data: { object: { id: o.session, object: "checkout.session", mode: "subscription", subscription: SUB, customer_details: { email: o.email, name: "Recurring Rita" }, metadata: { designationType: "STUDENT", studentId: o.studentId, interval: "month" }, amount_total: o.amount, currency: "usd" } } };
}
function invoicePaid(id: string, o: { invoice: string; pi: string; charge: string; amount: number }) {
  return { id, object: "event", type: "invoice.payment_succeeded", data: { object: { id: o.invoice, object: "invoice", subscription: SUB, payment_intent: o.pi, charge: o.charge, amount_paid: o.amount, currency: "usd", created: 1700000000 } } };
}
function chargeSucceeded(id: string, o: { charge: string; pi: string; fee: number }) {
  return { id, object: "event", type: "charge.succeeded", data: { object: { id: o.charge, object: "charge", payment_intent: o.pi, amount: 3000, balance_transaction: { object: "balance_transaction", fee: o.fee } } } };
}
function subUpdated(id: string, status: string) {
  return { id, object: "event", type: "customer.subscription.updated", data: { object: { id: SUB, object: "subscription", status, current_period_end: 1710000000, canceled_at: null } } };
}
function subDeleted(id: string) {
  return { id, object: "event", type: "customer.subscription.deleted", data: { object: { id: SUB, object: "subscription", status: "canceled", canceled_at: 1710000000 } } };
}
const countCycleDonations = () => prisma.donation.count({ where: { subscription: { stripeSubscriptionId: SUB } } });

async function main() {
  console.log("\nNo PUBLIC path can start a Stripe subscription (one-time only)");
  // The subscription checkout builder + webhook handlers stay intact (load-bearing for
  // the manual-pledge model), but NOTHING under app/ may call the subscription builder —
  // so no donor flow can start a Stripe subscription. Guards the removal from regressing.
  const subCallers = execSync("grep -rlE 'createSubscriptionCheckout[[:space:]]*\\(' app/ 2>/dev/null || true", { encoding: "utf8" }).trim();
  check("no app/ route or action CALLS createSubscriptionCheckout", subCallers === "", subCallers ? `callers: ${subCallers.replace(/\n/g, ", ")}` : "");
  const svcPresent = execSync("grep -rl 'export async function createSubscriptionCheckout' lib/ 2>/dev/null || true", { encoding: "utf8" }).trim();
  check("createSubscriptionCheckout service still present (scaffolding retained)", svcPresent !== "");

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@bridginggenerations.org" } });
  const current = await prisma.academicSession.findFirstOrThrow({ where: { isCurrent: true } });
  const student = await adminCreateStudent(admin.id, { firstName: "Tuli" });

  const PI1 = `pi_${T}_c1`, CH1 = `ch_${T}_c1`, IN1 = `in_${T}_1`;

  console.log("\nSubscription checkout persists the sub, creates NO donation");
  await deliver(subCheckout(`evt_${T}_cs`, { session: `cs_${T}_sub`, email: `rita-${T}@x.test`, studentId: student.studentId, amount: 3000 }));
  const sub = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: SUB } });
  check("subscription persisted (ACTIVE, STUDENT designation)", sub?.status === "ACTIVE" && sub?.studentId === student.studentId);
  check("no donation yet", (await countCycleDonations()) === 0);

  console.log("\nFirst cycle → exactly one Donation (no double-count)");
  await deliver(invoicePaid(`evt_${T}_in1`, { invoice: IN1, pi: PI1, charge: CH1, amount: 3000 }));
  check("exactly ONE donation after checkout(sub) + first invoice", (await countCycleDonations()) === 1);
  const d1 = await prisma.donation.findFirst({ where: { idempotencyKey: IN1 } });
  check("donation is recurring, linked, attributed to current session", d1?.isRecurring === true && d1?.subscriptionId === sub?.id && d1?.sessionId === current.id);
  check("amount from Stripe (3000)", d1?.amount === 3000);

  console.log("\nRetried invoice is a no-op");
  await deliver(invoicePaid(`evt_${T}_in1`, { invoice: IN1, pi: PI1, charge: CH1, amount: 3000 })); // same event id
  check("same event id → no-op (still 1)", (await countCycleDonations()) === 1);
  await deliver(invoicePaid(`evt_${T}_in1b`, { invoice: IN1, pi: PI1, charge: CH1, amount: 3000 })); // new event, same invoice
  check("new event, same invoice → no-op (still 1)", (await countCycleDonations()) === 1);

  console.log("\nFee/net enrichment (idempotent)");
  await deliver(chargeSucceeded(`evt_${T}_ch1`, { charge: CH1, pi: PI1, fee: 117 }));
  const enriched = await prisma.donation.findFirst({ where: { idempotencyKey: IN1 } });
  check("fee 117 → net 2883 on the cycle donation", enriched?.feeAmount === 117 && enriched?.netAmount === 2883);
  await deliver(chargeSucceeded(`evt_${T}_ch1b`, { charge: CH1, pi: PI1, fee: 117 })); // new event, same fee
  const reEnriched = await prisma.donation.findFirst({ where: { idempotencyKey: IN1 } });
  check("re-enrichment is idempotent (still 117/2883)", reEnriched?.feeAmount === 117 && reEnriched?.netAmount === 2883);

  console.log("\nMonthly cycle → one more Donation, attributed to current session");
  await deliver(invoicePaid(`evt_${T}_in2`, { invoice: `in_${T}_2`, pi: `pi_${T}_c2`, charge: `ch_${T}_c2`, amount: 3000 }));
  check("second cycle → 2 donations total", (await countCycleDonations()) === 2);
  const d2 = await prisma.donation.findFirst({ where: { idempotencyKey: `in_${T}_2` } });
  check("second cycle attributed to current session", d2?.sessionId === current.id);

  console.log("\nLifecycle + cancel");
  await deliver(subUpdated(`evt_${T}_pd`, "past_due"));
  check("past_due → PAST_DUE", (await prisma.subscription.findUnique({ where: { stripeSubscriptionId: SUB } }))?.status === "PAST_DUE");
  await deliver(subDeleted(`evt_${T}_del`));
  const canceled = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: SUB } });
  check("cancel → CANCELED", canceled?.status === "CANCELED" && canceled?.canceledAt != null);
  check("cancel created no new donation", (await countCycleDonations()) === 2);
  const active = await listActiveSponsorships();
  check("canceled subscription is excluded from active sponsorships", !active.some((s) => s.id === sub?.id));

  console.log(`\n${failures === 0 ? "✓ ALL SUBSCRIPTION CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);

  await cleanup(sub?.id, student.studentId);
}

async function cleanup(subId: string | undefined, studentId: string) {
  const donations = await prisma.donation.findMany({ where: { subscription: { stripeSubscriptionId: SUB } }, select: { id: true, donorId: true } });
  const donationIds = donations.map((d) => d.id);
  const donorIds = [...new Set(donations.map((d) => d.donorId))];
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...donationIds, ...(subId ? [subId] : []), studentId] } } });
  await prisma.donation.deleteMany({ where: { id: { in: donationIds } } });
  if (subId) await prisma.subscription.deleteMany({ where: { id: subId } });
  await prisma.donor.deleteMany({ where: { id: { in: donorIds } } });
  await prisma.student.deleteMany({ where: { id: studentId } });
  await prisma.stripeEvent.deleteMany({ where: { eventId: { in: eventIds } } });
  console.log("  (cleaned up test data)");
}

main()
  .catch((e) => {
    console.error("verify-subscriptions error:", e);
    failures++;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
  });
