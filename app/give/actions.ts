"use server";

import { redirect } from "next/navigation";
import { checkRateLimit } from "@/lib/rate-limit";
import { submitDonationClaim } from "@/lib/services/donation-claims";
import { UploadRejectedError, saveUpload } from "@/lib/storage";
import { donationClaimSchema } from "@/lib/validation/donation-claim";

export async function submitClaimAction(formData: FormData) {
  if (!(await checkRateLimit("give-claim", { max: 10, windowMs: 15 * 60 * 1000 }))) {
    redirect("/give?error=" + encodeURIComponent("Too many submissions. Please try again later."));
  }

  // Optional tribute photo → object storage.
  let tributeImageUrl: string | undefined;
  const img = formData.get("tributeImage");
  if (img instanceof File && img.size > 0) {
    try {
      tributeImageUrl = `/api/files/${await saveUpload("tributes", img.type, Buffer.from(await img.arrayBuffer()))}`;
    } catch (e) {
      if (e instanceof UploadRejectedError) redirect("/give?error=" + encodeURIComponent(e.message));
      throw e;
    }
  }

  const dollars = Number(formData.get("amountDollars"));
  const parsed = donationClaimSchema.safeParse({
    donorName: formData.get("donorName"),
    donorEmail: formData.get("donorEmail") || "",
    amount: Number.isFinite(dollars) ? Math.round(dollars * 100) : NaN,
    designationType: formData.get("designationType"),
    studentId: formData.get("studentId") || undefined,
    projectId: formData.get("projectId") || undefined,
    method: formData.get("method"),
    reference: formData.get("reference") || undefined,
    note: formData.get("note") || undefined,
    tributeType: formData.get("tributeType") || undefined,
    tributeName: formData.get("tributeName") || undefined,
    tributeMessage: formData.get("tributeMessage") || undefined,
    tributeImageUrl,
    tributePublic: formData.get("tributePublic") === "on",
  });
  if (!parsed.success) redirect("/give?error=" + encodeURIComponent(parsed.error.issues[0]?.message ?? "Please check the form"));
  await submitDonationClaim(parsed.data);
  redirect("/give?submitted=1");
}
