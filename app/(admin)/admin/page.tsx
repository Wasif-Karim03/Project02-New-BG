import Link from "next/link";
import { auth } from "@/auth";
import { getAdminOverview } from "@/lib/services/admin-overview";
import { listAuditLog } from "@/lib/services/audit-log";
import { Badge, Card, EmptyState, PageHeader, StatCard, page } from "../_components/ui";

const usd = (m: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(m / 100);

function ActionCard({ href, label, count }: { href: string; label: string; count: number }) {
  const hot = count > 0;
  return (
    <Link href={href} className={`flex items-center justify-between rounded-xl border p-4 shadow-sm transition-colors ${hot ? "border-amber-300 bg-amber-50 hover:bg-amber-100/70" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <Badge tone={hot ? "amber" : "neutral"}>{count}</Badge>
    </Link>
  );
}

export default async function AdminDashboard() {
  const session = await auth();
  const [o, recent] = await Promise.all([getAdminOverview(), listAuditLog({ limit: 8 })]);
  const link = "rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50";

  return (
    <div className={page}>
      <PageHeader title="Dashboard" description={`Welcome back, ${session?.user?.name ?? session?.user?.email ?? "admin"}.`} />

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total raised" value={usd(o.totalRaised)} />
        <StatCard label="Donors" value={o.donorCount} />
        <StatCard label="Active students" value={o.activeStudents} />
        <StatCard label="Active pledges" value={o.activePledges} />
      </section>

      <h2 className="mt-9 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Needs attention</h2>
      <section className="grid gap-4 sm:grid-cols-3">
        <ActionCard href="/approvals" label="Pending approvals" count={o.pendingApprovals} />
        <ActionCard href="/applications" label="Pending applications" count={o.pendingApplications} />
        <ActionCard href="/donations-pending" label="Pending donations" count={o.pendingDonations} />
      </section>

      <h2 className="mt-9 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Manage</h2>
      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/roster" className={link}>Student roster</Link>
        <Link href="/users" className={link}>Staff &amp; users</Link>
        <Link href="/assignments" className={link}>Mentor assignments</Link>
        <Link href="/pledges" className={link}>Monthly pledges</Link>
        <Link href="/offline-donations" className={link}>Record offline gift</Link>
        <Link href="/sponsorships" className={link}>Active sponsorships</Link>
        <Link href="/reports" className={link}>Reports &amp; exports</Link>
        <Link href="/audit" className={link}>Audit log</Link>
        <Link href="/settings" className={link}>Settings</Link>
      </section>

      <div className="mt-9 mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recent activity</h2>
        <Link href="/audit" className="text-xs font-medium text-slate-500 hover:text-slate-700">View all →</Link>
      </div>
      <Card className="overflow-hidden">
        {recent.length === 0 ? (
          <EmptyState>No activity yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate"><code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-700">{e.action}</code> <span className="text-slate-500">{e.entityType}</span></span>
                <span className="shrink-0 text-xs text-slate-400">{e.actor} · {new Date(e.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
