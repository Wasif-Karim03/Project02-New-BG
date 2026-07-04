import { z } from "zod";
import { minorUnitsUsd } from "@/lib/validation/donations";

export const PAYMENT_METHODS = ["bkash", "nagad", "rocket", "bank", "cash", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * A donor telling us about a gift they sent directly (mobile banking / bank / cash).
 * Recorded as a PENDING donation until an admin verifies the money arrived. USD v1.
 */
export const donationClaimSchema = z
  .object({
    donorName: z.string().trim().min(1).max(120),
    donorEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("").transform(() => undefined)),
    amount: minorUnitsUsd, // minor units (dollars → cents in the action)
    designationType: z.enum(["STUDENT", "PROJECT", "GENERAL"]),
    studentId: z.string().cuid().optional(),
    projectId: z.string().cuid().optional(),
    method: z.enum(PAYMENT_METHODS),
    reference: z.string().trim().max(120).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine(
    (v) =>
      (v.designationType === "STUDENT" && !!v.studentId && !v.projectId) ||
      (v.designationType === "PROJECT" && !!v.projectId && !v.studentId) ||
      (v.designationType === "GENERAL" && !v.studentId && !v.projectId),
    { message: "designationType must match its target" },
  );

export type DonationClaimInput = z.infer<typeof donationClaimSchema>;
