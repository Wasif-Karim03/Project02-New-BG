"use server";

import { redirect } from "next/navigation";
import { checkRateLimit } from "@/lib/rate-limit";
import { EmailInUseError, registerDonor, registerMentor } from "@/lib/services/accounts";
import { donorSignupSchema, mentorSignupSchema } from "@/lib/validation/accounts";

function fail(role: string, message: string): never {
  redirect(`/signup?role=${role}&error=${encodeURIComponent(message)}`);
}

export async function signupDonorAction(formData: FormData) {
  if (!(await checkRateLimit("signup", { max: 5, windowMs: 15 * 60 * 1000 }))) {
    fail("donor", "Too many attempts. Please try again in a few minutes.");
  }
  const parsed = donorSignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("donor", parsed.error.issues[0]?.message ?? "Invalid input");
  let ok = false;
  try {
    await registerDonor(parsed.data);
    ok = true;
  } catch (e) {
    if (e instanceof EmailInUseError) fail("donor", e.message);
    throw e;
  }
  if (ok) redirect("/signup?status=pending&role=donor");
}

export async function signupMentorAction(formData: FormData) {
  if (!(await checkRateLimit("signup", { max: 5, windowMs: 15 * 60 * 1000 }))) {
    fail("mentor", "Too many attempts. Please try again in a few minutes.");
  }
  const parsed = mentorSignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("mentor", parsed.error.issues[0]?.message ?? "Invalid input");
  let ok = false;
  try {
    await registerMentor(parsed.data);
    ok = true;
  } catch (e) {
    if (e instanceof EmailInUseError) fail("mentor", e.message);
    throw e;
  }
  if (ok) redirect("/signup?status=pending&role=mentor");
}
