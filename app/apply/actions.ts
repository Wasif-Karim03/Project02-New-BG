"use server";

import { redirect } from "next/navigation";
import { clearApplicantCookie, getApplicantUserId, setApplicantCookie } from "@/lib/apply-session";
import { verifyCredentials } from "@/lib/auth/credentials";
import { EmailInUseError } from "@/lib/services/accounts";
import { CodeInvalidError, MissingFieldsError, registerStudentApplicant, saveDraft, submitApplication, verifyEmail } from "@/lib/services/applications";
import { applicationDraftSchema } from "@/lib/validation/applications";

export async function createAccountAction(formData: FormData) {
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
  return applicationDraftSchema.parse(obj);
}

export async function saveSubmitAction(formData: FormData) {
  const userId = await getApplicantUserId();
  if (!userId) redirect("/apply");
  await saveDraft(userId!, draftFromForm(formData));
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
  await submitApplication(userId!);
  redirect("/apply/verify?resent=1");
}
