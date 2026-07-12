import { redirect } from "next/navigation";
import { getApplicantUserId } from "@/lib/apply-session";
import { getOrCreateMentorDraft } from "@/lib/services/mentor-applications";
import { MENTOR_FIELDS } from "@/lib/validation/mentor-application";
import { saveMentorSubmitAction } from "../actions";

type SearchParams = Promise<{ error?: string }>;
const field = "mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm";
const lbl = "block text-xs font-medium text-black/60";

export default async function MentorApplyFormPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await getApplicantUserId();
  if (!userId) redirect("/mentor-apply");
  const { error } = await searchParams;
  const draft = await getOrCreateMentorDraft(userId);
  const v = (k: string) => (draft as Record<string, unknown>)[k] as string | undefined;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Mentor application</h1>
      <p className="mt-1 text-sm text-black/60">Tell us about yourself. Required: name, phone, profession, country, and why you want to mentor.</p>
      {error && <div className="mt-4 rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">{decodeURIComponent(error)}</div>}

      <form action={saveMentorSubmitAction} className="mt-6 grid gap-4 sm:grid-cols-2">
        {MENTOR_FIELDS.map((f) =>
          f.multiline ? (
            <label key={f.key} className={`${lbl} sm:col-span-2`}>
              {f.label}
              <textarea name={f.key} defaultValue={v(f.key)} rows={3} className={field} />
            </label>
          ) : (
            <label key={f.key} className={lbl}>
              {f.label}
              <input name={f.key} defaultValue={v(f.key)} className={field} />
            </label>
          ),
        )}
        <label className="flex items-center gap-2 text-sm text-black/70 sm:col-span-2">
          <input type="checkbox" name="agreedTerms" defaultChecked={draft.agreedTerms} /> I confirm the information is accurate and agree to be contacted.
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="rounded bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-black/85">Submit application</button>
        </div>
      </form>
    </main>
  );
}
