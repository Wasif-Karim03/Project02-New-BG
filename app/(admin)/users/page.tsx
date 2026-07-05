import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listUsers } from "@/lib/services/user-management";
import { inviteStaffAction, setRoleAction, setStatusAction } from "./actions";

type SearchParams = Promise<{ error?: string; invited?: string }>;
const ROLES = ["ADMIN", "MENTOR", "DONOR", "STUDENT"];

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/users");
  const { error, invited } = await searchParams;
  const me = session.user.id;
  const users = await listUsers();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold">Staff &amp; users</h1>
      <p className="mt-1 text-sm text-black/60">Change roles, suspend/reactivate accounts, and invite staff. You can&apos;t demote or suspend yourself or the last admin. All actions are audited.</p>
      {invited && <div className="mt-4 rounded border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-900">Invitation sent — they&apos;ll get a set-password link by email (in dev, it prints to the server console).</div>}
      {error && <div className="mt-4 rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">{decodeURIComponent(error)}</div>}

      <form action={inviteStaffAction} className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4">
        <label className="block text-xs font-medium text-black/60">Invite staff — email<input name="email" type="email" required className="mt-1 w-64 rounded border border-black/15 px-2 py-1.5 text-sm" /></label>
        <label className="block text-xs font-medium text-black/60">Role<select name="role" className="mt-1 rounded border border-black/15 px-2 py-1.5 text-sm" defaultValue="MENTOR"><option value="MENTOR">Mentor</option><option value="ADMIN">Admin</option></select></label>
        <button className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85">Send invite</button>
      </form>

      <table className="mt-8 w-full text-sm">
        <thead><tr className="border-b border-black/15 text-left text-xs uppercase tracking-wide text-black/50"><th className="py-2">User</th><th>Role</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-black/5">
              <td className="py-2">{u.name ?? "—"}<div className="text-xs text-black/40">{u.email}{u.id === me ? " (you)" : ""}</div></td>
              <td>
                <form action={setRoleAction} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={u.id} />
                  <select name="role" defaultValue={u.role} className="rounded border border-black/15 px-1.5 py-1 text-xs">{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
                  <button className="rounded border border-black/20 px-2 py-1 text-xs hover:bg-black/5">Set</button>
                </form>
              </td>
              <td><span className={`rounded px-1.5 py-0.5 text-xs ${u.status === "ACTIVE" ? "bg-green-100 text-green-900" : u.status === "SUSPENDED" ? "bg-red-100 text-red-900" : "bg-black/10 text-black/60"}`}>{u.status}</span></td>
              <td className="text-right">
                <form action={setStatusAction} className="inline">
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="status" value={u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} />
                  <button className="rounded border border-black/20 px-2 py-1 text-xs font-semibold hover:bg-black/5">{u.status === "ACTIVE" ? "Suspend" : "Reactivate"}</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
