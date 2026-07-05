import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSettings, listAcademicSessions } from "@/lib/services/settings";
import { createSessionAction, savePaymentSettingsAction, setCurrentSessionAction, yearEndDeactivateAction } from "./actions";

type SearchParams = Promise<{ saved?: string; error?: string; deactivated?: string }>;
const f = "mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm";
const lbl = "block text-xs font-medium text-black/60";

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/settings");
  const { saved, error, deactivated } = await searchParams;
  const [pay, sessions] = await Promise.all([getSettings(["pay_bkash", "pay_nagad", "pay_rocket", "pay_bank"]), listAcademicSessions()]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Settings</h1>
      {saved && <div className="mt-4 rounded border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-900">Saved.</div>}
      {deactivated !== undefined && <div className="mt-4 rounded border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-900">Year-end complete — {deactivated} student(s) deactivated.</div>}
      {error && <div className="mt-4 rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">{decodeURIComponent(error)}</div>}

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Payment channels (shown on the public /give page)</h2>
        <p className="text-xs text-black/50">Leave a field blank to hide that channel. Overrides the env defaults.</p>
        <form action={savePaymentSettingsAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className={lbl}>bKash<input name="pay_bkash" defaultValue={pay.pay_bkash ?? ""} className={f} /></label>
          <label className={lbl}>Nagad<input name="pay_nagad" defaultValue={pay.pay_nagad ?? ""} className={f} /></label>
          <label className={lbl}>Rocket<input name="pay_rocket" defaultValue={pay.pay_rocket ?? ""} className={f} /></label>
          <label className={lbl}>Bank transfer<input name="pay_bank" defaultValue={pay.pay_bank ?? ""} className={f} /></label>
          <div className="sm:col-span-2"><button className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85">Save payment channels</button></div>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold">Academic sessions</h2>
        <ul className="mt-2 divide-y divide-black/10 rounded-lg border border-black/10">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between p-3 text-sm">
              <span>{s.label} {s.isCurrent && <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-900">current</span>}</span>
              {!s.isCurrent && <form action={setCurrentSessionAction}><input type="hidden" name="id" value={s.id} /><button className="rounded border border-black/20 px-2.5 py-1 text-xs font-semibold hover:bg-black/5">Set current</button></form>}
            </li>
          ))}
          {sessions.length === 0 && <li className="p-3 text-sm text-black/40">No sessions yet.</li>}
        </ul>
        <form action={createSessionAction} className="mt-3 flex flex-wrap items-end gap-3">
          <label className={lbl}>New session label<input name="label" placeholder="2026-2027" required className="mt-1 rounded border border-black/15 px-3 py-2 text-sm" /></label>
          <label className="flex items-center gap-2 text-sm text-black/70"><input type="checkbox" name="makeCurrent" /> make current</label>
          <button className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85">Add session</button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-red-800">Year-end</h2>
        <p className="text-xs text-black/50">Deactivates every active student in one action (they re-enroll for the new session). Audited.</p>
        <form action={yearEndDeactivateAction} className="mt-2"><button className="rounded border border-red-600/40 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100">Run year-end deactivation</button></form>
      </section>
    </main>
  );
}
