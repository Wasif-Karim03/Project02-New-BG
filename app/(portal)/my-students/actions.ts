"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActiveMentor } from "@/lib/auth/guards";
import { registerStudentByMentor } from "@/lib/services/accounts";
import { createEvaluation } from "@/lib/services/mentor";
import { mentorRegisterStudentSchema } from "@/lib/validation/accounts";
import { createEvaluationSchema } from "@/lib/validation/evaluations";

export async function registerStudentAction(formData: FormData) {
  const mentor = await requireActiveMentor();
  const parsed = mentorRegisterStudentSchema.safeParse({
    firstName: formData.get("firstName"),
    fullName: formData.get("fullName") || undefined,
    community: formData.get("community") || undefined,
  });
  if (!parsed.success) redirect("/my-students?error=" + encodeURIComponent("A first name is required"));
  // Creates a PENDING, login-less Student in the admin approval queue.
  await registerStudentByMentor(mentor.id, parsed.data);
  redirect("/my-students?registered=1");
}

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
