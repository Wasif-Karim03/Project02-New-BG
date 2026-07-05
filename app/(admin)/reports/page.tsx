import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  const card = "rounded-lg border border-black/10 p-4";
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Reports &amp; exports</h1>
      <p className="mt-1 text-sm text-black/60">Download CSVs for accounting, the 990 filing, and board reports.</p>

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-black/50">Money received by source</h2>
      <table className="mt-2 w-full max-w-md text-sm">
        <tbody>
          {bySource.map((r) => (
            <tr key={r.source} className="border-b border-black/5"><td className="py-1">{r.source}</td><td className="text-right text-black/50">{r._count} gifts</td><td className="text-right font-medium">{usd((r._sum.amount ?? 0) - (r._sum.refundedAmount ?? 0))}</td></tr>
          ))}
          {bySource.length === 0 && <tr><td className="py-1 text-black/40">No successful donations yet.</td></tr>}
        </tbody>
      </table>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-black/50">Downloads</h2>
      <div className="mt-3 grid gap-3">
        <form method="get" action="/api/admin/export/donations" className={`${card} flex flex-wrap items-end gap-3`}>
          <div className="text-sm font-medium">Donations</div>
          <label className="text-xs text-black/60">From<input type="date" name="from" className="mt-1 block rounded border border-black/15 px-2 py-1 text-sm" /></label>
          <label className="text-xs text-black/60">To<input type="date" name="to" className="mt-1 block rounded border border-black/15 px-2 py-1 text-sm" /></label>
          <button className="rounded bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-black/85">Download CSV</button>
          <span className="text-xs text-black/40">Leave dates blank for all-time.</span>
        </form>
        <div className={`${card} flex items-center justify-between`}>
          <span className="text-sm font-medium">Donors (lifetime totals)</span>
          <a href="/api/admin/export/donors" className="rounded bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-black/85">Download CSV</a>
        </div>
        <div className={`${card} flex items-center justify-between`}>
          <span className="text-sm font-medium">Students (roster)</span>
          <a href="/api/admin/export/students" className="rounded bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-black/85">Download CSV</a>
        </div>
      </div>
    </main>
  );
}
