import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listAuditActions, listAuditLog } from "@/lib/services/audit-log";
import { page, PageHeader, Card, EmptyState, btnSecondary, input, label } from "../_components/ui";

type SearchParams = Promise<{ action?: string }>;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/audit");
  const { action } = await searchParams;
  const [entries, actions] = await Promise.all([listAuditLog({ action: action || undefined }), listAuditActions()]);

  return (
    <div className={page}>
      <PageHeader title="Audit log" description="Every consequential action — approvals, money, edits, access — with who and when. Most recent first (last 200)." />

      <form method="get" className="flex items-center gap-2 text-sm">
        <label className={label}>Filter</label>
        <select name="action" defaultValue={action ?? ""} className={input}>
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className={btnSecondary}>Apply</button>
      </form>

      <Card className="mt-4 overflow-hidden">
        {entries.length === 0 ? (
          <EmptyState>No entries.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-4 py-2">When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Reason</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-2 whitespace-nowrap text-slate-600">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="py-2 text-slate-600">{e.actor}</td>
                  <td className="py-2"><code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-700">{e.action}</code></td>
                  <td className="py-2 text-slate-500">{e.entityType}{e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ""}</td>
                  <td className="px-4 py-2 text-slate-600">{e.reason ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
