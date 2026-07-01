import { handleStripeWebhook } from "@/lib/webhooks/stripe-handler";

// Stripe needs the RAW body to verify the signature — read it as text, never parse.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  const result = await handleStripeWebhook(rawBody, signature);
  return new Response(result.message, { status: result.status });
}
