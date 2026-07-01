import { z } from "zod";

// Money is INTEGER MINOR UNITS. USD only in v1 — enforced right here at the boundary.
export const minorUnitsUsd = z
  .number()
  .int("Amount must be an integer number of cents")
  .positive("Amount must be positive")
  .max(100_000_00, "Amount exceeds the $100,000 limit");

export const currencyUsd = z.literal("usd");

/** Input for starting a Checkout — the donor chooses an amount + a designation. */
export const checkoutInputSchema = z
  .object({
    amount: minorUnitsUsd, // cents
    currency: currencyUsd.default("usd"),
    designationType: z.enum(["STUDENT", "PROJECT", "GENERAL"]),
    studentId: z.string().cuid().optional(),
    projectId: z.string().cuid().optional(),
    sessionId: z.string().cuid().optional(),
    donorName: z.string().trim().min(1).max(120).optional(),
    donorEmail: z.string().trim().toLowerCase().email().optional(),
  })
  .refine(
    (v) =>
      (v.designationType === "STUDENT" && !!v.studentId && !v.projectId) ||
      (v.designationType === "PROJECT" && !!v.projectId && !v.studentId) ||
      (v.designationType === "GENERAL" && !v.studentId && !v.projectId),
    { message: "designationType must match its target (STUDENT→studentId, PROJECT→projectId, GENERAL→neither)" },
  );

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
