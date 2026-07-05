import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listAuditActions, listAuditLog } from "@/lib/services/audit-log";

type SearchParams = Promise<{ action?: string }>;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/audit");
  const { action } = await searchParams;
  const [entries, actions] = await Promise.all([listAuditLog({ action: action || undefined }), listAuditActions()]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <p className="mt-1 text-sm text-black/60">Every consequential action — approvals, money, edits, access — with who and when. Most recent first (last 200).</p>

      <form method="get" className="mt-4 flex items-center gap-2 text-sm">
        <label className="text-black/60">Filter</label>
        <select name="action" defaultValue={action ?? ""} className="rounded border border-black/15 px-2 py-1">
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="rounded border border-black/20 px-3 py-1 font-semibold hover:bg-black/5">Apply</button>
      </form>

      <table className="mt-4 w-full text-sm">
        <thead><tr className="border-b border-black/15 text-left text-xs uppercase tracking-wide text-black/50"><th className="py-2">When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Reason</th></tr></thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-black/5 align-top">
              <td className="py-2 whitespace-nowrap text-black/60">{new Date(e.createdAt).toLocaleString()}</td>
              <td className="text-black/70">{e.actor}</td>
              <td><code className="rounded bg-black/5 px-1 py-0.5 text-xs">{e.action}</code></td>
              <td className="text-black/50">{e.entityType}{e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ""}</td>
              <td className="text-black/60">{e.reason ?? ""}</td>
            </tr>
          ))}
          {entries.length === 0 && <tr><td colSpan={5} className="py-3 text-black/40">No entries.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
