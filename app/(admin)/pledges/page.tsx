import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listManualPledges } from "@/lib/services/pledges";
import { cancelPledgeAction, createPledgeAction, recordPaymentAction } from "./actions";
import { page, PageHeader, Card, Badge, EmptyState, btnPrimary, btnDanger, input, label } from "../_components/ui";

const usd = (m: number, c = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(m / 100);
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
    <div className={page}>
      <PageHeader title="Monthly pledges" description="Manual recurring commitments (no auto-charge). Log each payment as it arrives; a due badge marks pledges with no payment this period. All audited." />
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{decodeURIComponent(error)}</div>}

      <Card className="mt-6 p-4">
        <form action={createPledgeAction} className="flex flex-wrap items-end gap-3">
          <label className={label}>Donor name<input name="donorName" required className={`mt-1 ${input}`} /></label>
          <label className={label}>Email<input name="donorEmail" type="email" className={`mt-1 ${input}`} /></label>
          <label className={label}>Amount (USD)<input name="amountDollars" type="number" min="1" step="0.01" required className={`mt-1 ${input}`} /></label>
          <label className={label}>Interval<select name="interval" className={`mt-1 ${input}`} defaultValue="month"><option value="month">Monthly</option><option value="year">Yearly</option></select></label>
          <label className={label}>Designation<select name="designationType" className={`mt-1 ${input}`} defaultValue="STUDENT"><option value="GENERAL">General</option><option value="STUDENT">Student</option><option value="PROJECT">Project</option></select></label>
          <label className={label}>Student<select name="studentId" className={`mt-1 ${input}`} defaultValue=""><option value="">—</option>{students.map((s) => <option key={s.id} value={s.id}>{s.firstName}</option>)}</select></label>
          <label className={label}>Project<select name="projectId" className={`mt-1 ${input}`} defaultValue=""><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
          <button className={btnPrimary}>Add pledge</button>
        </form>
      </Card>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-slate-500">Active pledges ({pledges.length})</h2>
      {pledges.length === 0 ? <div className="mt-3"><EmptyState>No active pledges.</EmptyState></div> : (
        <Card className="mt-3 divide-y divide-slate-100">
          {pledges.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-slate-900">
              <span>
                <strong>{p.donorName}</strong> · {usd(p.amount, p.currency)}/{p.interval} → {p.target}
                {p.due ? <span className="ml-2"><Badge tone="amber">due</Badge></span> : <span className="ml-2 text-xs text-slate-400">paid {p.lastPayment ? new Date(p.lastPayment).toLocaleDateString() : ""}</span>}
              </span>
              <span className="flex items-center gap-2">
                <form action={recordPaymentAction} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={p.id} />
                  <select name="method" className={input} defaultValue="bkash"><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="rocket">Rocket</option><option value="bank">Bank</option><option value="cash">Cash</option></select>
                  <input name="reference" placeholder="ref" className={`w-20 ${input}`} />
                  <button className={btnPrimary}>Log payment</button>
                </form>
                <form action={cancelPledgeAction}><input type="hidden" name="id" value={p.id} /><button className={btnDanger}>Cancel</button></form>
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
