"use server";

import { redirect } from "next/navigation";
import { requireActiveMentor } from "@/lib/auth/guards";
import { AccessDeniedError } from "@/lib/auth/mentor-access";
import { submitMentorEvaluation } from "@/lib/services/mentor-evaluation";
import { EVALUATION_SUBJECTS, STUDY_HABIT_QUESTIONS, mentorEvaluationSchema } from "@/lib/validation/mentor-evaluation";

export async function submitEvaluationAction(formData: FormData) {
  const mentor = await requireActiveMentor();
  const studentId = String(formData.get("studentId"));
  const base = `/my-students/${studentId}/evaluate`;

  // Rebuild the structured lists from the per-item fields. Every question/subject
  // is stored (with the verbatim question text) so the evaluation is self-contained.
  const studyHabits = STUDY_HABIT_QUESTIONS.map((question, i) => ({
    question,
    answer: ((formData.get(`sh.${i}.answer`) as string) || null) as "yes" | "no" | null,
    comment: String(formData.get(`sh.${i}.comment`) || "").trim() || undefined,
  }));
  const subjectNotes = EVALUATION_SUBJECTS.map((subject) => ({
    subject,
    note: String(formData.get(`subj.${subject}`) || "").trim() || undefined,
  }));

  const parsed = mentorEvaluationSchema.safeParse({
    date: formData.get("date") || undefined,
    studyHabits,
    participation: formData.get("participation") || undefined,
    parentCommunication: formData.get("parentCommunication") || undefined,
    progressGrade: formData.get("progressGrade") || undefined,
    subjectNotes,
    overallEvaluation: formData.get("overallEvaluation") || undefined,
  });
  if (!parsed.success) redirect(`${base}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);

  // The guard lives in the service: an unassigned mentor is denied with
  // AccessDeniedError before any write. The route cannot bypass it.
  try {
    await submitMentorEvaluation(mentor.id, studentId, parsed.data);
  } catch (e) {
    if (e instanceof AccessDeniedError) redirect(`/my-students?error=${encodeURIComponent("You are not assigned to this student.")}`);
    throw e;
  }
  redirect(`${base}?ok=1`);
}
