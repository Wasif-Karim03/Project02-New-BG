import { z } from "zod";

// Verbatim Bangla study-habit questions from the owner's doc. Kept as DATA (not
// schema columns) so questions can be added/edited/reordered without a migration.
// Each is answered with an OPTIONAL Yes/No plus a free-text comment — most of these
// are open-ended, so the substantive answer goes in the comment and Yes/No is
// optional.
export const STUDY_HABIT_QUESTIONS: string[] = [
  "আপনি কি সকালে পড়াশোনা করেন?",
  "আপনি প্রতিদিন কখন পড়াশোনা শেষ করেন?",
  "আপনি প্রতিদিন কতক্ষণ পড়াশোনা করেন?",
  "আপনি কি কোনো রুটিন মেনে চলেন?",
  "আপনার দৈনন্দিন রুটিন সম্পর্কে আমাকে বলুন।",
  "আপনার বাবা-মা কি আপনাকে সময়মতো পড়াশোনা করার ব্যাপারে নির্দেশনা দেন?",
  "আপনি কি আপনার প্রাইভেট শিক্ষককে পছন্দ করেন?",
  "এখন স্কুলের কোন বিষয়টি আপনি সবচেয়ে উপভোগ করছ?",
  "সম্প্রতি কোন কাজের জন্য আপনি গর্ববোধ করেন?",
  "স্কুলের বাইরে আপনি কী করতে পছন্দ করেন?",
  "কোন বিষয়টি সবচেয়ে কঠিন লাগে, এবং কেন?",
  "কিছু বুঝতে না পারলে আপনি সাধারণত কী করেন?",
  "পড়াশোনার বাইরে আপনি কোন কাজগুলো উপভোগ করো?",
  "আপনার শেখার জন্য কোন পদ্ধতি সবচেয়ে ভালো — পড়া, অনুশীলন, নাকি কারও ব্যাখ্যা?",
  "কোন সমস্যা হলে আপনি সাধারণত কার সাথে কথা বলেন?",
  "পরীক্ষা বা অ্যাসাইনমেন্টের জন্য আপনি সাধারণত কীভাবে প্রস্তুতি নেন?",
  "আপনার মতে আপনার সবচেয়ে বড় দক্ষতা কী?",
  "এমন কোনো খেলা আছে কি যা আপনি খেলতে পছন্দ করেন?",
  "পড়াশোনার পাশাপাশি আপনি কী করতে পছন্দ করেন?",
  "আজ আপনাকে আর কোনোভাবে সাহায্য করতে পারি?",
];

// Fixed per-subject progress-note subjects from the owner's doc.
export const EVALUATION_SUBJECTS: string[] = [
  "Math", "English", "Accounting", "Science", "Physics", "Chemistry", "Biology", "Higher Math",
];

// Two 6-point ratings (Excellent → Very Poor), with display labels.
export const sixPointRating = z.enum(["EXCELLENT", "VERY_GOOD", "GOOD", "FAIR", "POOR", "VERY_POOR"]);
export const SIX_POINT_LABELS: Record<z.infer<typeof sixPointRating>, string> = {
  EXCELLENT: "Excellent", VERY_GOOD: "Very Good", GOOD: "Good", FAIR: "Fair", POOR: "Poor", VERY_POOR: "Very Poor",
};

// Overall progress grade. IMPORTANT: the owner's source doc listed the bands as
// A/B/D/C with C at 1.7–2.5 and D at 2.5–3.4 — an ordering/overlap error (D and C
// were swapped and overlapped). Corrected here and displayed A, B, C, D. Flagged
// for the owner to confirm.
export const progressGrade = z.enum(["A", "B", "C", "D"]);
export const PROGRESS_GRADE_BANDS: Record<z.infer<typeof progressGrade>, string> = {
  A: "4.5–5.0",
  B: "3.5–4.4",
  C: "2.5–3.4",
  D: "1.7–2.5",
};

const studyHabitAnswer = z.object({
  question: z.string().trim().max(500),
  answer: z.enum(["yes", "no"]).nullish(),
  comment: z.string().trim().max(2000).optional(),
});
const subjectNote = z.object({
  subject: z.string().trim().max(80),
  note: z.string().trim().max(2000).optional(),
});

// Mentor-entered fields only. The identity header (student/mentor/teacher names,
// class, rolls, institution) is auto-filled server-side from the student record —
// never re-typed — so it is NOT part of this input schema.
export const mentorEvaluationSchema = z.object({
  date: z.coerce.date().optional(),
  studyHabits: z.array(studyHabitAnswer).optional(),
  participation: sixPointRating.optional(),
  parentCommunication: sixPointRating.optional(),
  progressGrade: progressGrade.optional(),
  subjectNotes: z.array(subjectNote).optional(),
  overallEvaluation: z.string().trim().max(10000).optional(),
});

export type MentorEvaluationInput = z.infer<typeof mentorEvaluationSchema>;
export type StudyHabitAnswer = z.infer<typeof studyHabitAnswer>;
export type SubjectNote = z.infer<typeof subjectNote>;
