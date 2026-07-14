"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import {
  approveApplication,
  NotFoundError,
  NotReviewableError,
  ReasonRequiredError,
  rejectApplication,
} from "@/lib/services/application-review";

// Known review errors → friendly redirect back to the queue, not the error screen.
function isKnown(e: unknown): e is Error {
  return e instanceof NotFoundError || e instanceof NotReviewableError || e instanceof ReasonRequiredError;
}

export async function approveApplicationAction(formData: FormData) {
  const admin = await requireAdmin();
  try {
    await approveApplication(admin.id, String(formData.get("id")));
  } catch (e) {
    if (isKnown(e)) redirect(`/applications?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/applications");
  redirect("/applications?ok=approved");
}

export async function rejectApplicationAction(formData: FormData) {
  const admin = await requireAdmin();
  try {
    await rejectApplication(admin.id, String(formData.get("id")), String(formData.get("reason") ?? ""));
  } catch (e) {
    if (isKnown(e)) redirect(`/applications?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/applications");
  redirect("/applications?ok=rejected");
}
