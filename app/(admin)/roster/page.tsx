import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listStudentsForAdmin } from "@/lib/services/student-record";
import { deactivateAllAction } from "./actions";

export default async function RosterPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/login?callbackUrl=/roster");
  }
  const students = await listStudentsForAdmin();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Student roster</h1>
        <form action={deactivateAllAction}>
          <button type="submit" className="rounded border border-black/20 px-3 py-1.5 text-xs font-semibold hover:bg-black/5">Run year-end deactivation</button>
        </form>
      </div>
      <p className="mt-1 text-sm text-black/60">All student records. Click one to edit its backend record (registration, funding plan, per-session education, contacts, verified/active). Year-end deactivation flips every active student to inactive (runs automatically on Dec 30 once the cron is wired).</p>

      {students.length === 0 ? (
        <p className="mt-6 text-sm text-black/40">No student records yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-black/10 rounded-lg border border-black/10">
          {students.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <Link href={`/roster/${s.id}`} className="font-medium text-blue-700 underline">{s.firstName}</Link>
              <span className="flex items-center gap-2 text-xs">
                {s.registrationId && <span className="text-black/50">{s.registrationId}</span>}
                <span className="rounded bg-black/5 px-1.5 py-0.5">{s.status}</span>
                <span className={`rounded px-1.5 py-0.5 ${s.verified ? "bg-green-100 text-green-800" : "bg-black/5"}`}>{s.verified ? "verified" : "unverified"}</span>
                <span className={`rounded px-1.5 py-0.5 ${s.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{s.active ? "active" : "inactive"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
