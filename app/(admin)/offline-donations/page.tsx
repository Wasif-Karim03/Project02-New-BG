import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createOfflineDonationAction } from "./actions";
import { page, PageHeader, Card, Badge, EmptyState, btnPrimary, input, label } from "../_components/ui";

const usd = (m: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(m / 100);
type SearchParams = Promise<{ error?: string; ok?: string }>;

function statusTone(status: string) {
  if (status === "SUCCEEDED" || status === "ACTIVE") return "green";
  if (status === "PENDING") return "amber";
  if (status === "FAILED" || status === "VOIDED" || status === "REFUNDED") return "red";
  return "neutral";
}

export default async function OfflineDonationsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/login?callbackUrl=/offline-donations");
  }
  const { error, ok } = await searchParams;

  const [projects, students, recent] = await Promise.all([
    prisma.project.findMany({ where: { status: "ACTIVE" }, select: { id: true, title: true } }),
    prisma.student.findMany({ where: { status: "ACTIVE" }, select: { id: true, firstName: true } }),
    prisma.donation.findMany({ where: { source: { not: "STRIPE" } }, select: { id: true, amount: true, source: true, occurredAt: true, isHistorical: true, status: true }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);

  return (
    <div className={page}>
      <PageHeader
        title="Record an offline gift"
        description="Cash, check, bank transfer, or other. Fully editable and audit-logged. Historical/backfill rows are counted in totals but get no receipt."
      />

      {ok && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Recorded.</div>}
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{decodeURIComponent(error)}</div>}

      <Card className="p-4">
        <form action={createOfflineDonationAction} className="grid gap-3 sm:grid-cols-2">
          <label className={label}>Donor name<input name="donorName" required className={`mt-1 ${input}`} /></label>
          <label className={label}>Donor email (optional)<input name="donorEmail" type="email" className={`mt-1 ${input}`} /></label>
          <label className={label}>Amount (USD)<input name="amountDollars" type="number" min="1" step="0.01" required className={`mt-1 ${input}`} /></label>
          <label className={label}>Source
            <select name="source" className={`mt-1 ${input}`} defaultValue="CASH">
              <option value="CASH">Cash</option><option value="CHECK">Check</option><option value="BANK">Bank</option><option value="LEGACY">Legacy</option><option value="OTHER">Other</option>
            </select>
          </label>
          <label className={label}>Designation
            <select name="designationType" className={`mt-1 ${input}`} defaultValue="GENERAL">
              <option value="GENERAL">General</option><option value="PROJECT">Project</option><option value="STUDENT">Student</option>
            </select>
          </label>
          <label className={label}>Date received<input name="occurredAt" type="date" required className={`mt-1 ${input}`} /></label>
          <label className={label}>Project (if PROJECT)
            <select name="projectId" className={`mt-1 ${input}`} defaultValue=""><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
          </label>
          <label className={label}>Student (if STUDENT)
            <select name="studentId" className={`mt-1 ${input}`} defaultValue=""><option value="">—</option>{students.map((s) => <option key={s.id} value={s.id}>{s.firstName}</option>)}</select>
          </label>
          <label className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="isHistorical" /> Historical backfill (no receipt; still counts in totals)</label>
          <label className={`sm:col-span-2 ${label}`}>Note<input name="note" className={`mt-1 ${input}`} /></label>
          <div className="sm:col-span-2"><button type="submit" className={btnPrimary}>Record gift</button></div>
        </form>
      </Card>

      <h2 className="mt-10 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent offline gifts</h2>
      {recent.length === 0 ? (
        <EmptyState>No offline gifts yet.</EmptyState>
      ) : (
        <Card className="p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2">Date</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Source</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((d) => (
                <tr key={d.id} className="border-b border-slate-100">
                  <td className="py-2">{new Date(d.occurredAt).toLocaleDateString()}</td>
                  <td className="py-2">{usd(d.amount)}</td>
                  <td className="py-2">{d.source}{d.isHistorical ? " · historical" : ""}</td>
                  <td className="py-2"><Badge tone={statusTone(d.status)}>{d.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
