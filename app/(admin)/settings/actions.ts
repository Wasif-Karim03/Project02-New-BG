"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { deactivateAllStudents } from "@/lib/services/student-record";
import { PAYMENT_KEYS, SessionLabelTakenError, createAcademicSession, setCurrentAcademicSession, setSetting } from "@/lib/services/settings";

export async function savePaymentSettingsAction(formData: FormData) {
  const admin = await requireAdmin();
  for (const key of PAYMENT_KEYS) await setSetting(admin.id, key, String(formData.get(key) ?? ""));
  revalidatePath("/settings");
  revalidatePath("/give");
  redirect("/settings?saved=1");
}

export async function createSessionAction(formData: FormData) {
  const admin = await requireAdmin();
  try {
    await createAcademicSession(admin.id, String(formData.get("label") || ""), formData.get("makeCurrent") === "on");
  } catch (e) {
    if (e instanceof SessionLabelTakenError) redirect("/settings?error=" + encodeURIComponent(e.message));
    throw e;
  }
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export async function setCurrentSessionAction(formData: FormData) {
  const admin = await requireAdmin();
  await setCurrentAcademicSession(admin.id, String(formData.get("id")));
  revalidatePath("/settings");
}

export async function yearEndDeactivateAction() {
  const admin = await requireAdmin();
  const n = await deactivateAllStudents(admin.id);
  redirect(`/settings?deactivated=${n}`);
}
