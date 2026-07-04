import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listPendingQueue } from "@/lib/services/approvals";
import {
  approveStudentAction,
  approveUserAction,
  rejectStudentAction,
  rejectUserAction,
} from "./actions";

const approveBtn = "rounded bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800";
const rejectBtn = "rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800";
const reasonInput = "w-44 rounded border border-black/15 px-2 py-1 text-xs";

export default async function ApprovalsPage() {
  const session = await auth();
  // Server-side authorization on the actual resource — not just authentication.
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/login?callbackUrl=/approvals");
  }

  const { accounts, loginlessStudents } = await listPendingQueue();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Approval queue</h1>
      <p className="mt-1 text-sm text-black/60">
        Pending accounts and mentor-registered students. Approve to activate; rejecting requires a
        reason. Every decision is written to the audit log.
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50">
          Accounts ({accounts.length})
        </h2>
        {accounts.length === 0 ? (
          <p className="mt-2 text-sm text-black/40">No pending accounts.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/10 rounded-lg border border-black/10">
            {accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="text-sm">
                  <span className="font-medium">{a.name ?? "(no name)"}</span>{" "}
                  <span className="text-black/50">· {a.email}</span>{" "}
                  <span className="rounded bg-black/5 px-1.5 py-0.5 text-xs">{a.role}</span>
                </div>
                <div className="flex items-center gap-2">
                  <form action={approveUserAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className={approveBtn}>Approve</button>
                  </form>
                  <form action={rejectUserAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={a.id} />
                    <input name="reason" required placeholder="reason (required)" className={reasonInput} />
                    <button type="submit" className={rejectBtn}>Reject</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50">
          Mentor-registered students ({loginlessStudents.length})
        </h2>
        {loginlessStudents.length === 0 ? (
          <p className="mt-2 text-sm text-black/40">No pending students.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/10 rounded-lg border border-black/10">
            {loginlessStudents.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="text-sm">
                  <span className="font-medium">{s.firstName}</span>{" "}
                  <span className="text-black/40 text-xs">(login-less record)</span>
                </div>
                <div className="flex items-center gap-2">
                  <form action={approveStudentAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit" className={approveBtn}>Approve</button>
                  </form>
                  <form action={rejectStudentAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={s.id} />
                    <input name="reason" required placeholder="reason (required)" className={reasonInput} />
                    <button type="submit" className={rejectBtn}>Reject</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
