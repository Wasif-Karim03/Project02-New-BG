"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { approveStudent, approveUser, rejectStudent, rejectUser } from "@/lib/services/approvals";

export async function approveUserAction(formData: FormData) {
  const admin = await requireAdmin();
  await approveUser(admin.id, String(formData.get("id")));
  revalidatePath("/approvals");
}

export async function rejectUserAction(formData: FormData) {
  const admin = await requireAdmin();
  await rejectUser(admin.id, String(formData.get("id")), String(formData.get("reason") ?? ""));
  revalidatePath("/approvals");
}

export async function approveStudentAction(formData: FormData) {
  const admin = await requireAdmin();
  await approveStudent(admin.id, String(formData.get("id")));
  revalidatePath("/approvals");
}

export async function rejectStudentAction(formData: FormData) {
  const admin = await requireAdmin();
  await rejectStudent(admin.id, String(formData.get("id")), String(formData.get("reason") ?? ""));
  revalidatePath("/approvals");
}
