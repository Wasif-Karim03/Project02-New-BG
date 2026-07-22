"use server";

import { redirect } from "next/navigation";
import { checkRateLimit } from "@/lib/rate-limit";
import { createCheckoutSession } from "@/lib/services/checkout";
import { checkoutInputSchema } from "@/lib/validation/donations";

// Redirect back to the /give/checkout the form came from (keeps its ?student=/?project=),
// appending a status. Never redirect off the give flow.
function backTo(returnTo: string, status: string): never {
  const base = returnTo.startsWith("/give") ? returnTo : "/give/checkout";
  redirect(`${base}${base.includes("?") ? "&" : "?"}${status}`);
}

/**
 * Start a Stripe Checkout Session for a ONE-TIME public gift. Card data never touches
 * our servers (hosted Checkout). Amount / designation / tribute / note / anonymity are
 * validated server-side and passed in Checkout metadata; the LEDGER trusts only Stripe's
 * reported amount (recorded by the webhook), never these inputs. Guest-friendly — no
 * account required (Stripe collects the email on its hosted page). One-time only; this
 * flow never creates a subscription.
 */
export async function startGiveCheckoutAction(formData: FormData) {
  const returnTo = String(formData.get("returnTo") || "/give/checkout");
  if (!(await checkRateLimit("give-checkout", { max: 15, windowMs: 15 * 60 * 1000 }))) {
    backTo(returnTo, "error=" + encodeURIComponent("Too many attempts. Please try again in a few minutes."));
  }

  const dollars = Number(formData.get("amountDollars"));
  const parsed = checkoutInputSchema.safeParse({
    amount: Number.isFinite(dollars) ? Math.round(dollars * 100) : NaN,
    currency: "usd",
    designationType: String(formData.get("designationType") || "GENERAL"),
    studentId: formData.get("studentId") || undefined,
    projectId: formData.get("projectId") || undefined,
    donorEmail: formData.get("donorEmail") || undefined,
    isAnonymous: formData.get("isAnonymous") === "on",
    note: formData.get("note") || undefined,
    tributeType: formData.get("tributeType") || undefined,
    tributeName: formData.get("tributeName") || undefined,
    tributeMessage: formData.get("tributeMessage") || undefined,
    tributePublic: formData.get("tributePublic") === "on",
  });
  if (!parsed.success) backTo(returnTo, "error=" + encodeURIComponent(parsed.error.issues[0]?.message ?? "Please check the form"));

  let url: string | null = null;
  try {
    const origin = process.env.AUTH_URL || "http://localhost:3000";
    const back = returnTo.startsWith("/give") ? returnTo : "/give/checkout";
    const urls = {
      successUrl: `${origin}/give/thank-you?ref={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}${back}${back.includes("?") ? "&" : "?"}canceled=1`,
    };
    url = (await createCheckoutSession(parsed.data, urls)).url;
  } catch (e) {
    backTo(returnTo, "error=" + encodeURIComponent(`Payment is temporarily unavailable: ${(e as Error).message}`));
  }
  if (url) redirect(url); // → Stripe's hosted Checkout page
  backTo(returnTo, "error=" + encodeURIComponent("Could not start checkout. Please try again."));
}
