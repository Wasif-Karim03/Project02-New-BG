"use server";

import { revalidatePath } from "next/cache";
import { requireActiveMentor } from "@/lib/auth/guards";
import { createEvaluation } from "@/lib/services/mentor";
import { createEvaluationSchema } from "@/lib/validation/evaluations";

export async function createEvaluationAction(formData: FormData) {
  const mentor = await requireActiveMentor();
  const studentId = String(formData.get("studentId"));
  const parsed = createEvaluationSchema.safeParse({
    evaluationType: formData.get("evaluationType") || undefined,
    contactPerson: formData.get("contactPerson") || undefined,
    contactBy: formData.get("contactBy") || undefined,
    remarks: formData.get("remarks") || undefined,
    fileUrl: formData.get("fileUrl") || undefined,
    publishConsent: formData.get("publishConsent") === "on",
  });
  if (!parsed.success) return;
  // The guard lives in the service: if this mentor is not assigned to studentId
  // for the current session, createEvaluation throws AccessDeniedError. The route
  // cannot bypass it.
  await createEvaluation(mentor.id, studentId, parsed.data);
  revalidatePath("/my-students");
}
