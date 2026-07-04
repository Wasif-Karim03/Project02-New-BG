"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requestCancelSubscription } from "@/lib/services/subscriptions";

export async function cancelSubscriptionAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/dashboard");

  try {
    await requestCancelSubscription(session.user.id, String(formData.get("subscriptionId")));
  } catch (e) {
    redirect(`/dashboard?error=${encodeURIComponent((e as Error).message)}`);
  }
  // The customer.subscription.deleted webhook flips status to CANCELED (source of truth).
  revalidatePath("/dashboard");
}
