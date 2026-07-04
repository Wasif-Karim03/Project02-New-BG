import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listManualPledges } from "@/lib/services/pledges";
import { cancelPledgeAction, createPledgeAction, recordPaymentAction } from "./actions";

const usd = (m: number, c = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(m / 100);
const f = "mt-1 rounded border border-black/15 px-2 py-1.5 text-sm";
const lbl = "block text-xs font-medium text-black/60";
type SearchParams = Promise<{ error?: string }>;

export default async function PledgesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/pledges");
  const { error } = await searchParams;
  const [pledges, students, projects] = await Promise.all([
    listManualPledges(),
    prisma.student.findMany({ where: { status: "ACTIVE" }, select: { id: true, firstName: true } }),
    prisma.project.findMany({ where: { status: "ACTIVE" }, select: { id: true, title: true } }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Monthly pledges</h1>
      <p className="mt-1 text-sm text-black/60">Manual recurring commitments (no auto-charge). Log each payment as it arrives; a <strong>due</strong> badge marks pledges with no payment this period. All audited.</p>
      {error && <div className="mt-4 rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">{decodeURIComponent(error)}</div>}

      <form action={createPledgeAction} className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4">
        <label className={lbl}>Donor name<input name="donorName" required className={f} /></label>
        <label className={lbl}>Email<input name="donorEmail" type="email" className={f} /></label>
        <label className={lbl}>Amount (USD)<input name="amountDollars" type="number" min="1" step="0.01" required className={f} /></label>
        <label className={lbl}>Interval<select name="interval" className={f} defaultValue="month"><option value="month">Monthly</option><option value="year">Yearly</option></select></label>
        <label className={lbl}>Designation<select name="designationType" className={f} defaultValue="STUDENT"><option value="GENERAL">General</option><option value="STUDENT">Student</option><option value="PROJECT">Project</option></select></label>
        <label className={lbl}>Student<select name="studentId" className={f} defaultValue=""><option value="">—</option>{students.map((s) => <option key={s.id} value={s.id}>{s.firstName}</option>)}</select></label>
        <label className={lbl}>Project<select name="projectId" className={f} defaultValue=""><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        <button className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85">Add pledge</button>
      </form>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-black/50">Active pledges ({pledges.length})</h2>
      {pledges.length === 0 ? <p className="mt-2 text-sm text-black/40">No active pledges.</p> : (
        <ul className="mt-3 divide-y divide-black/10 rounded-lg border border-black/10">
          {pledges.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <span>
                <strong>{p.donorName}</strong> · {usd(p.amount, p.currency)}/{p.interval} → {p.target}
                {p.due ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">due</span> : <span className="ml-2 text-xs text-black/40">paid {p.lastPayment ? new Date(p.lastPayment).toLocaleDateString() : ""}</span>}
              </span>
              <span className="flex items-center gap-2">
                <form action={recordPaymentAction} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={p.id} />
                  <select name="method" className="rounded border border-black/15 px-1 py-1 text-xs" defaultValue="bkash"><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="rocket">Rocket</option><option value="bank">Bank</option><option value="cash">Cash</option></select>
                  <input name="reference" placeholder="ref" className="w-20 rounded border border-black/15 px-1 py-1 text-xs" />
                  <button className="rounded bg-green-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-800">Log payment</button>
                </form>
                <form action={cancelPledgeAction}><input type="hidden" name="id" value={p.id} /><button className="rounded border border-black/20 px-2.5 py-1.5 text-xs font-semibold hover:bg-black/5">Cancel</button></form>
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
