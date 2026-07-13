import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { page, PageHeader, Card, EmptyState, btnPrimary, input, label } from "../_components/ui";

const usd = (m: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(m / 100);

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/reports");

  const bySource = await prisma.donation.groupBy({
    by: ["source"],
    where: { status: "SUCCEEDED" },
    _sum: { amount: true, refundedAmount: true },
    _count: true,
  });

  return (
    <div className={page}>
      <PageHeader title="Reports & exports" description="Download CSVs for accounting, the 990 filing, and board reports." />

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">Money received by source</h2>
      <Card className="mt-2 max-w-md overflow-hidden">
        {bySource.length === 0 ? (
          <EmptyState>No successful donations yet.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {bySource.map((r) => (
                <tr key={r.source} className="border-b border-slate-100"><td className="px-4 py-2 text-slate-900">{r.source}</td><td className="py-2 text-right text-slate-500">{r._count} gifts</td><td className="px-4 py-2 text-right font-medium text-slate-900">{usd((r._sum.amount ?? 0) - (r._sum.refundedAmount ?? 0))}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-slate-500">Downloads</h2>
      <div className="mt-3 grid gap-3">
        <Card className="p-4">
          <form method="get" action="/api/admin/export/donations" className="flex flex-wrap items-end gap-3">
            <div className="text-sm font-medium text-slate-900">Donations</div>
            <label className={label}>From<input type="date" name="from" className={`mt-1 ${input}`} /></label>
            <label className={label}>To<input type="date" name="to" className={`mt-1 ${input}`} /></label>
            <button className={btnPrimary}>Download CSV</button>
            <span className="text-xs text-slate-500">Leave dates blank for all-time.</span>
          </form>
        </Card>
        <Card className="flex items-center justify-between p-4">
          <span className="text-sm font-medium text-slate-900">Donors (lifetime totals)</span>
          {/* API download route, not a Next page — a plain <a> is correct. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/admin/export/donors" className={btnPrimary}>Download CSV</a>
        </Card>
        <Card className="flex items-center justify-between p-4">
          <span className="text-sm font-medium text-slate-900">Students (roster)</span>
          {/* API download route, not a Next page — a plain <a> is correct. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/admin/export/students" className={btnPrimary}>Download CSV</a>
        </Card>
      </div>
    </div>
  );
}
