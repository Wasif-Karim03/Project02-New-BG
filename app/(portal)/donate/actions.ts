"use server";

import { redirect } from "next/navigation";
import { createCheckoutSession, createSubscriptionCheckout } from "@/lib/services/checkout";
import { checkoutInputSchema } from "@/lib/validation/donations";

/**
 * Start a Stripe Checkout — one-time OR monthly (mode=subscription). The donor's
 * chosen dollar amount is converted to minor units and validated (USD) server-side.
 * Requires a real STRIPE_SECRET_KEY; without one, Stripe rejects and we surface an error.
 */
export async function startCheckoutAction(formData: FormData) {
  const dollars = Number(formData.get("amountDollars"));
  const recurring = formData.get("recurring") === "on";
  const parsed = checkoutInputSchema.safeParse({
    amount: Number.isFinite(dollars) ? Math.round(dollars * 100) : NaN,
    currency: "usd",
    designationType: String(formData.get("designationType") || "GENERAL"),
    projectId: formData.get("projectId") || undefined,
    donorEmail: formData.get("donorEmail") || undefined,
  });
  if (!parsed.success) redirect(`/donate?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);

  let url: string | null = null;
  try {
    const origin = process.env.AUTH_URL || "http://localhost:3000";
    const urls = { successUrl: `${origin}/donate/thank-you?ref={CHECKOUT_SESSION_ID}`, cancelUrl: `${origin}/donate` };
    const session = recurring
      ? await createSubscriptionCheckout(parsed.data, urls, "month")
      : await createCheckoutSession(parsed.data, urls);
    url = session.url;
  } catch (e) {
    redirect(`/donate?error=${encodeURIComponent(`Checkout unavailable: ${(e as Error).message}`)}`);
  }
  if (url) redirect(url);
}
