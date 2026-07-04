import { z } from "zod";
import { minorUnitsUsd } from "@/lib/validation/donations";

export const createPledgeSchema = z
  .object({
    donorName: z.string().trim().min(1).max(120),
    donorEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("").transform(() => undefined)),
    amount: minorUnitsUsd, // per-cycle, minor units
    interval: z.enum(["month", "year"]).default("month"),
    designationType: z.enum(["STUDENT", "PROJECT", "GENERAL"]),
    studentId: z.string().cuid().optional(),
    projectId: z.string().cuid().optional(),
  })
  .refine(
    (v) =>
      (v.designationType === "STUDENT" && !!v.studentId && !v.projectId) ||
      (v.designationType === "PROJECT" && !!v.projectId && !v.studentId) ||
      (v.designationType === "GENERAL" && !v.studentId && !v.projectId),
    { message: "designationType must match its target" },
  );

export const recordPaymentSchema = z.object({
  amount: minorUnitsUsd.optional(), // defaults to the pledge amount
  method: z.enum(["bkash", "nagad", "rocket", "bank", "cash", "other"]).default("bkash"),
  reference: z.string().trim().max(120).optional(),
  occurredAt: z.coerce.date().optional(),
});

export type CreatePledgeInput = z.infer<typeof createPledgeSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
