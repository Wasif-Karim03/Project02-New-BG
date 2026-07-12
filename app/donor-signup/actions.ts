"use server";

import { redirect } from "next/navigation";
import { clearApplicantCookie, getApplicantUserId, setApplicantCookie } from "@/lib/apply-session";
import { checkRateLimit } from "@/lib/rate-limit";
import { EmailInUseError } from "@/lib/services/accounts";
import { DonorCodeInvalidError, registerDonorWithVerification, resendDonorCode, verifyDonorEmail } from "@/lib/services/donor-accounts";

export async function createDonorAccountAction(formData: FormData) {
  if (!(await checkRateLimit("donor-signup", { max: 5, windowMs: 15 * 60 * 1000 }))) {
    redirect("/donor-signup?error=" + encodeURIComponent("Too many attempts. Please try again later."));
  }
  const name = String(formData.get("name") || "");
  const phone = String(formData.get("phone") || "") || undefined;
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  if (password.length < 10) redirect("/donor-signup?error=" + encodeURIComponent("Password must be at least 10 characters."));

  let devCode: string | undefined;
  try {
    const res = await registerDonorWithVerification({ name, phone, email, password });
    await setApplicantCookie(res.userId);
    devCode = res.devCode;
  } catch (e) {
    if (e instanceof EmailInUseError) redirect("/donor-signup?error=" + encodeURIComponent("That email already has an account. Sign in instead."));
    throw e;
  }
  redirect(devCode ? `/donor-signup/verify?dev=${devCode}` : "/donor-signup/verify");
}

export async function verifyDonorAction(formData: FormData) {
  const userId = await getApplicantUserId();
  if (!userId) redirect("/donor-signup");
  try {
    await verifyDonorEmail(userId, String(formData.get("code") || ""));
  } catch (e) {
    if (e instanceof DonorCodeInvalidError) redirect("/donor-signup/verify?error=" + encodeURIComponent(e.message));
    throw e;
  }
  await clearApplicantCookie();
  redirect("/login?verified=1&callbackUrl=/give");
}

export async function resendDonorAction() {
  const userId = await getApplicantUserId();
  if (!userId) redirect("/donor-signup");
  const { devCode } = await resendDonorCode(userId);
  redirect(devCode ? `/donor-signup/verify?resent=1&dev=${devCode}` : "/donor-signup/verify?resent=1");
}
