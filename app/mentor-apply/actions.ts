"use server";

import { redirect } from "next/navigation";
import { clearApplicantCookie, getApplicantUserId, setApplicantCookie } from "@/lib/apply-session";
import { verifyCredentials } from "@/lib/auth/credentials";
import { checkRateLimit } from "@/lib/rate-limit";
import { EmailInUseError } from "@/lib/services/accounts";
import { MentorCodeInvalidError, MentorMissingFieldsError, registerMentorApplicant, saveMentorDraft, submitMentorApplication, verifyMentorEmail } from "@/lib/services/mentor-applications";
import { UploadRejectedError, saveUpload } from "@/lib/storage";
import { MENTOR_FIELDS, mentorApplicationDraftSchema } from "@/lib/validation/mentor-application";

async function uploadIfPresent(v: FormDataEntryValue | null): Promise<string | undefined> {
  if (v instanceof File && v.size > 0) {
    return `/api/files/${await saveUpload("mentors", v.type, Buffer.from(await v.arrayBuffer()))}`;
  }
  return undefined;
}

export async function createMentorAccountAction(formData: FormData) {
  if (!(await checkRateLimit("mentor-signup", { max: 5, windowMs: 15 * 60 * 1000 }))) {
    redirect("/mentor-apply?error=" + encodeURIComponent("Too many attempts. Please try again later."));
  }
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "");
  try {
    const { userId } = await registerMentorApplicant({ email, password, name });
    await setApplicantCookie(userId);
  } catch (e) {
    if (e instanceof EmailInUseError) redirect("/mentor-apply?error=" + encodeURIComponent("That email already has an account. Use Continue below."));
    throw e;
  }
  redirect("/mentor-apply/form");
}

export async function loginContinueAction(formData: FormData) {
  const user = await verifyCredentials(String(formData.get("email") || ""), String(formData.get("password") || ""));
  if (!user) redirect("/mentor-apply?error=" + encodeURIComponent("Email or password is incorrect."));
  await setApplicantCookie(user.id);
  redirect("/mentor-apply/form");
}

export async function saveMentorSubmitAction(formData: FormData) {
  const userId = await getApplicantUserId();
  if (!userId) redirect("/mentor-apply");
  const raw: Record<string, unknown> = {};
  for (const { key } of MENTOR_FIELDS) raw[key] = formData.get(key) || undefined;
  raw.agreedTerms = formData.get("agreedTerms") === "on";
  // Profile picture: upload if a new file was chosen; otherwise leave undefined so
  // a previously uploaded photo is preserved (Prisma skips undefined on update).
  try {
    raw.photoUrl = await uploadIfPresent(formData.get("photo"));
  } catch (e) {
    if (e instanceof UploadRejectedError) redirect("/mentor-apply/form?error=" + encodeURIComponent(e.message));
    throw e;
  }
  await saveMentorDraft(userId, mentorApplicationDraftSchema.parse(raw));

  let devCode: string | undefined;
  try {
    ({ devCode } = await submitMentorApplication(userId));
  } catch (e) {
    if (e instanceof MentorMissingFieldsError) redirect("/mentor-apply/form?error=" + encodeURIComponent(`Please fill: ${e.fields.join(", ")}`));
    throw e;
  }
  redirect(devCode ? `/mentor-apply/verify?dev=${devCode}` : "/mentor-apply/verify");
}

export async function verifyMentorCodeAction(formData: FormData) {
  const userId = await getApplicantUserId();
  if (!userId) redirect("/mentor-apply");
  try {
    await verifyMentorEmail(userId, String(formData.get("code") || ""));
  } catch (e) {
    if (e instanceof MentorCodeInvalidError) redirect("/mentor-apply/verify?error=" + encodeURIComponent(e.message));
    throw e;
  }
  await clearApplicantCookie();
  redirect("/mentor-apply/done");
}

export async function resendMentorCodeAction() {
  const userId = await getApplicantUserId();
  if (!userId) redirect("/mentor-apply");
  if (!(await checkRateLimit("mentor-resend", { max: 5, windowMs: 15 * 60 * 1000 }))) {
    redirect("/mentor-apply/verify?error=" + encodeURIComponent("Too many code requests. Please wait a few minutes."));
  }
  const { devCode } = await submitMentorApplication(userId);
  redirect(devCode ? `/mentor-apply/verify?resent=1&dev=${devCode}` : "/mentor-apply/verify?resent=1");
}
