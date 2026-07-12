import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listAssignedStudents } from "@/lib/services/mentor";
import { getMentorOwnProfile } from "@/lib/services/mentor-applications";
import { createEvaluationAction, registerStudentAction } from "./actions";

const PROFILE_FIELDS: { key: string; label: string }[] = [
  { key: "phone", label: "Phone" }, { key: "profession", label: "Profession" }, { key: "organization", label: "Organization" },
  { key: "city", label: "City" }, { key: "country", label: "Country" }, { key: "education", label: "Education" },
  { key: "languages", label: "Languages" }, { key: "availability", label: "Availability" },
];

const field = "mt-1 w-full rounded border border-black/15 px-2 py-1 text-sm";
const label = "block text-xs font-medium text-black/60";
type SearchParams = Promise<{ registered?: string; error?: string }>;

export default async function MyStudentsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "MENTOR" || session.user.status !== "ACTIVE") {
    redirect("/login?callbackUrl=/my-students");
  }
  const { registered, error } = await searchParams;

  const [students, profile] = await Promise.all([
    listAssignedStudents(session.user.id),
    getMentorOwnProfile(session.user.id),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Mentor dashboard</h1>
      <p className="mt-1 text-sm text-black/60">
        Your profile and the students assigned to you for the current session. Logging a
        contact/evaluation is access-checked server-side and audited.
      </p>

      {profile ? (
        <section className="mt-6 rounded-lg border border-black/10 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50">Your profile</h2>
          <p className="mt-0.5 text-xs text-black/40">The information you submitted when you applied (read-only).</p>
          <div className="mt-3 text-base font-semibold">{profile.fullName ?? session.user.name}</div>
          <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
            {PROFILE_FIELDS.map((f) => {
              const val = (profile as Record<string, unknown>)[f.key] as string | null;
              return val ? (
                <div key={f.key} className="flex gap-2 py-0.5 text-sm"><span className="w-24 shrink-0 text-black/50">{f.label}</span><span>{val}</span></div>
              ) : null;
            })}
          </dl>
          {profile.experience ? <p className="mt-2 text-sm text-black/70"><span className="text-black/50">Experience: </span>{profile.experience}</p> : null}
          {profile.motivation ? <p className="mt-1 text-sm text-black/70"><span className="text-black/50">Motivation: </span>{profile.motivation}</p> : null}
        </section>
      ) : null}

      <h2 className="mt-8 text-lg font-bold">My students</h2>
      {registered && <div className="mt-4 rounded border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-900">Student submitted to the admin approval queue.</div>}
      {error && <div className="mt-4 rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">{decodeURIComponent(error)}</div>}

      <form action={registerStudentAction} className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4">
        <label className={label}>Register a new student<input name="firstName" required placeholder="First name" className={field} /></label>
        <label className={label}>Full name (optional)<input name="fullName" className={field} /></label>
        <button type="submit" className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85">Submit for approval</button>
      </form>

      {students.length === 0 ? (
        <p className="mt-6 text-sm text-black/40">You have no assigned students this session.</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {students.map((s) => (
            <li key={s.id} className="rounded-lg border border-black/10 p-5">
              <div className="font-semibold">{s.firstName}</div>
              <form action={createEvaluationAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="studentId" value={s.id} />
                <label className={label}>Type<input name="evaluationType" placeholder="home visit, call…" className={field} /></label>
                <label className={label}>Contact person<input name="contactPerson" className={field} /></label>
                <label className={label}>
                  Contact by
                  <select name="contactBy" className={field} defaultValue="">
                    <option value="">—</option>
                    <option value="MOBILE">Mobile</option>
                    <option value="EMAIL">Email</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="IN_PERSON">In person</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className={label}>File reference<input name="fileUrl" placeholder="storage key / url" className={field} /></label>
                <label className="sm:col-span-2 block text-xs font-medium text-black/60">
                  Remarks<textarea name="remarks" rows={2} className={field} />
                </label>
                <label className="flex items-center gap-2 text-xs text-black/70">
                  <input type="checkbox" name="publishConsent" /> May surface publicly (publishConsent)
                </label>
                <div className="sm:col-span-2">
                  <button type="submit" className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85">
                    Log evaluation
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
