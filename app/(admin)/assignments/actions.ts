"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { assignStudentToMentor, unassignStudentFromMentor } from "@/lib/services/assignments";

// Sentinel thrown when there is no current academic session — assignments are
// scoped per session, so nothing can be assigned/unassigned without one.
class NoCurrentSessionError extends Error {
  constructor() { super("No current academic session"); this.name = "NoCurrentSessionError"; }
}

async function currentSessionId() {
  const s = await prisma.academicSession.findFirst({ where: { isCurrent: true }, select: { id: true } });
  if (!s) throw new NoCurrentSessionError();
  return s.id;
}

const NO_SESSION_MSG = "Set a current academic session first (Settings → Academic sessions), then try again.";

export async function assignAction(formData: FormData) {
  const admin = await requireAdmin();
  const mentorId = String(formData.get("mentorId"));
  const studentId = String(formData.get("studentId"));
  if (!mentorId || !studentId) return;
  try {
    await assignStudentToMentor(admin.id, { mentorId, studentId, sessionId: await currentSessionId() });
  } catch (e) {
    if (e instanceof NoCurrentSessionError) redirect(`/assignments?error=${encodeURIComponent(NO_SESSION_MSG)}`);
    throw e;
  }
  revalidatePath("/assignments");
}

export async function unassignAction(formData: FormData) {
  const admin = await requireAdmin();
  try {
    await unassignStudentFromMentor(admin.id, {
      mentorId: String(formData.get("mentorId")),
      studentId: String(formData.get("studentId")),
      sessionId: await currentSessionId(),
    });
  } catch (e) {
    if (e instanceof NoCurrentSessionError) redirect(`/assignments?error=${encodeURIComponent(NO_SESSION_MSG)}`);
    throw e;
  }
  revalidatePath("/assignments");
}
