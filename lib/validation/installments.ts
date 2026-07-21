import { z } from "zod";
import { minorUnitsUsd } from "@/lib/validation/donations";

// A linked monthly installment series (Phase 7): a yearly award paid monthly via
// the live bKash/Nagad/Rocket path. Amounts are MINOR UNITS (USD v1), matching the
// frozen money model. `count` months (default 12) starting at startYear-startMonth.
export const createSeriesSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    count: z.coerce.number().int().min(1).max(24).default(12),
    totalAmount: minorUnitsUsd, // yearly award total, minor units
    perInstallment: minorUnitsUsd, // default amount per monthly installment, minor units
    startYear: z.coerce.number().int().min(2000).max(2100),
    startMonth: z.coerce.number().int().min(1).max(12),
    sessionId: z.string().cuid().optional(),
  })
  // The yearly total must equal per-installment × months. Every installment carries
  // the same amount, so a total that isn't their sum would make "N of 12 paid ($X of
  // $Y)" progress misleading. Enforced at the boundary; also guarded in the service.
  .refine((v) => v.totalAmount === v.perInstallment * v.count, {
    message: "Yearly total must equal per-installment × months.",
    path: ["totalAmount"],
  });

// Marking one monthly installment paid. The transaction reference is OPTIONAL
// (the bKash/Nagad/Rocket txn id), stored per installment. An optional donationId
// links the real Donation that settled it.
export const markInstallmentSchema = z.object({
  txnRef: z.string().trim().max(120).optional(),
  method: z.enum(["bkash", "nagad", "rocket", "bank", "cash", "other"]).optional(),
  donationId: z.string().cuid().optional(),
});

export type CreateSeriesInput = z.infer<typeof createSeriesSchema>;
export type MarkInstallmentInput = z.infer<typeof markInstallmentSchema>;
