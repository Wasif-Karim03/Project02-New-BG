import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listPendingQueue } from "@/lib/services/approvals";
import {
  approveStudentAction,
  approveUserAction,
  rejectStudentAction,
  rejectUserAction,
} from "./actions";
import { page, PageHeader, Card, Badge, EmptyState, btnPrimary, btnDanger, input } from "../_components/ui";

export default async function ApprovalsPage() {
  const session = await auth();
  // Server-side authorization on the actual resource — not just authentication.
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/login?callbackUrl=/approvals");
  }

  const { accounts, loginlessStudents } = await listPendingQueue();

  return (
    <div className={page}>
      <PageHeader
        title="Approval queue"
        description="Pending accounts and mentor-registered students. Approve to activate; rejecting requires a reason. Every decision is written to the audit log."
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Accounts ({accounts.length})
        </h2>
        {accounts.length === 0 ? (
          <EmptyState>No pending accounts.</EmptyState>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-slate-100">
              {accounts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="text-sm">
                    <span className="font-medium text-slate-900">{a.name ?? "(no name)"}</span>{" "}
                    <span className="text-slate-500">· {a.email}</span>{" "}
                    <Badge tone="neutral">{a.role}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={approveUserAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className={btnPrimary}>Approve</button>
                    </form>
                    <form action={rejectUserAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={a.id} />
                      <input name="reason" required placeholder="reason (required)" className={`${input} w-44`} />
                      <button type="submit" className={btnDanger}>Reject</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Mentor-registered students ({loginlessStudents.length})
        </h2>
        {loginlessStudents.length === 0 ? (
          <EmptyState>No pending students.</EmptyState>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-slate-100">
              {loginlessStudents.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="text-sm">
                    <span className="font-medium text-slate-900">{s.firstName}</span>{" "}
                    <span className="text-xs text-slate-500">(login-less record)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={approveStudentAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className={btnPrimary}>Approve</button>
                    </form>
                    <form action={rejectStudentAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={s.id} />
                      <input name="reason" required placeholder="reason (required)" className={`${input} w-44`} />
                      <button type="submit" className={btnDanger}>Reject</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
