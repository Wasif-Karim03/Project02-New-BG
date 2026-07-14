"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import {
  confirmDonation,
  declineDonation,
  NotFoundError,
  NotPendingError,
  ReasonRequiredError,
} from "@/lib/services/donation-claims";

// Known claim errors → friendly redirect back to the queue, not the error screen.
function isKnown(e: unknown): e is Error {
  return e instanceof NotFoundError || e instanceof NotPendingError || e instanceof ReasonRequiredError;
}

export async function confirmDonationAction(formData: FormData) {
  const admin = await requireAdmin();
  try {
    await confirmDonation(admin.id, String(formData.get("id")));
  } catch (e) {
    if (isKnown(e)) redirect(`/donations-pending?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/donations-pending");
  redirect("/donations-pending?ok=confirmed");
}

export async function declineDonationAction(formData: FormData) {
  const admin = await requireAdmin();
  try {
    await declineDonation(admin.id, String(formData.get("id")), String(formData.get("reason") ?? ""));
  } catch (e) {
    if (isKnown(e)) redirect(`/donations-pending?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/donations-pending");
  redirect("/donations-pending?ok=declined");
}
