"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import {
  NotFoundError, ReasonRequiredError, StripeRowImmutableError, VoidedRowError,
  createOfflineDonation, postAdjustment, updateOfflineDonation, voidDonation,
} from "@/lib/services/offline-donations";
import { offlineDonationSchema } from "@/lib/validation/offline-donations";

const fail = (msg: string): never => redirect(`/offline-donations?error=${encodeURIComponent(msg)}`);
const done = (ok: string): never => redirect(`/offline-donations?ok=${ok}`);
const dollarsToCents = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return v == null || v === "" || !Number.isFinite(n) ? null : Math.round(n * 100);
};

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
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Invalid input");
  else {
    await createOfflineDonation(admin.id, parsed.data);
    done("created");
  }
}

/** Void any donation (reason required). Reduces its contribution to totals. */
export async function voidDonationAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("donationId"));
  const reason = String(formData.get("reason") ?? "");
  try {
    await voidDonation(admin.id, id, reason);
  } catch (e) {
    if (e instanceof ReasonRequiredError || e instanceof NotFoundError) fail(e.message);
    throw e;
  }
  done("voided");
}

/** Post a correcting adjustment row (amount may be negative) against a donation. */
export async function postAdjustmentAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("donationId"));
  const amount = dollarsToCents(formData.get("adjustDollars"));
  if (amount == null || amount === 0) fail("Enter a non-zero adjustment amount (negative to reduce).");
  else {
    try {
      await postAdjustment(admin.id, { correctionOfId: id, amount, note: String(formData.get("note") ?? "") || undefined });
    } catch (e) {
      if (e instanceof NotFoundError || e instanceof VoidedRowError) fail(e.message);
      throw e;
    }
    done("adjusted");
  }
}

/** Edit an offline row's amount and/or note. Stripe rows are refused. */
export async function updateOfflineDonationAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("donationId"));
  const amount = dollarsToCents(formData.get("amountDollars"));
  const noteRaw = formData.get("note");
  try {
    await updateOfflineDonation(admin.id, id, {
      amount: amount ?? undefined,
      note: typeof noteRaw === "string" ? noteRaw : undefined,
    });
  } catch (e) {
    if (e instanceof StripeRowImmutableError || e instanceof NotFoundError || e instanceof VoidedRowError) fail(e.message);
    throw e;
  }
  done("updated");
}
