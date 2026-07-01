import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assignAction, unassignAction } from "./actions";

const select = "mt-1 rounded border border-black/15 px-2 py-1.5 text-sm";

export default async function AssignmentsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/api/auth/signin?callbackUrl=/assignments");
  }

  const current = await prisma.academicSession.findFirst({ where: { isCurrent: true } });
  if (!current) {
    return <main className="mx-auto max-w-3xl px-6 py-12"><p className="text-sm text-red-700">No current academic session is set.</p></main>;
  }

  const [mentors, students, assignments] = await Promise.all([
    prisma.mentor.findMany({ where: { user: { status: "ACTIVE" } }, select: { id: true, user: { select: { name: true, email: true } } } }),
    prisma.student.findMany({ where: { status: "ACTIVE" }, select: { id: true, firstName: true, slug: true } }),
    prisma.mentorAssignment.findMany({
      where: { sessionId: current.id, active: true },
      select: { mentorId: true, studentId: true, mentor: { select: { user: { select: { name: true } } } }, student: { select: { firstName: true } } },
      orderBy: { assignedAt: "desc" },
    }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Mentor assignments</h1>
      <p className="mt-1 text-sm text-black/60">Session <strong>{current.label}</strong>. Assigning grants a mentor access to a student; unassigning cuts it immediately.</p>

      <form action={assignAction} className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4">
        <label className="text-xs font-medium text-black/60">Mentor
          <select name="mentorId" required className={select} defaultValue="">
            <option value="" disabled>Choose…</option>
            {mentors.map((m) => <option key={m.id} value={m.id}>{m.user?.name ?? m.user?.email}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-black/60">Student
          <select name="studentId" required className={select} defaultValue="">
            <option value="" disabled>Choose…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.firstName}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85">Assign</button>
      </form>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-black/50">Active assignments ({assignments.length})</h2>
      {assignments.length === 0 ? (
        <p className="mt-2 text-sm text-black/40">None yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-black/10 rounded-lg border border-black/10">
          {assignments.map((a) => (
            <li key={`${a.mentorId}-${a.studentId}`} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span><strong>{a.mentor.user?.name}</strong> → {a.student.firstName}</span>
              <form action={unassignAction}>
                <input type="hidden" name="mentorId" value={a.mentorId} />
                <input type="hidden" name="studentId" value={a.studentId} />
                <button type="submit" className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800">Unassign</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
