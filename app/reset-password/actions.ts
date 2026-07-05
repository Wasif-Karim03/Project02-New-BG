"use server";

import { redirect } from "next/navigation";
import { checkRateLimit } from "@/lib/rate-limit";
import { InvalidTokenError, WeakPasswordError, resetPassword } from "@/lib/services/password-reset";

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  if (!(await checkRateLimit("reset-password", { max: 10, windowMs: 15 * 60 * 1000 }))) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=` + encodeURIComponent("Too many attempts. Please try again later."));
  }
  try {
    await resetPassword(token, password);
  } catch (e) {
    if (e instanceof WeakPasswordError) redirect(`/reset-password?token=${encodeURIComponent(token)}&error=` + encodeURIComponent(e.message));
    if (e instanceof InvalidTokenError) redirect("/reset-password?error=" + encodeURIComponent(e.message));
    throw e;
  }
  redirect("/login?reset=1");
}
