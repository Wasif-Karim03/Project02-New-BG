"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import {
  RegistrationIdTakenError, deactivateAllStudents, deleteStudentSession, setStudentFlags, updateStudentRecord, upsertStudentSession,
} from "@/lib/services/student-record";
import { NotFoundError as StudentNotFoundError, deleteStudentCompletely } from "@/lib/services/deletion";
import { studentRecordSchema, studentSessionSchema } from "@/lib/validation/student-record";
import { UploadRejectedError, saveUpload } from "@/lib/storage";

async function uploadIfPresent(v: FormDataEntryValue | null): Promise<string | undefined> {
  if (v instanceof File && v.size > 0) {
    return `/api/files/${await saveUpload("student-sessions", v.type, Buffer.from(await v.arrayBuffer()))}`;
  }
  return undefined;
}
// Yes/No <select>: "true"/"false" → boolean, anything else → unchanged.
const boolField = (v: FormDataEntryValue | null): boolean | undefined =>
  v === "true" ? true : v === "false" ? false : undefined;

const dollarsToCents = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return v == null || v === "" || !Number.isFinite(n) ? undefined : Math.round(n * 100);
};
const str = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() !== "" ? v : undefined);
// School <select>: "" → null (clear link), a value → link, missing → unchanged.
const schoolIdField = (v: FormDataEntryValue | null): string | null | undefined =>
  typeof v !== "string" ? undefined : v === "" ? null : v;

export async function updateRecordAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("studentId"));
  const parsed = studentRecordSchema.safeParse({
    firstName: str(formData.get("firstName")),
    fullName: str(formData.get("fullName")),
    fatherName: str(formData.get("fatherName")),
    motherName: str(formData.get("motherName")),
    gender: str(formData.get("gender")),
    // Empty <select> value means "clear the school link" → null; a cuid links it.
    schoolId: schoolIdField(formData.get("schoolId")),
    bio: str(formData.get("bio")),
    registrationId: str(formData.get("registrationId")),
    purpose: str(formData.get("purpose")),
    careerGoal: str(formData.get("careerGoal")),
    dob: str(formData.get("dob")), // coerced to a Date by the schema; empty stays unchanged
    ethnicity: str(formData.get("ethnicity")),
    isOrphan: boolField(formData.get("isOrphan")),
    fatherProfession: str(formData.get("fatherProfession")),
    motherProfession: str(formData.get("motherProfession")),
    fatherPhone: str(formData.get("fatherPhone")),
    motherPhone: str(formData.get("motherPhone")),
    familyIncome: str(formData.get("familyIncome")),
    incomeSource: str(formData.get("incomeSource")),
    selectionNote: str(formData.get("selectionNote")),
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
  // A new result-sheet file (if any) is uploaded first; when absent, resultSheetUrl
  // stays undefined so the upsert keeps the row's existing sheet.
  let resultSheetUrl: string | undefined;
  try {
    resultSheetUrl = await uploadIfPresent(formData.get("resultSheet"));
  } catch (e) {
    if (e instanceof UploadRejectedError) redirect(`/roster/${id}?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  const parsed = studentSessionSchema.safeParse({
    sessionId: str(formData.get("sessionId")),
    institutionName: str(formData.get("institutionName")),
    grade: str(formData.get("grade")),
    roll: str(formData.get("roll")),
    formerRoll: str(formData.get("formerRoll")),
    totalStudent: str(formData.get("totalStudent")),
    degreeLevel: str(formData.get("degreeLevel")),
    resultSheetUrl,
  });
  if (!parsed.success) redirect(`/roster/${id}?error=${encodeURIComponent("Pick an academic session")}`);
  await upsertStudentSession(admin.id, id, parsed.data);
  revalidatePath(`/roster/${id}`);
}

export async function deleteSessionAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("studentId"));
  const sessionId = String(formData.get("sessionId"));
  await deleteStudentSession(admin.id, id, sessionId);
  revalidatePath(`/roster/${id}`);
}

export async function setFlagsAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("studentId"));
  await setStudentFlags(admin.id, id, {
    verified: formData.get("verified") != null ? formData.get("verified") === "true" : undefined,
    active: formData.get("active") != null ? formData.get("active") === "true" : undefined,
    showOnWebsite: formData.get("showOnWebsite") != null ? formData.get("showOnWebsite") === "true" : undefined,
    showPhoto: formData.get("showPhoto") != null ? formData.get("showPhoto") === "true" : undefined,
  });
  revalidatePath(`/roster/${id}`);
}

export async function deactivateAllAction() {
  const admin = await requireAdmin();
  await deactivateAllStudents(admin.id);
  revalidatePath("/roster");
}

/**
 * Permanent, irreversible erasure of a student (and their login, if any).
 * Requires typing DELETE to confirm and a reason. Distinct from the soft
 * "active"/reject flows. Audited inside the service.
 */
export async function deleteStudentAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("studentId"));
  const confirm = String(formData.get("confirm") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (confirm !== "DELETE") redirect(`/roster/${id}?error=${encodeURIComponent("Type DELETE (all caps) to confirm permanent erasure.")}`);
  if (!reason) redirect(`/roster/${id}?error=${encodeURIComponent("A reason is required to permanently delete a student.")}`);
  try {
    await deleteStudentCompletely(admin.id, id, reason);
  } catch (e) {
    if (e instanceof StudentNotFoundError) redirect(`/roster/${id}?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/roster");
  redirect("/roster");
}
