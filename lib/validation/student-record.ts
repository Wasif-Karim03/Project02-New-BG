import { z } from "zod";

const money = z.coerce.number().int().min(0).max(100_000_00).optional(); // minor units
const t = z.string().trim().max(400).optional();

// Admin-editable "backend record" fields on a Student.
export const studentRecordSchema = z.object({
  registrationId: z.string().trim().max(60).optional(),
  purpose: t,
  careerGoal: t,
  fatherProfession: t,
  motherProfession: t,
  familyIncome: t,
  addrDistrict: t,
  guardianName: t,
  guardianMobile: t,
  guardianAddress: t,
  tutorName: t,
  tutorPhone: t,
  // funding plan (minor units)
  paymentType: z.enum(["ONE_TIME", "INSTALLMENT"]).optional(),
  requireAmount: money,
  minDonateAmount: money,
  perInstallment: money,
  targetType: z.enum(["MONTH", "YEAR"]).optional(),
  targetPeriod: z.string().trim().max(20).optional(),
  verified: z.boolean().optional(),
});

// One per-session education row.
export const studentSessionSchema = z.object({
  sessionId: z.string().cuid(),
  institutionName: t,
  grade: t,
  roll: t,
  formerRoll: t,
  totalStudent: t,
});

export type StudentRecordInput = z.infer<typeof studentRecordSchema>;
export type StudentSessionInput = z.infer<typeof studentSessionSchema>;
