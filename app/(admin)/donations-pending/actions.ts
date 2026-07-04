"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { confirmDonation, declineDonation } from "@/lib/services/donation-claims";

export async function confirmDonationAction(formData: FormData) {
  const admin = await requireAdmin();
  await confirmDonation(admin.id, String(formData.get("id")));
  revalidatePath("/donations-pending");
}

export async function declineDonationAction(formData: FormData) {
  const admin = await requireAdmin();
  await declineDonation(admin.id, String(formData.get("id")), String(formData.get("reason") ?? ""));
  revalidatePath("/donations-pending");
}
