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

// A post-verify return target, restricted to the give flow (never an open redirect).
function safeNext(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/give") ? s : undefined;
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
  const next = safeNext(formData.get("next"));
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
  const q = new URLSearchParams();
  if (devCode) q.set("dev", devCode);
  if (next) q.set("next", next);
  const qs = q.toString();
  redirect(`/donor-signup/verify${qs ? `?${qs}` : ""}`);
}

export async function verifyDonorAction(formData: FormData) {
  const userId = await getApplicantUserId();
  if (!userId) redirect("/donor-signup");
  const next = safeNext(formData.get("next"));
  try {
    await verifyDonorEmail(userId, String(formData.get("code") || ""));
  } catch (e) {
    if (e instanceof DonorCodeInvalidError) {
      redirect(`/donor-signup/verify?error=${encodeURIComponent(e.message)}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
    }
    throw e;
  }
  await clearApplicantCookie();
  // Sign in, then land on the gift they started (or the give entry).
  redirect(`/login?verified=1&callbackUrl=${encodeURIComponent(next ?? "/give")}`);
}

export async function resendDonorAction(formData: FormData) {
  const userId = await getApplicantUserId();
  if (!userId) redirect("/donor-signup");
  const next = safeNext(formData.get("next"));
  const nextQs = next ? `&next=${encodeURIComponent(next)}` : "";
  if (!(await checkRateLimit("donor-resend", { max: 5, windowMs: 15 * 60 * 1000 }))) {
    redirect(`/donor-signup/verify?error=${encodeURIComponent("Too many code requests. Please wait a few minutes.")}${nextQs}`);
  }
  const { devCode } = await resendDonorCode(userId);
  redirect(`/donor-signup/verify?resent=1${devCode ? `&dev=${devCode}` : ""}${nextQs}`);
}
