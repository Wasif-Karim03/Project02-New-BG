"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { cancelManualPledge, createManualPledge, recordPledgePayment } from "@/lib/services/pledges";
import { createPledgeSchema, recordPaymentSchema } from "@/lib/validation/pledges";

const toCents = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

export async function createPledgeAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = createPledgeSchema.safeParse({
    donorName: formData.get("donorName"),
    donorEmail: formData.get("donorEmail") || "",
    amount: toCents(formData.get("amountDollars")),
    interval: formData.get("interval") || "month",
    designationType: formData.get("designationType"),
    studentId: formData.get("studentId") || undefined,
    projectId: formData.get("projectId") || undefined,
  });
  if (!parsed.success) redirect("/pledges?error=" + encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input"));
  await createManualPledge(admin.id, parsed.data);
  revalidatePath("/pledges");
}

export async function recordPaymentAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const amt = formData.get("amountDollars");
  const parsed = recordPaymentSchema.safeParse({
    amount: amt ? toCents(amt) : undefined,
    method: formData.get("method") || "bkash",
    reference: formData.get("reference") || undefined,
  });
  if (!parsed.success) redirect("/pledges?error=invalid-payment");
  await recordPledgePayment(admin.id, id, parsed.data);
  revalidatePath("/pledges");
}

export async function cancelPledgeAction(formData: FormData) {
  const admin = await requireAdmin();
  await cancelManualPledge(admin.id, String(formData.get("id")));
  revalidatePath("/pledges");
}
