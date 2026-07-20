import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { AccessDeniedError } from "@/lib/auth/mentor-access";
import { getEvaluationContext, listMentorEvaluations } from "@/lib/services/mentor-evaluation";
import {
  EVALUATION_SUBJECTS, PROGRESS_GRADE_BANDS, SIX_POINT_LABELS, STUDY_HABIT_QUESTIONS,
  progressGrade, sixPointRating,
} from "@/lib/validation/mentor-evaluation";
import { submitEvaluationAction } from "./actions";

const field = "mt-1 w-full rounded border border-black/15 px-2 py-1 text-sm";
const label = "block text-xs font-medium text-black/60";
type SearchParams = Promise<{ ok?: string; error?: string }>;

const RatingSelect = ({ name }: { name: string }) => (
  <select name={name} defaultValue="" className={field}>
    <option value="">—</option>
    {sixPointRating.options.map((r) => <option key={r} value={r}>{SIX_POINT_LABELS[r]}</option>)}
  </select>
);

export default async function EvaluatePage({ params, searchParams }: { params: Promise<{ studentId: string }>; searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "MENTOR" || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/my-students");
  const { studentId } = await params;
  const { ok, error } = await searchParams;

  // The identity header + past list both go through the frozen guard. An unassigned
  // mentor is denied here (AccessDeniedError) → bounce back to the roster.
  let header: Awaited<ReturnType<typeof getEvaluationContext>>;
  let past: Awaited<ReturnType<typeof listMentorEvaluations>>;
  try {
    [header, past] = await Promise.all([
      getEvaluationContext(session.user.id, studentId),
      listMentorEvaluations(session.user.id, studentId),
    ]);
  } catch (e) {
    if (e instanceof AccessDeniedError) redirect("/my-students?error=" + encodeURIComponent("You are not assigned to this student."));
    throw e;
  }

  const headerRows: [string, string | null][] = [
    ["Student", header.studentName], ["Mentor", header.mentorName], ["Private teacher", header.privateTeacher],
    ["Class / grade", header.classGrade], ["Current roll", header.currentRoll], ["Former roll", header.formerRoll],
    ["Institution", header.institution],
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/my-students" className="text-xs text-black/50 hover:underline">← My students</Link>
      <h1 className="mt-2 text-2xl font-bold">Monthly evaluation</h1>
      <p className="mt-1 text-sm text-black/60">Access-checked server-side (you must be assigned to this student for the current session) and audited.</p>

      {ok && <div className="mt-4 rounded border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-900">Evaluation saved.</div>}
      {error && <div className="mt-4 rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">{decodeURIComponent(error)}</div>}

      {/* Identity header — auto-filled from the student record, not re-typed. */}
      <section className="mt-6 rounded-lg border border-black/10 bg-black/[0.02] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50">Identity (auto-filled)</h2>
        <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
          {headerRows.map(([k, v]) => (
            <div key={k} className="flex gap-2 py-0.5 text-sm"><span className="w-28 shrink-0 text-black/50">{k}</span><span>{v ?? "—"}</span></div>
          ))}
        </dl>
      </section>

      <form action={submitEvaluationAction} className="mt-6 space-y-6">
        <input type="hidden" name="studentId" value={studentId} />
        <label className={label}>Date<input type="date" name="date" className={`${field} max-w-xs`} /></label>

        {/* Study-habit questions (Bangla, verbatim) — optional Yes/No + comment. */}
        <section className="rounded-lg border border-black/10 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50">অধ্যয়ন-অভ্যাস / Study habits</h2>
          <ol className="mt-3 space-y-4">
            {STUDY_HABIT_QUESTIONS.map((q, i) => (
              <li key={i} className="border-b border-black/5 pb-3 last:border-0">
                <p className="text-sm text-black/80">{i + 1}. {q}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-4">
                  <span className="flex items-center gap-3 text-sm">
                    <label className="flex items-center gap-1"><input type="radio" name={`sh.${i}.answer`} value="yes" /> হ্যাঁ / Yes</label>
                    <label className="flex items-center gap-1"><input type="radio" name={`sh.${i}.answer`} value="no" /> না / No</label>
                  </span>
                  <input name={`sh.${i}.comment`} placeholder="মন্তব্য / comment" className="flex-1 rounded border border-black/15 px-2 py-1 text-sm" />
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Two 6-point ratings + overall grade. */}
        <section className="grid gap-3 rounded-lg border border-black/10 p-5 sm:grid-cols-3">
          <label className={label}>Student participation<RatingSelect name="participation" /></label>
          <label className={label}>Parent communication<RatingSelect name="parentCommunication" /></label>
          <label className={label}>Overall progress grade
            <select name="progressGrade" defaultValue="" className={field}>
              <option value="">—</option>
              {progressGrade.options.map((g) => <option key={g} value={g}>{g} ({PROGRESS_GRADE_BANDS[g]})</option>)}
            </select>
          </label>
        </section>

        {/* Per-subject progress notes. */}
        <section className="rounded-lg border border-black/10 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50">Per-subject progress</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {EVALUATION_SUBJECTS.map((s) => (
              <label key={s} className={label}>{s}<input name={`subj.${s}`} className={field} /></label>
            ))}
          </div>
        </section>

        <label className="block text-xs font-medium text-black/60">Overall evaluation
          <textarea name="overallEvaluation" rows={4} className={field} />
        </label>

        <button type="submit" className="rounded bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-black/85">Submit evaluation</button>
      </form>

      {/* Past evaluations for this student (this session). */}
      <section className="mt-10">
        <h2 className="text-lg font-bold">Past evaluations ({past.length})</h2>
        {past.length === 0 ? <p className="mt-2 text-sm text-black/40">None yet.</p> : (
          <ul className="mt-3 space-y-2">
            {past.map((e) => (
              <li key={e.id} className="rounded border border-black/10 p-3 text-sm">
                <span className="font-medium">{new Date(e.date).toLocaleDateString()}</span>
                {e.progressGrade ? <span className="ml-2 rounded bg-black/5 px-1.5 py-0.5 text-xs">Grade {e.progressGrade}</span> : null}
                {e.overallEvaluation ? <p className="mt-1 text-black/70">{e.overallEvaluation}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
