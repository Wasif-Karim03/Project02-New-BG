import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/services/settings";
import { submitClaimAction } from "./actions";

type SearchParams = Promise<{ submitted?: string; error?: string }>;
const f = "mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm";
const lbl = "block text-xs font-medium text-black/60";

export default async function GivePage({ searchParams }: { searchParams: SearchParams }) {
  const { submitted, error } = await searchParams;
  const [students, projects, pay] = await Promise.all([
    prisma.student.findMany({ where: { status: "ACTIVE" }, select: { id: true, firstName: true }, orderBy: { firstName: "asc" } }),
    prisma.project.findMany({ where: { status: "ACTIVE" }, select: { id: true, title: true } }),
    getSettings(["pay_bkash", "pay_nagad", "pay_rocket", "pay_bank"]),
  ]);
  // Admin-editable settings win; env vars are the fallback default.
  const CHANNELS = [
    { label: "bKash", value: pay.pay_bkash || process.env.NEXT_PUBLIC_PAY_BKASH },
    { label: "Nagad", value: pay.pay_nagad || process.env.NEXT_PUBLIC_PAY_NAGAD },
    { label: "Rocket", value: pay.pay_rocket || process.env.NEXT_PUBLIC_PAY_ROCKET },
    { label: "Bank transfer", value: pay.pay_bank || process.env.NEXT_PUBLIC_PAY_BANK },
  ].filter((c) => c.value);

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Bridging Generations</p>
      <h1 className="mt-1 text-2xl font-bold">Give a gift</h1>
      <p className="mt-2 text-sm text-black/60">Send your gift directly via mobile banking or bank transfer (no fees), then tell us about it below. We verify every gift and email your receipt.</p>

      {submitted && <div className="mt-4 rounded border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-900">Thank you! Your gift is recorded and pending verification. We&apos;ll confirm and email your receipt shortly.</div>}
      {error && <div className="mt-4 rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">{decodeURIComponent(error)}</div>}

      <section className="mt-6 rounded-lg border border-black/10 bg-black/[0.02] p-4 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-black/50">How to send your gift</h2>
        {CHANNELS.length === 0 ? (
          <p className="mt-2 text-black/50">Payment details will appear here once the organization sets them (env: NEXT_PUBLIC_PAY_BKASH / _NAGAD / _ROCKET / _BANK).</p>
        ) : (
          <ul className="mt-2 space-y-1">{CHANNELS.map((c) => <li key={c.label}><strong>{c.label}:</strong> {c.value}</li>)}</ul>
        )}
      </section>

      <form action={submitClaimAction} className="mt-6 grid gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-black/50">Tell us about your gift</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={lbl}>Your name<input name="donorName" required className={f} /></label>
          <label className={lbl}>Email (for your receipt)<input name="donorEmail" type="email" className={f} /></label>
          <label className={lbl}>Amount (USD)<input name="amountDollars" type="number" min="1" step="0.01" required className={f} /></label>
          <label className={lbl}>Sent via
            <select name="method" required className={f} defaultValue="bkash">
              <option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="rocket">Rocket</option><option value="bank">Bank transfer</option><option value="cash">Cash</option><option value="other">Other</option>
            </select>
          </label>
          <label className={lbl}>Transaction ID / reference<input name="reference" placeholder="e.g. bKash TrxID" className={f} /></label>
          <label className={lbl}>Designation
            <select name="designationType" className={f} defaultValue="GENERAL"><option value="GENERAL">Where needed most</option><option value="STUDENT">A student</option><option value="PROJECT">A project</option></select>
          </label>
          {students.length > 0 && <label className={lbl}>Student (if applicable)<select name="studentId" className={f} defaultValue=""><option value="">—</option>{students.map((s) => <option key={s.id} value={s.id}>{s.firstName}</option>)}</select></label>}
          {projects.length > 0 && <label className={lbl}>Project (if applicable)<select name="projectId" className={f} defaultValue=""><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>}
        </div>
        <label className={lbl}>Note (optional)<input name="note" className={f} /></label>
        <button type="submit" className="mt-1 rounded bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-black/85">Submit my gift</button>
      </form>
    </main>
  );
}
