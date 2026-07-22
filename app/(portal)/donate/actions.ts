"use server";

import { redirect } from "next/navigation";
import { createCheckoutSession } from "@/lib/services/checkout";
import { checkoutInputSchema } from "@/lib/validation/donations";

/**
 * Start a ONE-TIME Stripe Checkout (mode=payment). Per the "one-time only" decision, no
 * public path may start a Stripe subscription — this action never calls
 * createSubscriptionCheckout. (The subscription service + webhook handlers remain intact
 * for the manual-pledge model; they're just not reachable from a public donor flow.)
 * The donor's dollar amount is converted to minor units and validated (USD) server-side.
 */
export async function startCheckoutAction(formData: FormData) {
  const dollars = Number(formData.get("amountDollars"));
  const parsed = checkoutInputSchema.safeParse({
    amount: Number.isFinite(dollars) ? Math.round(dollars * 100) : NaN,
    currency: "usd",
    designationType: String(formData.get("designationType") || "GENERAL"),
    studentId: formData.get("studentId") || undefined,
    projectId: formData.get("projectId") || undefined,
    donorName: formData.get("donorName") || undefined,
    donorEmail: formData.get("donorEmail") || undefined,
  });
  if (!parsed.success) redirect(`/donate?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);

  let url: string | null = null;
  try {
    const origin = process.env.AUTH_URL || "http://localhost:3000";
    const urls = { successUrl: `${origin}/donate/thank-you?ref={CHECKOUT_SESSION_ID}`, cancelUrl: `${origin}/donate` };
    url = (await createCheckoutSession(parsed.data, urls)).url;
  } catch (e) {
    redirect(`/donate?error=${encodeURIComponent(`Checkout unavailable: ${(e as Error).message}`)}`);
  }
  if (url) redirect(url);
}
