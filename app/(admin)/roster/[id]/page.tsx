import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStudentRecord } from "@/lib/services/student-record";
import { setFlagsAction, updateRecordAction, upsertSessionAction } from "../actions";

const usd = (m: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(m / 100);
const f = "mt-1 w-full rounded border border-black/15 px-2 py-1.5 text-sm";
const lbl = "block text-xs font-medium text-black/60";
type SearchParams = Promise<{ ok?: string; error?: string }>;

export default async function RosterEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/roster");
  const { id } = await params;
  const { ok, error } = await searchParams;
  const [s, sessions] = await Promise.all([getStudentRecord(id), prisma.academicSession.findMany({ orderBy: { label: "desc" } })]);
  if (!s) notFound();
  const dollars = (m: number | null) => (m == null ? "" : (m / 100).toString());

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{s.firstName}</h1>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-black/5 px-1.5 py-0.5">{s.status}</span>
          <form action={setFlagsAction}><input type="hidden" name="studentId" value={s.id} /><input type="hidden" name="verified" value={(!s.verified).toString()} /><button className={`rounded px-2 py-0.5 ${s.verified ? "bg-green-100 text-green-800" : "bg-black/10"}`}>{s.verified ? "verified ✓" : "mark verified"}</button></form>
          <form action={setFlagsAction}><input type="hidden" name="studentId" value={s.id} /><input type="hidden" name="active" value={(!s.active).toString()} /><button className={`rounded px-2 py-0.5 ${s.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{s.active ? "active" : "inactive"}</button></form>
        </div>
      </div>
      <p className="mt-1 text-sm text-black/50">{s.user?.email}{s.slug ? ` · ${s.slug}` : ""}</p>
      {ok && <div className="mt-3 rounded border border-green-600/30 bg-green-50 px-4 py-2 text-sm text-green-900">Saved.</div>}
      {error && <div className="mt-3 rounded border border-red-600/30 bg-red-50 px-4 py-2 text-sm text-red-900">{decodeURIComponent(error)}</div>}

      {/* Record + funding */}
      <form action={updateRecordAction} className="mt-6">
        <input type="hidden" name="studentId" value={s.id} />
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-black/50">Basic + funding</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={lbl}>Registration ID<input name="registrationId" defaultValue={s.registrationId ?? ""} className={f} /></label>
          <label className={lbl}>Purpose<input name="purpose" defaultValue={s.purpose ?? ""} className={f} /></label>
          <label className={lbl}>Payment type
            <select name="paymentType" defaultValue={s.paymentType ?? ""} className={f}><option value="">—</option><option value="ONE_TIME">One-time</option><option value="INSTALLMENT">Installment</option></select>
          </label>
          <label className={lbl}>Target type
            <select name="targetType" defaultValue={s.targetType ?? ""} className={f}><option value="">—</option><option value="MONTH">Month</option><option value="YEAR">Year</option></select>
          </label>
          <label className={lbl}>Require amount (USD)<input name="requireAmount" type="number" step="0.01" defaultValue={dollars(s.requireAmount)} className={f} /></label>
          <label className={lbl}>Min donate (USD)<input name="minDonateAmount" type="number" step="0.01" defaultValue={dollars(s.minDonateAmount)} className={f} /></label>
          <label className={lbl}>Per installment (USD)<input name="perInstallment" type="number" step="0.01" defaultValue={dollars(s.perInstallment)} className={f} /></label>
          <label className={lbl}>Target period<input name="targetPeriod" defaultValue={s.targetPeriod ?? ""} placeholder="2026 or 2026-01" className={f} /></label>
        </div>
        <h2 className="mt-6 mb-1 text-sm font-semibold uppercase tracking-wide text-black/50">Family + contact</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={lbl}>District<input name="addrDistrict" defaultValue={s.addrDistrict ?? ""} className={f} /></label>
          <label className={lbl}>Career goal<input name="careerGoal" defaultValue={s.careerGoal ?? ""} className={f} /></label>
          <label className={lbl}>Father profession<input name="fatherProfession" defaultValue={s.fatherProfession ?? ""} className={f} /></label>
          <label className={lbl}>Mother profession<input name="motherProfession" defaultValue={s.motherProfession ?? ""} className={f} /></label>
          <label className={lbl}>Family income<input name="familyIncome" defaultValue={s.familyIncome ?? ""} className={f} /></label>
          <label className={lbl}>Guardian name<input name="guardianName" defaultValue={s.guardianName ?? ""} className={f} /></label>
          <label className={lbl}>Guardian mobile<input name="guardianMobile" defaultValue={s.guardianMobile ?? ""} className={f} /></label>
          <label className={lbl}>Guardian address<input name="guardianAddress" defaultValue={s.guardianAddress ?? ""} className={f} /></label>
          <label className={lbl}>Tutor name<input name="tutorName" defaultValue={s.tutorName ?? ""} className={f} /></label>
          <label className={lbl}>Tutor phone<input name="tutorPhone" defaultValue={s.tutorPhone ?? ""} className={f} /></label>
        </div>
        <button className="mt-4 rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85">Save record</button>
      </form>

      {/* Education table */}
      <h2 className="mt-10 mb-1 text-sm font-semibold uppercase tracking-wide text-black/50">Education (per session)</h2>
      {s.sessions.length > 0 && (
        <table className="w-full text-sm"><thead><tr className="border-b border-black/10 text-left text-xs uppercase text-black/50"><th className="py-1">Session</th><th>Institution</th><th>Grade</th><th>Roll</th><th>Former</th><th>Total</th></tr></thead>
          <tbody>{s.sessions.map((e) => <tr key={e.id} className="border-b border-black/5"><td className="py-1">{e.session.label}</td><td>{e.institutionName ?? "—"}</td><td>{e.grade ?? "—"}</td><td>{e.roll ?? "—"}</td><td>{e.formerRoll ?? "—"}</td><td>{e.totalStudent ?? "—"}</td></tr>)}</tbody>
        </table>
      )}
      <form action={upsertSessionAction} className="mt-3 grid gap-2 rounded-lg border border-black/10 p-3 sm:grid-cols-3">
        <input type="hidden" name="studentId" value={s.id} />
        <label className={lbl}>Session<select name="sessionId" required className={f}><option value="">—</option>{sessions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
        <label className={lbl}>Institution<input name="institutionName" className={f} /></label>
        <label className={lbl}>Grade<input name="grade" className={f} /></label>
        <label className={lbl}>Roll<input name="roll" className={f} /></label>
        <label className={lbl}>Former roll<input name="formerRoll" className={f} /></label>
        <label className={lbl}>Total students<input name="totalStudent" className={f} /></label>
        <div className="sm:col-span-3"><button className="rounded bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/85">Add / update session</button></div>
      </form>

      {/* Donors (admin sees real names) */}
      <h2 className="mt-10 mb-1 text-sm font-semibold uppercase tracking-wide text-black/50">Donors ({s.donations.length})</h2>
      {s.donations.length === 0 ? <p className="text-sm text-black/40">No donations directed to this student.</p> : (
        <table className="w-full text-sm"><tbody>{s.donations.map((d, i) => <tr key={i} className="border-b border-black/5"><td className="py-1">{d.donor.name}{d.donor.isAnonymous ? " (anon)" : ""}</td><td>{usd(d.amount - d.refundedAmount)}</td><td>{new Date(d.occurredAt).toLocaleDateString()}</td><td>{d.isRecurring ? "recurring" : ""}</td></tr>)}</tbody></table>
      )}
    </main>
  );
}
