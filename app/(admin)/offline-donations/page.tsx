import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createOfflineDonationAction } from "./actions";

const usd = (m: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(m / 100);
const field = "mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm";
const label = "block text-xs font-medium text-black/60";
type SearchParams = Promise<{ error?: string; ok?: string }>;

export default async function OfflineDonationsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/api/auth/signin?callbackUrl=/offline-donations");
  }
  const { error, ok } = await searchParams;

  const [projects, students, recent] = await Promise.all([
    prisma.project.findMany({ where: { status: "ACTIVE" }, select: { id: true, title: true } }),
    prisma.student.findMany({ where: { status: "ACTIVE" }, select: { id: true, firstName: true } }),
    prisma.donation.findMany({ where: { source: { not: "STRIPE" } }, select: { id: true, amount: true, source: true, occurredAt: true, isHistorical: true, status: true }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Record an offline gift</h1>
      <p className="mt-1 text-sm text-black/60">Cash, check, bank transfer, or other. Fully editable and audit-logged. Historical/backfill rows are counted in totals but get no receipt.</p>
      {ok && <div className="mt-4 rounded border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-900">Recorded.</div>}
      {error && <div className="mt-4 rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">{decodeURIComponent(error)}</div>}

      <form action={createOfflineDonationAction} className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className={label}>Donor name<input name="donorName" required className={field} /></label>
        <label className={label}>Donor email (optional)<input name="donorEmail" type="email" className={field} /></label>
        <label className={label}>Amount (USD)<input name="amountDollars" type="number" min="1" step="0.01" required className={field} /></label>
        <label className={label}>Source
          <select name="source" className={field} defaultValue="CASH">
            <option value="CASH">Cash</option><option value="CHECK">Check</option><option value="BANK">Bank</option><option value="LEGACY">Legacy</option><option value="OTHER">Other</option>
          </select>
        </label>
        <label className={label}>Designation
          <select name="designationType" className={field} defaultValue="GENERAL">
            <option value="GENERAL">General</option><option value="PROJECT">Project</option><option value="STUDENT">Student</option>
          </select>
        </label>
        <label className={label}>Date received<input name="occurredAt" type="date" required className={field} /></label>
        <label className={label}>Project (if PROJECT)
          <select name="projectId" className={field} defaultValue=""><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
        </label>
        <label className={label}>Student (if STUDENT)
          <select name="studentId" className={field} defaultValue=""><option value="">—</option>{students.map((s) => <option key={s.id} value={s.id}>{s.firstName}</option>)}</select>
        </label>
        <label className="sm:col-span-2 flex items-center gap-2 text-xs text-black/70"><input type="checkbox" name="isHistorical" /> Historical backfill (no receipt; still counts in totals)</label>
        <label className="sm:col-span-2 block text-xs font-medium text-black/60">Note<input name="note" className={field} /></label>
        <div className="sm:col-span-2"><button type="submit" className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85">Record gift</button></div>
      </form>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-black/50">Recent offline gifts</h2>
      <table className="mt-3 w-full text-sm">
        <tbody>
          {recent.map((d) => (
            <tr key={d.id} className="border-b border-black/5">
              <td className="py-2">{new Date(d.occurredAt).toLocaleDateString()}</td>
              <td>{usd(d.amount)}</td>
              <td>{d.source}{d.isHistorical ? " · historical" : ""}</td>
              <td>{d.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
