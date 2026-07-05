"use server";

import { redirect } from "next/navigation";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestPasswordReset } from "@/lib/services/password-reset";

export async function forgotPasswordAction(formData: FormData) {
  if (!(await checkRateLimit("forgot-password", { max: 5, windowMs: 15 * 60 * 1000 }))) {
    redirect("/forgot-password?error=" + encodeURIComponent("Too many requests. Please try again later."));
  }
  await requestPasswordReset(String(formData.get("email") || ""));
  // Always the same result (no account enumeration).
  redirect("/forgot-password?sent=1");
}
