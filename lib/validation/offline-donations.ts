import { z } from "zod";
import { minorUnitsUsd } from "@/lib/validation/donations";

export const offlineSource = z.enum(["CASH", "CHECK", "BANK", "LEGACY", "OTHER"]);
const designation = z.enum(["STUDENT", "PROJECT", "GENERAL"]);

/** Manual admin entry of an offline gift. USD, integer minor units. */
export const offlineDonationSchema = z
  .object({
    donorId: z.string().cuid().optional(),
    donorName: z.string().trim().min(1).max(120).optional(),
    donorEmail: z.string().trim().toLowerCase().email().optional(),
    amount: minorUnitsUsd,
    currency: z.literal("usd").default("usd"),
    source: offlineSource,
    designationType: designation,
    studentId: z.string().cuid().optional(),
    projectId: z.string().cuid().optional(),
    sessionId: z.string().cuid().optional(),
    occurredAt: z.coerce.date(),
    isHistorical: z.boolean().default(false),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((v) => !!v.donorId || !!v.donorName, { message: "Provide an existing donorId or a donorName" })
  .refine(
    (v) =>
      (v.designationType === "STUDENT" && !!v.studentId && !v.projectId) ||
      (v.designationType === "PROJECT" && !!v.projectId && !v.studentId) ||
      (v.designationType === "GENERAL" && !v.studentId && !v.projectId),
    { message: "designationType must match its target" },
  );

/** Editable fields on an offline (non-Stripe) row. */
export const offlineUpdateSchema = z
  .object({
    amount: minorUnitsUsd.optional(),
    source: offlineSource.optional(),
    occurredAt: z.coerce.date().optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Provide at least one field to update" });

/** An adjustment amount may be NEGATIVE (a correction that reduces a total). */
export const adjustmentSchema = z.object({
  correctionOfId: z.string().cuid(),
  amount: z.number().int().refine((n) => n !== 0, "Adjustment cannot be zero"),
  note: z.string().trim().max(1000).optional(),
});

/** One CSV row for legacy backfill. Amount is in DOLLARS (human-friendly). */
export const legacyCsvRowSchema = z.object({
  donorName: z.string().trim().min(1, "donorName required"),
  donorEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  amountUsd: z.coerce.number().positive("amountUsd must be positive"),
  designationType: designation,
  targetSlug: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  occurredAt: z.coerce.date(),
  note: z.string().trim().max(1000).optional().or(z.literal("").transform(() => undefined)),
});

export type OfflineDonationInput = z.infer<typeof offlineDonationSchema>;
export type LegacyCsvRow = z.infer<typeof legacyCsvRowSchema>;
