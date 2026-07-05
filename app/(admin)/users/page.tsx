import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listUsers } from "@/lib/services/user-management";
import { inviteStaffAction, setRoleAction, setStatusAction } from "./actions";
import { page, PageHeader, Card, Badge, btnPrimary, btnSecondary, btnDanger, input, label } from "../_components/ui";

type SearchParams = Promise<{ error?: string; invited?: string }>;
const ROLES = ["ADMIN", "MENTOR", "DONOR", "STUDENT"];

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/users");
  const { error, invited } = await searchParams;
  const me = session.user.id;
  const users = await listUsers();

  return (
    <div className={page}>
      <PageHeader title="Staff & users" description="Change roles, suspend/reactivate accounts, and invite staff. You can't demote or suspend yourself or the last admin. All actions are audited." />
      {invited && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Invitation sent — they&apos;ll get a set-password link by email (in dev, it prints to the server console).</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{decodeURIComponent(error)}</div>}

      <Card className="mt-6 p-4">
        <form action={inviteStaffAction} className="flex flex-wrap items-end gap-3">
          <label className={label}>Invite staff — email<input name="email" type="email" required className={`mt-1 w-64 ${input}`} /></label>
          <label className={label}>Role<select name="role" className={`mt-1 ${input}`} defaultValue="MENTOR"><option value="MENTOR">Mentor</option><option value="ADMIN">Admin</option></select></label>
          <button className={btnPrimary}>Send invite</button>
        </form>
      </Card>

      <Card className="mt-8 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-4 py-2">User</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="px-4 py-2 text-slate-900">{u.name ?? "—"}<div className="text-xs text-slate-500">{u.email}{u.id === me ? " (you)" : ""}</div></td>
                <td className="py-2">
                  <form action={setRoleAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={u.id} />
                    <select name="role" defaultValue={u.role} className={input}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
                    <button className={btnSecondary}>Set</button>
                  </form>
                </td>
                <td className="py-2"><Badge tone={u.status === "ACTIVE" ? "green" : u.status === "SUSPENDED" ? "red" : "neutral"}>{u.status}</Badge></td>
                <td className="py-2 pr-4 text-right">
                  <form action={setStatusAction} className="inline">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="status" value={u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} />
                    <button className={u.status === "ACTIVE" ? btnDanger : btnSecondary}>{u.status === "ACTIVE" ? "Suspend" : "Reactivate"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
