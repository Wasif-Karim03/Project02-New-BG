import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAdminOverview } from "@/lib/services/admin-overview";

const usd = (m: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(m / 100);

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-black/10 p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-black/50">{label}</div>
    </div>
  );
}

function ActionCard({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <Link href={href} className={`flex items-center justify-between rounded-lg border p-4 text-sm hover:bg-black/[0.02] ${count > 0 ? "border-amber-400/60 bg-amber-50/50" : "border-black/10"}`}>
      <span>{label}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${count > 0 ? "bg-amber-500 text-white" : "bg-black/10 text-black/50"}`}>{count}</span>
    </Link>
  );
}

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/admin");
  const o = await getAdminOverview();

  const card = "rounded-lg border border-black/10 p-4 text-sm hover:bg-black/[0.02]";
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold">Admin dashboard</h1>
      <p className="mt-1 text-sm text-black/60">Welcome back, {session.user.name ?? session.user.email}.</p>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Total raised" value={usd(o.totalRaised)} />
        <Metric label="Donors" value={o.donorCount} />
        <Metric label="Active students" value={o.activeStudents} />
        <Metric label="Active pledges" value={o.activePledges} />
      </section>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-black/50">Needs attention</h2>
      <section className="mt-3 grid gap-3 sm:grid-cols-3">
        <ActionCard href="/approvals" label="Pending approvals" count={o.pendingApprovals} />
        <ActionCard href="/applications" label="Pending applications" count={o.pendingApplications} />
        <ActionCard href="/donations-pending" label="Pending donations" count={o.pendingDonations} />
      </section>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-black/50">Manage</h2>
      <section className="mt-3 grid gap-3 sm:grid-cols-3">
        <Link href="/roster" className={card}>Student roster →</Link>
        <Link href="/users" className={card}>Staff &amp; users →</Link>
        <Link href="/assignments" className={card}>Mentor assignments →</Link>
        <Link href="/pledges" className={card}>Monthly pledges →</Link>
        <Link href="/offline-donations" className={card}>Record offline gift →</Link>
        <Link href="/legacy-import" className={card}>Legacy CSV import →</Link>
        <Link href="/sponsorships" className={card}>Active sponsorships →</Link>
      </section>
    </main>
  );
}
