"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { createOfflineDonation } from "@/lib/services/offline-donations";
import { offlineDonationSchema } from "@/lib/validation/offline-donations";

export async function createOfflineDonationAction(formData: FormData) {
  const admin = await requireAdmin();
  const dollars = Number(formData.get("amountDollars"));
  const parsed = offlineDonationSchema.safeParse({
    donorName: formData.get("donorName") || undefined,
    donorEmail: formData.get("donorEmail") || undefined,
    amount: Number.isFinite(dollars) ? Math.round(dollars * 100) : NaN,
    currency: "usd",
    source: formData.get("source"),
    designationType: formData.get("designationType"),
    studentId: formData.get("studentId") || undefined,
    projectId: formData.get("projectId") || undefined,
    occurredAt: formData.get("occurredAt"),
    isHistorical: formData.get("isHistorical") === "on",
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) redirect(`/offline-donations?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);

  await createOfflineDonation(admin.id, parsed.data);
  redirect("/offline-donations?ok=1");
}
