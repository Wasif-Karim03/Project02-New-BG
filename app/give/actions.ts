"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { submitDonationClaim } from "@/lib/services/donation-claims";
import { UploadRejectedError, saveUpload } from "@/lib/storage";
import { donationClaimSchema } from "@/lib/validation/donation-claim";

// Redirect back to wherever the form was submitted from (the context-locked
// /give/checkout keeps its ?student=/?project= this way), appending a status.
function backTo(formData: FormData, status: string): never {
  const base = String(formData.get("returnTo") || "/give/checkout");
  const safe = base.startsWith("/give") ? base : "/give/checkout"; // never redirect off the give flow
  redirect(`${safe}${safe.includes("?") ? "&" : "?"}${status}`);
}

export async function submitClaimAction(formData: FormData) {
  if (!(await checkRateLimit("give-claim", { max: 10, windowMs: 15 * 60 * 1000 }))) {
    backTo(formData, "error=" + encodeURIComponent("Too many submissions. Please try again later."));
  }

  // Validate the text fields FIRST so a bad form never leaves an orphaned tribute
  // blob in storage (upload only happens once the rest of the claim is known-good).
  const dollars = Number(formData.get("amountDollars"));
  const isAnonymous = formData.get("isAnonymous") === "on";
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
    isAnonymous,
  });
  if (!parsed.success) backTo(formData, "error=" + encodeURIComponent(parsed.error.issues[0]?.message ?? "Please check the form"));

  // Now (and only now) persist the optional tribute photo → object storage.
  let tributeImageUrl: string | undefined;
  const img = formData.get("tributeImage");
  if (img instanceof File && img.size > 0) {
    try {
      tributeImageUrl = `/api/files/${await saveUpload("tributes", img.type, Buffer.from(await img.arrayBuffer()))}`;
    } catch (e) {
      if (e instanceof UploadRejectedError) backTo(formData, "error=" + encodeURIComponent(e.message));
      throw e;
    }
  }

  const { donationId } = await submitDonationClaim({ ...parsed.data, tributeImageUrl });

  // Apply the public-wall opt-out to the resolved donor. (The shared claim service
  // resolves/creates the Donor internally, so we set the flag here on the donor the
  // gift landed on — whether newly created or reused.)
  if (isAnonymous) {
    const d = await prisma.donation.findUnique({ where: { id: donationId }, select: { donorId: true } });
    if (d) await prisma.donor.update({ where: { id: d.donorId }, data: { isAnonymous: true } });
  }

  backTo(formData, "submitted=1");
}
