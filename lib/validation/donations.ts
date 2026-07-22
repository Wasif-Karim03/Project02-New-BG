import { z } from "zod";

// Money is INTEGER MINOR UNITS. USD only in v1 — enforced right here at the boundary.
export const minorUnitsUsd = z
  .number()
  .int("Amount must be an integer number of cents")
  .positive("Amount must be positive")
  .max(100_000_00, "Amount exceeds the $100,000 limit");

export const currencyUsd = z.literal("usd");

// Stripe's minimum charge for USD is $0.50 (50 cents). Checkout enforces this floor.
export const STRIPE_MIN_CENTS = 50;
// Above this amount the public /give flow requires an explicit confirmation step, to
// catch typos like $5000 entered for $50. This is a RECOMMENDED default (chosen because
// the org's gifts are typically tens–hundreds of dollars, so a 4-figure amount warrants
// a second look) — not a hard cap; the hard max stays $100,000. Easy to change here.
export const LARGE_DONATION_THRESHOLD_CENTS = 500_000; // $5,000

// Checkout amount: integer cents, Stripe's $0.50 floor, hard-capped at $100k.
const checkoutAmount = z
  .number()
  .int("Amount must be an integer number of cents")
  .min(STRIPE_MIN_CENTS, "The minimum donation is $0.50.")
  .max(100_000_00, "Amount exceeds the $100,000 limit");

/** Input for starting a Checkout — the donor chooses an amount + a designation. */
export const checkoutInputSchema = z
  .object({
    amount: checkoutAmount, // cents, ≥ $0.50
    currency: currencyUsd.default("usd"),
    designationType: z.enum(["STUDENT", "PROJECT", "GENERAL"]),
    studentId: z.string().cuid().optional(),
    projectId: z.string().cuid().optional(),
    sessionId: z.string().cuid().optional(),
    donorName: z.string().trim().min(1).max(120).optional(),
    donorEmail: z.string().trim().toLowerCase().email().optional(),
    // Optional tribute + note + anonymity. These travel through Stripe Checkout metadata
    // (Stripe caps each metadata value at 500 chars) so the webhook can attribute them to
    // the Donation — the ledger still trusts Stripe for the amount, never these fields.
    isAnonymous: z.boolean().optional(),
    note: z.string().trim().max(500).optional(),
    tributeType: z.enum(["honor", "memory"]).optional(),
    tributeName: z.string().trim().max(120).optional(),
    tributeMessage: z.string().trim().max(500).optional(),
    tributePublic: z.boolean().optional(),
  })
  .refine(
    (v) =>
      (v.designationType === "STUDENT" && !!v.studentId && !v.projectId) ||
      (v.designationType === "PROJECT" && !!v.projectId && !v.studentId) ||
      (v.designationType === "GENERAL" && !v.studentId && !v.projectId),
    { message: "designationType must match its target (STUDENT→studentId, PROJECT→projectId, GENERAL→neither)" },
  );

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
