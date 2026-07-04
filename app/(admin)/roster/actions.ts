"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import {
  RegistrationIdTakenError, deactivateAllStudents, setStudentFlags, updateStudentRecord, upsertStudentSession,
} from "@/lib/services/student-record";
import { studentRecordSchema, studentSessionSchema } from "@/lib/validation/student-record";

const dollarsToCents = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return v == null || v === "" || !Number.isFinite(n) ? undefined : Math.round(n * 100);
};
const str = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() !== "" ? v : undefined);

export async function updateRecordAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("studentId"));
  const parsed = studentRecordSchema.safeParse({
    registrationId: str(formData.get("registrationId")),
    purpose: str(formData.get("purpose")),
    careerGoal: str(formData.get("careerGoal")),
    fatherProfession: str(formData.get("fatherProfession")),
    motherProfession: str(formData.get("motherProfession")),
    familyIncome: str(formData.get("familyIncome")),
    addrDistrict: str(formData.get("addrDistrict")),
    guardianName: str(formData.get("guardianName")),
    guardianMobile: str(formData.get("guardianMobile")),
    guardianAddress: str(formData.get("guardianAddress")),
    tutorName: str(formData.get("tutorName")),
    tutorPhone: str(formData.get("tutorPhone")),
    paymentType: str(formData.get("paymentType")),
    requireAmount: dollarsToCents(formData.get("requireAmount")),
    minDonateAmount: dollarsToCents(formData.get("minDonateAmount")),
    perInstallment: dollarsToCents(formData.get("perInstallment")),
    targetType: str(formData.get("targetType")),
    targetPeriod: str(formData.get("targetPeriod")),
  });
  if (!parsed.success) redirect(`/roster/${id}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  try {
    await updateStudentRecord(admin.id, id, parsed.data);
  } catch (e) {
    if (e instanceof RegistrationIdTakenError) redirect(`/roster/${id}?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect(`/roster/${id}?ok=1`);
}

export async function upsertSessionAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("studentId"));
  const parsed = studentSessionSchema.safeParse({
    sessionId: str(formData.get("sessionId")),
    institutionName: str(formData.get("institutionName")),
    grade: str(formData.get("grade")),
    roll: str(formData.get("roll")),
    formerRoll: str(formData.get("formerRoll")),
    totalStudent: str(formData.get("totalStudent")),
  });
  if (!parsed.success) redirect(`/roster/${id}?error=${encodeURIComponent("Pick an academic session")}`);
  await upsertStudentSession(admin.id, id, parsed.data);
  revalidatePath(`/roster/${id}`);
}

export async function setFlagsAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("studentId"));
  await setStudentFlags(admin.id, id, {
    verified: formData.get("verified") != null ? formData.get("verified") === "true" : undefined,
    active: formData.get("active") != null ? formData.get("active") === "true" : undefined,
  });
  revalidatePath(`/roster/${id}`);
}

export async function deactivateAllAction() {
  const admin = await requireAdmin();
  await deactivateAllStudents(admin.id);
  revalidatePath("/roster");
}
