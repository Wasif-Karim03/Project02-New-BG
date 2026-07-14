"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import {
  approveStudent,
  approveUser,
  NotFoundError,
  NotPendingError,
  ReasonRequiredError,
  rejectStudent,
  rejectUser,
} from "@/lib/services/approvals";

// Turn a known queue error into a friendly redirect back to the queue instead of
// letting it bubble up to the generic error screen. Anything unexpected rethrows.
function isKnown(e: unknown): e is Error {
  return e instanceof NotFoundError || e instanceof NotPendingError || e instanceof ReasonRequiredError;
}

export async function approveUserAction(formData: FormData) {
  const admin = await requireAdmin();
  try {
    await approveUser(admin.id, String(formData.get("id")));
  } catch (e) {
    if (isKnown(e)) redirect(`/approvals?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/approvals");
  redirect("/approvals?ok=approved");
}

export async function rejectUserAction(formData: FormData) {
  const admin = await requireAdmin();
  try {
    await rejectUser(admin.id, String(formData.get("id")), String(formData.get("reason") ?? ""));
  } catch (e) {
    if (isKnown(e)) redirect(`/approvals?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/approvals");
  redirect("/approvals?ok=rejected");
}

export async function approveStudentAction(formData: FormData) {
  const admin = await requireAdmin();
  try {
    await approveStudent(admin.id, String(formData.get("id")));
  } catch (e) {
    if (isKnown(e)) redirect(`/approvals?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/approvals");
  redirect("/approvals?ok=approved");
}

export async function rejectStudentAction(formData: FormData) {
  const admin = await requireAdmin();
  try {
    await rejectStudent(admin.id, String(formData.get("id")), String(formData.get("reason") ?? ""));
  } catch (e) {
    if (isKnown(e)) redirect(`/approvals?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/approvals");
  redirect("/approvals?ok=rejected");
}
