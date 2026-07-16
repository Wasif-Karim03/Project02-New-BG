"use server";

import { redirect } from "next/navigation";
import { clearApplicantCookie, getApplicantUserId, setApplicantCookie } from "@/lib/apply-session";
import { checkRateLimit } from "@/lib/rate-limit";
import { EmailInUseError } from "@/lib/services/accounts";
import { DonorCodeInvalidError, registerDonorWithVerification, resendDonorCode, verifyDonorEmail } from "@/lib/services/donor-accounts";
import { UploadRejectedError, saveUpload } from "@/lib/storage";

async function uploadAvatarIfPresent(v: FormDataEntryValue | null): Promise<string | undefined> {
  if (v instanceof File && v.size > 0) {
    return `/api/files/${await saveUpload("donors", v.type, Buffer.from(await v.arrayBuffer()))}`;
  }
  return undefined;
}

export async function createDonorAccountAction(formData: FormData) {
  if (!(await checkRateLimit("donor-signup", { max: 5, windowMs: 15 * 60 * 1000 }))) {
    redirect("/donor-signup?error=" + encodeURIComponent("Too many attempts. Please try again later."));
  }
  const name = String(formData.get("name") || "");
  const phone = String(formData.get("phone") || "") || undefined;
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  // "public" (show me on the Donors page → admin approval) vs "anonymous".
  const showOnWall = formData.get("visibility") === "public";
  if (password.length < 10) redirect("/donor-signup?error=" + encodeURIComponent("Password must be at least 10 characters."));

  let avatarUrl: string | undefined;
  try {
    avatarUrl = await uploadAvatarIfPresent(formData.get("avatar"));
  } catch (e) {
    if (e instanceof UploadRejectedError) redirect("/donor-signup?error=" + encodeURIComponent(e.message));
    throw e;
  }

  let devCode: string | undefined;
  try {
    const res = await registerDonorWithVerification({ name, phone, email, password, avatarUrl, showOnWall });
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
  if (!(await checkRateLimit("donor-resend", { max: 5, windowMs: 15 * 60 * 1000 }))) {
    redirect("/donor-signup/verify?error=" + encodeURIComponent("Too many code requests. Please wait a few minutes."));
  }
  const { devCode } = await resendDonorCode(userId);
  redirect(devCode ? `/donor-signup/verify?resent=1&dev=${devCode}` : "/donor-signup/verify?resent=1");
}
