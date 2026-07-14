"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { verifyCredentials } from "@/lib/auth/credentials";
import { signInBlockReason } from "@/lib/auth/signin-policy";
import { checkRateLimit } from "@/lib/rate-limit";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const callbackUrl = String(formData.get("callbackUrl") || "/") || "/";
  const cb = `&callbackUrl=${encodeURIComponent(callbackUrl)}`;
  // Throttle brute-force attempts per IP.
  if (!(await checkRateLimit("login", { max: 10, windowMs: 60 * 1000 }))) {
    redirect(`/login?error=rate${cb}`);
  }
  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
  } catch (e) {
    // On success signIn throws NEXT_REDIRECT — rethrow so the redirect happens.
    if (!(e instanceof AuthError)) throw e;
    // authorize() returns null both for bad credentials AND for a valid login on
    // a non-active account, so the two look identical here. Re-check the password
    // ONLY to tell them apart: if it's actually correct but the account isn't
    // sign-in-allowed, show a specific status message ("awaiting review" /
    // "not approved"). A wrong password never reveals account existence.
    const user = await verifyCredentials(email, password);
    if (user) {
      const reason = signInBlockReason(user.status);
      if (reason) redirect(`/login?status=${reason}${cb}`);
    }
    redirect(`/login?error=1${cb}`);
  }
}
