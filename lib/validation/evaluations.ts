import { z } from "zod";

// Mirrors StudentEvaluation's writable fields. contactBy matches the ContactMethod enum.
export const contactMethod = z.enum(["MOBILE", "EMAIL", "WHATSAPP", "IN_PERSON", "OTHER"]);

const evaluationBase = {
  evaluationType: z.string().trim().max(120).optional(),
  date: z.coerce.date().optional(),
  contactPerson: z.string().trim().max(160).optional(),
  contactBy: contactMethod.optional(),
  remarks: z.string().trim().max(5000).optional(),
  // A reference/key or URL to an uploaded file. NOTE: real object-storage upload
  // (presigned URLs) is deferred to a later phase; this stores the reference only.
  fileUrl: z.string().trim().max(500).optional(),
  publishConsent: z.boolean().optional(),
};

export const createEvaluationSchema = z.object(evaluationBase);
export const updateEvaluationSchema = z.object(evaluationBase).refine(
  (v) => Object.values(v).some((x) => x !== undefined),
  { message: "At least one field must be provided" },
);

export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>;
export type UpdateEvaluationInput = z.infer<typeof updateEvaluationSchema>;
