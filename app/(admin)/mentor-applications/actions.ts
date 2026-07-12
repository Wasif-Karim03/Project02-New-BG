"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { approveMentorApplication, rejectMentorApplication } from "@/lib/services/mentor-applications";

export async function approveMentorAction(formData: FormData) {
  const admin = await requireAdmin();
  await approveMentorApplication(admin.id, String(formData.get("id")));
  revalidatePath("/mentor-applications");
}

export async function rejectMentorAction(formData: FormData) {
  const admin = await requireAdmin();
  await rejectMentorApplication(admin.id, String(formData.get("id")), String(formData.get("reason") || ""));
  revalidatePath("/mentor-applications");
}
