"use server";

import { redirect } from "next/navigation";
import { submitDonationClaim } from "@/lib/services/donation-claims";
import { donationClaimSchema } from "@/lib/validation/donation-claim";

export async function submitClaimAction(formData: FormData) {
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
  });
  if (!parsed.success) redirect("/give?error=" + encodeURIComponent(parsed.error.issues[0]?.message ?? "Please check the form"));
  await submitDonationClaim(parsed.data);
  redirect("/give?submitted=1");
}
