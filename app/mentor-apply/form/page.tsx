import { redirect } from "next/navigation";
import { getApplicantUserId } from "@/lib/apply-session";
import { getOrCreateMentorDraft } from "@/lib/services/mentor-applications";
import { MENTOR_FIELDS } from "@/lib/validation/mentor-application";
import { saveMentorSubmitAction } from "../actions";

type SearchParams = Promise<{ error?: string }>;
const field = "mt-1.5 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40";
const lbl = "block text-sm font-medium text-ink-2";

export default async function MentorApplyFormPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await getApplicantUserId();
  if (!userId) redirect("/mentor-apply");
  const { error } = await searchParams;
  const draft = await getOrCreateMentorDraft(userId);
  const v = (k: string) => (draft as Record<string, unknown>)[k] as string | undefined;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2-text">Bridging Generations</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Mentor application</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">Tell us about yourself. Required: name, phone, profession, country, and why you want to mentor.</p>
      {error && <div className="mt-6 rounded-xl border border-accent-2/30 bg-accent-2/10 px-4 py-3 text-sm text-accent-2-text">{decodeURIComponent(error)}</div>}

      <form action={saveMentorSubmitAction} className="mt-8">
        <div className="grid gap-5 rounded-2xl border border-hairline bg-ground-2 p-6 shadow-sm sm:grid-cols-2">
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
          <label className={`${lbl} sm:col-span-2`}>
            Profile picture *
            {/* Required, unless one was already uploaded on a prior save. The server
                also enforces photoUrl via MENTOR_REQUIRED_TO_SUBMIT. */}
            <input
              type="file"
              name="photo"
              accept="image/*"
              required={!v("photoUrl")}
              className="mt-1.5 block w-full text-sm text-ink-2 file:mr-3 file:rounded-full file:border-0 file:bg-accent-2 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-accent-2-hover"
            />
            {v("photoUrl") ? (
              <span className="mt-1 block text-xs text-emerald-700">✓ uploaded — choose a new file to replace</span>
            ) : null}
          </label>
          <label className="flex items-center gap-3 text-sm text-ink-2 sm:col-span-2">
            <input type="checkbox" name="agreedTerms" defaultChecked={draft.agreedTerms} className="h-4 w-4 rounded border-hairline text-accent-2 focus:ring-accent/40" /> I confirm the information is accurate and agree to be contacted.
          </label>
        </div>
        <div className="mt-6">
          <button type="submit" className="rounded-full bg-accent-2 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-2-hover">Submit application</button>
        </div>
      </form>
    </main>
  );
}
