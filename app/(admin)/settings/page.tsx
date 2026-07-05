import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSettings, listAcademicSessions } from "@/lib/services/settings";
import { createSessionAction, savePaymentSettingsAction, setCurrentSessionAction, yearEndDeactivateAction } from "./actions";
import { page, PageHeader, Card, Badge, btnPrimary, btnSecondary, btnDanger, input, label } from "../_components/ui";
import { ConfirmSubmit } from "../_components/ConfirmSubmit";

type SearchParams = Promise<{ saved?: string; error?: string; deactivated?: string }>;

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/settings");
  const { saved, error, deactivated } = await searchParams;
  const [pay, sessions] = await Promise.all([getSettings(["pay_bkash", "pay_nagad", "pay_rocket", "pay_bank"]), listAcademicSessions()]);

  return (
    <div className={page}>
      <PageHeader title="Settings" description="Payment channels, academic sessions, and year-end operations." />
      {saved && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Saved.</div>}
      {deactivated !== undefined && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Year-end complete — {deactivated} student(s) deactivated.</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{decodeURIComponent(error)}</div>}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-900">Payment channels (shown on the public /give page)</h2>
        <p className="text-xs text-slate-500">Leave a field blank to hide that channel. Overrides the env defaults.</p>
        <Card className="mt-3 p-4">
          <form action={savePaymentSettingsAction} className="grid gap-3 sm:grid-cols-2">
            <label className={label}>bKash<input name="pay_bkash" defaultValue={pay.pay_bkash ?? ""} className={`mt-1 ${input}`} /></label>
            <label className={label}>Nagad<input name="pay_nagad" defaultValue={pay.pay_nagad ?? ""} className={`mt-1 ${input}`} /></label>
            <label className={label}>Rocket<input name="pay_rocket" defaultValue={pay.pay_rocket ?? ""} className={`mt-1 ${input}`} /></label>
            <label className={label}>Bank transfer<input name="pay_bank" defaultValue={pay.pay_bank ?? ""} className={`mt-1 ${input}`} /></label>
            <div className="sm:col-span-2"><button className={btnPrimary}>Save payment channels</button></div>
          </form>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-slate-900">Academic sessions</h2>
        <Card className="mt-2 divide-y divide-slate-100">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 text-sm text-slate-900">
              <span>{s.label} {s.isCurrent && <Badge tone="green">current</Badge>}</span>
              {!s.isCurrent && <form action={setCurrentSessionAction}><input type="hidden" name="id" value={s.id} /><button className={btnSecondary}>Set current</button></form>}
            </div>
          ))}
          {sessions.length === 0 && <div className="p-3 text-sm text-slate-400">No sessions yet.</div>}
        </Card>
        <form action={createSessionAction} className="mt-3 flex flex-wrap items-end gap-3">
          <label className={label}>New session label<input name="label" placeholder="2026-2027" required className={`mt-1 ${input}`} /></label>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="makeCurrent" /> make current</label>
          <button className={btnPrimary}>Add session</button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-red-800">Year-end</h2>
        <p className="text-xs text-slate-500">Deactivates every active student in one action (they re-enroll for the new session). Audited.</p>
        <form action={yearEndDeactivateAction} className="mt-2"><ConfirmSubmit className={btnDanger} message="Deactivate ALL active students? Every student will need to re-enroll for the new session. This is audited.">Run year-end deactivation</ConfirmSubmit></form>
      </section>
    </div>
  );
}
