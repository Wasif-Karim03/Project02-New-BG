"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { approveApplication, rejectApplication } from "@/lib/services/application-review";

export async function approveApplicationAction(formData: FormData) {
  const admin = await requireAdmin();
  await approveApplication(admin.id, String(formData.get("id")));
  revalidatePath("/applications");
}

export async function rejectApplicationAction(formData: FormData) {
  const admin = await requireAdmin();
  await rejectApplication(admin.id, String(formData.get("id")), String(formData.get("reason") ?? ""));
  revalidatePath("/applications");
}
