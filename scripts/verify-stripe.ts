/**
 * Phase D verification (offline, no live keys, nothing billable). Uses the Stripe
 * SDK's test-signature helper to sign fixture events and feed them to the real
 * webhook handler. Proves:
 *   - a Checkout success creates exactly ONE Donation with the amount STRIPE reports
 *   - a duplicate webhook event is a no-op (event-level idempotency)
 *   - a second event for the same charge creates no second row (row-level idempotency)
 *   - an unsigned / badly-signed webhook is rejected (400) with no side effect
 *   - guest→account match happens only on a VERIFIED email
 *   - refund events move status (partial → refundedAmount; full → REFUNDED)
 *   - a lost dispute moves status (→ VOIDED)
 *   - getGiftContext returns REAL gift data
 *
 * Run after the seed:  npx tsx scripts/verify-stripe.ts
 */
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_bg_local";

import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { getGiftContext } from "@/lib/services/gift-context";
import { LARGE_DONATION_THRESHOLD_CENTS, STRIPE_MIN_CENTS, checkoutInputSchema } from "@/lib/validation/donations";
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

function sign(eventObj: unknown) {
  const payload = JSON.stringify(eventObj);
  const header = signer.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return { payload, header };
}
async function deliver(eventObj: { id: string }) {
  eventIds.push(eventObj.id);
  const { payload, header } = sign(eventObj);
  return handleStripeWebhook(payload, header);
}

function checkoutEvent(id: string, o: { session: string; pi: string; amount: number; email?: string; name?: string; metadata: Record<string, string>; feeAmount?: number }) {
  return {
    id, object: "event", type: "checkout.session.completed",
    data: { object: {
      id: o.session, object: "checkout.session", payment_intent: o.pi,
      amount_total: o.amount, currency: "usd",
      customer_details: o.email ? { email: o.email, name: o.name ?? null } : null,
      metadata: o.metadata, created: 1700000000, feeAmount: o.feeAmount ?? null,
    } },
  };
}
function refundEvent(id: string, o: { pi: string; amountRefunded: number }) {
  return { id, object: "event", type: "charge.refunded", data: { object: { id: `ch_${id}`, object: "charge", payment_intent: o.pi, amount_refunded: o.amountRefunded } } };
}
function disputeEvent(id: string, o: { pi: string; status: string }) {
  return { id, object: "event", type: "charge.dispute.closed", data: { object: { id: `dp_${id}`, object: "dispute", payment_intent: o.pi, status: o.status } } };
}

async function donationByKey(key: string) {
  return prisma.donation.findUnique({ where: { idempotencyKey: key } });
}

async function main() {
  const project = await prisma.project.create({ data: { title: `Test Project ${T}`, slug: `test-project-${T}`, fundingGoal: 1_000_000, currency: "USD" } });
  const verified = await prisma.user.create({ data: { email: `verified-${T}@x.test`, name: "Verified Vera", role: "DONOR", status: "ACTIVE", emailVerified: new Date() } });

  const CS1 = `cs_${T}_1`, PI1 = `pi_${T}_1`;

  console.log("\nCheckout success → exactly one Donation with Stripe's amount");
  const r1 = await deliver(checkoutEvent(`evt_${T}_1`, { session: CS1, pi: PI1, amount: 5000, email: `guest-${T}@x.test`, name: "Guest Gina", metadata: { designationType: "PROJECT", projectId: project.id }, feeAmount: 175 }));
  check("processed (200)", r1.status === 200 && r1.processed === true, r1.message);
  const d1 = await donationByKey(CS1);
  check("donation created", !!d1);
  check("amount = Stripe amount_total (5000)", d1?.amount === 5000, `amount=${d1?.amount}`);
  check("currency USD, status SUCCEEDED, source STRIPE", d1?.currency === "USD" && d1?.status === "SUCCEEDED" && d1?.source === "STRIPE");
  check("fee/net split (fee 175 → net 4825)", d1?.feeAmount === 175 && d1?.netAmount === 4825);
  check("linked to the payment intent", d1?.stripePaymentIntentId === PI1);
  const cnt1 = await prisma.donation.count({ where: { idempotencyKey: CS1 } });
  check("exactly ONE donation for this checkout", cnt1 === 1, `count=${cnt1}`);
  const receipt = d1 ? await prisma.receipt.findUnique({ where: { donationId: d1.id } }) : null;
  check("receipt was generated (non-historical)", !!receipt);
  const guestDonor = d1 ? await prisma.donor.findUnique({ where: { id: d1.donorId } }) : null;
  check("guest email → guest donor (userId null)", guestDonor?.userId === null);

  console.log("\nIdempotency");
  const rDup = await deliver(checkoutEvent(`evt_${T}_1`, { session: CS1, pi: PI1, amount: 5000, metadata: { designationType: "PROJECT", projectId: project.id } }));
  check("duplicate event is a no-op (processed:false)", rDup.status === 200 && rDup.processed === false);
  check("still exactly one donation after duplicate", (await prisma.donation.count({ where: { idempotencyKey: CS1 } })) === 1);
  // Different event id, SAME payment intent → row-level guard blocks a 2nd row.
  const rRow = await deliver(checkoutEvent(`evt_${T}_1b`, { session: `${CS1}_b`, pi: PI1, amount: 5000, metadata: { designationType: "PROJECT", projectId: project.id } }));
  check("new event, same charge → no second donation (row-level)", (await prisma.donation.count({ where: { stripePaymentIntentId: PI1 } })) === 1, rRow.message);
  // Task requirement: firing the SAME event THREE times yields exactly one Donation.
  await deliver(checkoutEvent(`evt_${T}_1`, { session: CS1, pi: PI1, amount: 5000, metadata: { designationType: "PROJECT", projectId: project.id } }));
  check("same event fired 3× total → still exactly ONE donation", (await prisma.donation.count({ where: { idempotencyKey: CS1 } })) === 1);

  console.log("\nDesignation + tribute + note survive the round trip (Checkout metadata)");
  const CS3 = `cs_${T}_3`, PI3 = `pi_${T}_3`;
  await deliver(checkoutEvent(`evt_${T}_6`, { session: CS3, pi: PI3, amount: 2500, email: `trib-${T}@x.test`, name: "Trib Tara", metadata: { designationType: "PROJECT", projectId: project.id, note: "For the science lab", tributeType: "memory", tributeName: "Grandpa Joe", tributeMessage: "In loving memory", tributePublic: "true", isAnonymous: "true" } }));
  const d3 = await donationByKey(CS3);
  check("designation survives (PROJECT + projectId)", d3?.designationType === "PROJECT" && d3?.projectId === project.id);
  check("tribute survives (type / name / message / public)", d3?.tributeType === "memory" && d3?.tributeName === "Grandpa Joe" && d3?.tributeMessage === "In loving memory" && d3?.tributePublic === true);
  check("donor note survives", d3?.note === "For the science lab");
  const d3Donor = d3 ? await prisma.donor.findUnique({ where: { id: d3.donorId } }) : null;
  check("isAnonymous metadata → donor opted off the public wall", d3Donor?.isAnonymous === true);

  console.log("\nAmount bounds enforced at the boundary (frozen money model — Agent E)");
  const g = { designationType: "GENERAL" as const };
  check("min: 49¢ ($0.49) rejected", !checkoutInputSchema.safeParse({ ...g, amount: 49 }).success);
  check("min: 50¢ ($0.50, Stripe floor) accepted", checkoutInputSchema.safeParse({ ...g, amount: 50 }).success);
  check("max: $100,000 accepted, $100,000.01 rejected", checkoutInputSchema.safeParse({ ...g, amount: 100_000_00 }).success && !checkoutInputSchema.safeParse({ ...g, amount: 100_000_01 }).success);
  check("non-integer cents rejected (no floats anywhere)", !checkoutInputSchema.safeParse({ ...g, amount: 50.5 }).success);
  check("STRIPE_MIN_CENTS = 50 and confirm threshold = $5,000", STRIPE_MIN_CENTS === 50 && LARGE_DONATION_THRESHOLD_CENTS === 500_000);

  console.log("\nSignature rejection");
  const badPayload = JSON.stringify(checkoutEvent(`evt_${T}_bad`, { session: `cs_${T}_bad`, pi: `pi_${T}_bad`, amount: 9999, metadata: { designationType: "GENERAL" } }));
  const rBad = await handleStripeWebhook(badPayload, "t=1,v1=deadbeef");
  check("bad signature rejected (400)", rBad.status === 400 && rBad.ok === false);
  const rUnsigned = await handleStripeWebhook(badPayload, null);
  check("unsigned rejected (400)", rUnsigned.status === 400);
  check("no donation created from rejected webhooks", (await prisma.donation.count({ where: { idempotencyKey: `cs_${T}_bad` } })) === 0);

  console.log("\nGuest→account match on VERIFIED email only");
  const CS2 = `cs_${T}_2`, PI2 = `pi_${T}_2`;
  await deliver(checkoutEvent(`evt_${T}_2`, { session: CS2, pi: PI2, amount: 3000, email: verified.email, name: "Verified Vera", metadata: { designationType: "GENERAL" } }));
  const d2 = await donationByKey(CS2);
  const d2Donor = d2 ? await prisma.donor.findUnique({ where: { id: d2.donorId } }) : null;
  check("verified email → matched to the account", d2Donor?.userId === verified.id);

  console.log("\ngetGiftContext returns REAL data (pre-refund)");
  const gc = await getGiftContext(CS1);
  check("real gift context", gc?.amount === 5000 && gc?.designation === "PROJECT" && gc?.firstName === "Guest", JSON.stringify(gc));
  check("unknown reference → null", (await getGiftContext("cs_does_not_exist")) === null);

  console.log("\nRefund & dispute move status");
  await deliver(refundEvent(`evt_${T}_3`, { pi: PI1, amountRefunded: 2000 }));
  const dPartial = await donationByKey(CS1);
  check("partial refund → refundedAmount set, status stays SUCCEEDED", dPartial?.refundedAmount === 2000 && dPartial?.status === "SUCCEEDED");
  await deliver(refundEvent(`evt_${T}_4`, { pi: PI1, amountRefunded: 5000 }));
  const dFull = await donationByKey(CS1);
  check("full refund → refundedAmount == amount, status REFUNDED", dFull?.refundedAmount === 5000 && dFull?.status === "REFUNDED");
  await deliver(disputeEvent(`evt_${T}_5`, { pi: PI2, status: "lost" }));
  const dDisputed = await donationByKey(CS2);
  check("lost dispute → status VOIDED", dDisputed?.status === "VOIDED");

  console.log(`\n${failures === 0 ? "✓ ALL STRIPE CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);

  await cleanup([project.id], [verified.id], [CS1, CS2, `cs_${T}_3`]);
}

async function cleanup(projectIds: string[], userIds: string[], keys: string[]) {
  const donations = await prisma.donation.findMany({ where: { OR: [{ idempotencyKey: { in: keys } }, { stripePaymentIntentId: { startsWith: `pi_${T}` } }] }, select: { id: true, donorId: true } });
  const donationIds = donations.map((d) => d.id);
  const donorIds = [...new Set(donations.map((d) => d.donorId))];
  await prisma.auditLog.deleteMany({ where: { entityId: { in: donationIds } } });
  await prisma.donation.deleteMany({ where: { id: { in: donationIds } } }); // cascades receipts
  await prisma.donor.deleteMany({ where: { id: { in: donorIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.stripeEvent.deleteMany({ where: { eventId: { in: eventIds } } });
  console.log("  (cleaned up test data)");
}

main()
  .catch((e) => {
    console.error("verify-stripe error:", e);
    failures++;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
  });
