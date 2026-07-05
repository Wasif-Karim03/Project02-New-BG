"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const callbackUrl = String(formData.get("callbackUrl") || "/") || "/";
  // Throttle brute-force attempts per IP.
  if (!(await checkRateLimit("login", { max: 10, windowMs: 60 * 1000 }))) {
    redirect(`/login?error=rate&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
  } catch (e) {
    // A failed credential check throws AuthError → back to /login with an error.
    if (e instanceof AuthError) {
      redirect(`/login?error=1&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    // On success signIn throws NEXT_REDIRECT — rethrow so the redirect happens.
    throw e;
  }
}
