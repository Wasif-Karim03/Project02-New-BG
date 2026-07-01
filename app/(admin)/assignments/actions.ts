"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { assignStudentToMentor, unassignStudentFromMentor } from "@/lib/services/assignments";

async function currentSessionId() {
  const s = await prisma.academicSession.findFirst({ where: { isCurrent: true }, select: { id: true } });
  if (!s) throw new Error("No current academic session");
  return s.id;
}

export async function assignAction(formData: FormData) {
  const admin = await requireAdmin();
  const mentorId = String(formData.get("mentorId"));
  const studentId = String(formData.get("studentId"));
  if (!mentorId || !studentId) return;
  await assignStudentToMentor(admin.id, { mentorId, studentId, sessionId: await currentSessionId() });
  revalidatePath("/assignments");
}

export async function unassignAction(formData: FormData) {
  const admin = await requireAdmin();
  await unassignStudentFromMentor(admin.id, {
    mentorId: String(formData.get("mentorId")),
    studentId: String(formData.get("studentId")),
    sessionId: await currentSessionId(),
  });
  revalidatePath("/assignments");
}
