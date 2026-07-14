"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import {
  approveMentorApplication,
  MentorNotReviewableError,
  ReasonRequiredError,
  rejectMentorApplication,
} from "@/lib/services/mentor-applications";

// Known review errors → friendly redirect back to the queue, not the error screen.
function isKnown(e: unknown): e is Error {
  return e instanceof MentorNotReviewableError || e instanceof ReasonRequiredError;
}

export async function approveMentorAction(formData: FormData) {
  const admin = await requireAdmin();
  try {
    await approveMentorApplication(admin.id, String(formData.get("id")));
  } catch (e) {
    if (isKnown(e)) redirect(`/mentor-applications?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/mentor-applications");
  redirect("/mentor-applications?ok=approved");
}

export async function rejectMentorAction(formData: FormData) {
  const admin = await requireAdmin();
  try {
    await rejectMentorApplication(admin.id, String(formData.get("id")), String(formData.get("reason") || ""));
  } catch (e) {
    if (isKnown(e)) redirect(`/mentor-applications?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/mentor-applications");
  redirect("/mentor-applications?ok=rejected");
}
