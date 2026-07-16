"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { DonorNotReviewableError, approveDonorWall, rejectDonorWall } from "@/lib/services/donor-wall";

export async function approveDonorWallAction(formData: FormData) {
  const admin = await requireAdmin();
  try {
    await approveDonorWall(admin.id, String(formData.get("id")));
  } catch (e) {
    if (e instanceof DonorNotReviewableError) redirect(`/donor-approvals?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/donor-approvals");
  redirect("/donor-approvals?ok=approved");
}

export async function rejectDonorWallAction(formData: FormData) {
  const admin = await requireAdmin();
  try {
    await rejectDonorWall(admin.id, String(formData.get("id")));
  } catch (e) {
    if (e instanceof DonorNotReviewableError) redirect(`/donor-approvals?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/donor-approvals");
  redirect("/donor-approvals?ok=rejected");
}
