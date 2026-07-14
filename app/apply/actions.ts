"use server";

import { redirect } from "next/navigation";
import { clearApplicantCookie, getApplicantUserId, setApplicantCookie } from "@/lib/apply-session";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyCredentials } from "@/lib/auth/credentials";
import { EmailInUseError } from "@/lib/services/accounts";
import { CodeInvalidError, MissingFieldsError, registerStudentApplicant, saveDraft, submitApplication, verifyEmail } from "@/lib/services/applications";
import { UploadRejectedError, saveUpload } from "@/lib/storage";
import { applicationDraftSchema } from "@/lib/validation/applications";

async function uploadIfPresent(v: FormDataEntryValue | null): Promise<string | undefined> {
  if (v instanceof File && v.size > 0) {
    return `/api/files/${await saveUpload("applications", v.type, Buffer.from(await v.arrayBuffer()))}`;
  }
  return undefined;
}

export async function createAccountAction(formData: FormData) {
  if (!(await checkRateLimit("apply-signup", { max: 5, windowMs: 15 * 60 * 1000 }))) {
    redirect("/apply?error=" + encodeURIComponent("Too many attempts. Please try again later."));
  }
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "");
  if (password.length < 10) redirect("/apply?error=" + encodeURIComponent("Password must be at least 10 characters"));
  let userId: string;
  try {
    const reg = await registerStudentApplicant({ email, password, name });
    userId = reg.userId;
  } catch (e) {
    if (e instanceof EmailInUseError) redirect("/apply?error=" + encodeURIComponent("That email already has an account — use “Continue an application”."));
    throw e;
  }
  await setApplicantCookie(userId);
  redirect("/apply/form");
}

export async function loginContinueAction(formData: FormData) {
  const user = await verifyCredentials(String(formData.get("email") || ""), String(formData.get("password") || ""));
  if (!user) redirect("/apply?error=" + encodeURIComponent("Email or password is incorrect"));
  await setApplicantCookie(user.id);
  redirect("/apply/form");
}

function draftFromForm(formData: FormData) {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string" && v.trim() !== "") obj[k] = v;
  }
  obj.isOrphan = formData.get("isOrphan") === "on";
  obj.agreedTerms = formData.get("agreedTerms") === "on";
  obj.photoConsent = formData.get("photoConsent") === "on";
  return applicationDraftSchema.parse(obj);
}

export async function saveSubmitAction(formData: FormData) {
  const userId = await getApplicantUserId();
  if (!userId) redirect("/apply");
  const draft = draftFromForm(formData);
  try {
    draft.resultSheetUrl = (await uploadIfPresent(formData.get("resultSheet"))) ?? draft.resultSheetUrl;
    draft.photoUrl = (await uploadIfPresent(formData.get("photo"))) ?? draft.photoUrl;
  } catch (e) {
    if (e instanceof UploadRejectedError) redirect("/apply/form?error=" + encodeURIComponent(e.message));
    throw e;
  }
  try {
    await saveDraft(userId!, draft);
  } catch (e) {
    // saveDraft throws once the application is already EMAIL_VERIFIED/APPROVED
    // (a resubmit). Don't 500 — send them to the friendly "already submitted"
    // status page instead of re-rendering an editable form they can't save.
    if (e instanceof CodeInvalidError) redirect("/apply/done");
    throw e;
  }
  let devCode: string | undefined;
  try {
    ({ devCode } = await submitApplication(userId!));
  } catch (e) {
    if (e instanceof MissingFieldsError) redirect("/apply/form?error=" + encodeURIComponent(`Please fill: ${e.fields.join(", ")}`));
    throw e;
  }
  // devCode is only returned when there's no email provider (dev) — surface it on
  // the verify page so the flow is testable without console access. Never set in prod.
  redirect(devCode ? `/apply/verify?dev=${devCode}` : "/apply/verify");
}

export async function verifyCodeAction(formData: FormData) {
  const userId = await getApplicantUserId();
  if (!userId) redirect("/apply");
  try {
    await verifyEmail(userId!, String(formData.get("code") || ""));
  } catch (e) {
    if (e instanceof CodeInvalidError) redirect("/apply/verify?error=" + encodeURIComponent("That code is invalid or expired"));
    throw e;
  }
  await clearApplicantCookie();
  redirect("/apply/done");
}

export async function resendCodeAction() {
  const userId = await getApplicantUserId();
  if (!userId) redirect("/apply");
  if (!(await checkRateLimit("apply-resend", { max: 5, windowMs: 15 * 60 * 1000 }))) {
    redirect("/apply/verify?error=" + encodeURIComponent("Too many code requests. Please wait a few minutes."));
  }
  await submitApplication(userId!);
  redirect("/apply/verify?resent=1");
}
