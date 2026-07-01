import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listAssignedStudents } from "@/lib/services/mentor";
import { createEvaluationAction } from "./actions";

const field = "mt-1 w-full rounded border border-black/15 px-2 py-1 text-sm";
const label = "block text-xs font-medium text-black/60";

export default async function MyStudentsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "MENTOR" || session.user.status !== "ACTIVE") {
    redirect("/api/auth/signin?callbackUrl=/my-students");
  }

  const students = await listAssignedStudents(session.user.id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">My students</h1>
      <p className="mt-1 text-sm text-black/60">
        Students assigned to you for the current session. Logging a contact/evaluation is
        access-checked server-side and audited.
      </p>

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
