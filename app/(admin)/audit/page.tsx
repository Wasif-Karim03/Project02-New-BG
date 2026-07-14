import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listAuditActions, listAuditLogPage } from "@/lib/services/audit-log";
import { page, PageHeader, Card, EmptyState, btnSecondary, input, label } from "../_components/ui";

type SearchParams = Promise<{ action?: string; from?: string; to?: string; page?: string }>;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/audit");
  const { action, from, to, page: pageParam } = await searchParams;
  const pageNum = Math.max(Number(pageParam) || 1, 1);
  const [result, actions] = await Promise.all([
    listAuditLogPage({ action: action || undefined, from: from || undefined, to: to || undefined, page: pageNum }),
    listAuditActions(),
  ]);
  const { entries, hasMore } = result;

  // Preserve filters across pagination links.
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (action) q.set("action", action);
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/audit?${s}` : "/audit";
  };

  return (
    <div className={page}>
      <PageHeader title="Audit log" description="Every consequential action — approvals, money, edits, access — with who and when. Most recent first. Use the date range and page controls to reach older entries." />

      <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
        <label className={label}>Action
          <select name="action" defaultValue={action ?? ""} className={`mt-1 ${input}`}>
            <option value="">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className={label}>From<input type="date" name="from" defaultValue={from ?? ""} className={`mt-1 ${input}`} /></label>
        <label className={label}>To<input type="date" name="to" defaultValue={to ?? ""} className={`mt-1 ${input}`} /></label>
        <button className={btnSecondary}>Apply</button>
        {(action || from || to) && <Link href="/audit" className={btnSecondary}>Clear</Link>}
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

      <div className="mt-4 flex items-center justify-between text-sm">
        {pageNum > 1 ? <Link href={pageHref(pageNum - 1)} className={btnSecondary}>← Newer</Link> : <span />}
        <span className="text-slate-400">Page {pageNum}</span>
        {hasMore ? <Link href={pageHref(pageNum + 1)} className={btnSecondary}>Older →</Link> : <span />}
      </div>
    </div>
  );
}
