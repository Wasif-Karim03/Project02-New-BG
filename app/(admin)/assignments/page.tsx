import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assignAction, unassignAction } from "./actions";
import { page, PageHeader, Card, EmptyState, Notice, btnPrimary, btnDanger, input, label } from "../_components/ui";
import { ConfirmSubmit } from "../_components/ConfirmSubmit";

type SearchParams = Promise<{ error?: string; ok?: string }>;

export default async function AssignmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/login?callbackUrl=/assignments");
  }
  const { error, ok } = await searchParams;

  const current = await prisma.academicSession.findFirst({ where: { isCurrent: true } });
  if (!current) {
    return (
      <div className={page}>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">No current academic session is set.</div>
      </div>
    );
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
    <div className={page}>
      <PageHeader
        title="Mentor assignments"
        description={`Session ${current.label}. Assigning grants a mentor access to a student; unassigning cuts it immediately.`}
      />

      <Notice ok={ok} error={error} />

      <Card className="p-4">
        <form action={assignAction} className="flex flex-wrap items-end gap-3">
          <label className={label}>Mentor
            <select name="mentorId" required className={input} defaultValue="">
              <option value="" disabled>Choose…</option>
              {mentors.map((m) => <option key={m.id} value={m.id}>{m.user?.name ?? m.user?.email}</option>)}
            </select>
          </label>
          <label className={label}>Student
            <select name="studentId" required className={input} defaultValue="">
              <option value="" disabled>Choose…</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.firstName}</option>)}
            </select>
          </label>
          <button type="submit" className={btnPrimary}>Assign</button>
        </form>
      </Card>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-slate-900">Active assignments ({assignments.length})</h2>
      {assignments.length === 0 ? (
        <EmptyState>None yet.</EmptyState>
      ) : (
        <Card className="p-4">
          <ul>
            {assignments.map((a) => (
              <li key={`${a.mentorId}-${a.studentId}`} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm">
                <span className="text-slate-700"><strong className="text-slate-900">{a.mentor.user?.name}</strong> → {a.student.firstName}</span>
                <form action={unassignAction}>
                  <input type="hidden" name="mentorId" value={a.mentorId} />
                  <input type="hidden" name="studentId" value={a.studentId} />
                  <ConfirmSubmit className={btnDanger} message="Unassign this mentor from the student? They'll lose access to the record.">Unassign</ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
