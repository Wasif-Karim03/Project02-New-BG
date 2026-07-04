"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const callbackUrl = String(formData.get("callbackUrl") || "/") || "/";
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
