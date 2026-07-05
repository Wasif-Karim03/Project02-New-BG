import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStudentRecord } from "@/lib/services/student-record";
import { setFlagsAction, updateRecordAction, upsertSessionAction } from "../actions";
import { page, PageHeader, Card, Badge, EmptyState, btnPrimary, input, label } from "../../_components/ui";

const usd = (m: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(m / 100);
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
    <div className={page}>
      <PageHeader title={s.firstName} description={`${s.user?.email ?? ""}${s.slug ? ` · ${s.slug}` : ""}`}>
        <div className="flex items-center gap-2">
          <Badge tone={s.status === "ACTIVE" ? "green" : s.status === "PENDING" ? "amber" : "neutral"}>{s.status}</Badge>
          <form action={setFlagsAction}>
            <input type="hidden" name="studentId" value={s.id} />
            <input type="hidden" name="verified" value={(!s.verified).toString()} />
            <button className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${s.verified ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{s.verified ? "verified ✓" : "mark verified"}</button>
          </form>
          <form action={setFlagsAction}>
            <input type="hidden" name="studentId" value={s.id} />
            <input type="hidden" name="active" value={(!s.active).toString()} />
            <button className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${s.active ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{s.active ? "active" : "inactive"}</button>
          </form>
        </div>
      </PageHeader>

      {ok && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Saved.</div>}
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{decodeURIComponent(error)}</div>}

      {/* Record + funding */}
      <form action={updateRecordAction}>
        <input type="hidden" name="studentId" value={s.id} />
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Basic + funding</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Registration ID<input name="registrationId" defaultValue={s.registrationId ?? ""} className={input} /></label>
            <label className={label}>Purpose<input name="purpose" defaultValue={s.purpose ?? ""} className={input} /></label>
            <label className={label}>Payment type
              <select name="paymentType" defaultValue={s.paymentType ?? ""} className={input}><option value="">—</option><option value="ONE_TIME">One-time</option><option value="INSTALLMENT">Installment</option></select>
            </label>
            <label className={label}>Target type
              <select name="targetType" defaultValue={s.targetType ?? ""} className={input}><option value="">—</option><option value="MONTH">Month</option><option value="YEAR">Year</option></select>
            </label>
            <label className={label}>Require amount (USD)<input name="requireAmount" type="number" step="0.01" defaultValue={dollars(s.requireAmount)} className={input} /></label>
            <label className={label}>Min donate (USD)<input name="minDonateAmount" type="number" step="0.01" defaultValue={dollars(s.minDonateAmount)} className={input} /></label>
            <label className={label}>Per installment (USD)<input name="perInstallment" type="number" step="0.01" defaultValue={dollars(s.perInstallment)} className={input} /></label>
            <label className={label}>Target period<input name="targetPeriod" defaultValue={s.targetPeriod ?? ""} placeholder="2026 or 2026-01" className={input} /></label>
          </div>
        </Card>

        <Card className="mt-6 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Family + contact</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>District<input name="addrDistrict" defaultValue={s.addrDistrict ?? ""} className={input} /></label>
            <label className={label}>Career goal<input name="careerGoal" defaultValue={s.careerGoal ?? ""} className={input} /></label>
            <label className={label}>Father profession<input name="fatherProfession" defaultValue={s.fatherProfession ?? ""} className={input} /></label>
            <label className={label}>Mother profession<input name="motherProfession" defaultValue={s.motherProfession ?? ""} className={input} /></label>
            <label className={label}>Family income<input name="familyIncome" defaultValue={s.familyIncome ?? ""} className={input} /></label>
            <label className={label}>Guardian name<input name="guardianName" defaultValue={s.guardianName ?? ""} className={input} /></label>
            <label className={label}>Guardian mobile<input name="guardianMobile" defaultValue={s.guardianMobile ?? ""} className={input} /></label>
            <label className={label}>Guardian address<input name="guardianAddress" defaultValue={s.guardianAddress ?? ""} className={input} /></label>
            <label className={label}>Tutor name<input name="tutorName" defaultValue={s.tutorName ?? ""} className={input} /></label>
            <label className={label}>Tutor phone<input name="tutorPhone" defaultValue={s.tutorPhone ?? ""} className={input} /></label>
          </div>
          <button className={`mt-4 ${btnPrimary}`}>Save record</button>
        </Card>
      </form>

      {/* Education table */}
      <Card className="mt-6 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Education (per session)</h2>
        {s.sessions.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2">Session</th><th className="py-2">Institution</th><th className="py-2">Grade</th><th className="py-2">Roll</th><th className="py-2">Former</th><th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody>{s.sessions.map((e) => <tr key={e.id} className="border-b border-slate-100"><td className="py-2">{e.session.label}</td><td className="py-2">{e.institutionName ?? "—"}</td><td className="py-2">{e.grade ?? "—"}</td><td className="py-2">{e.roll ?? "—"}</td><td className="py-2">{e.formerRoll ?? "—"}</td><td className="py-2">{e.totalStudent ?? "—"}</td></tr>)}</tbody>
          </table>
        )}
        <form action={upsertSessionAction} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="studentId" value={s.id} />
          <label className={label}>Session<select name="sessionId" required className={input}><option value="">—</option>{sessions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
          <label className={label}>Institution<input name="institutionName" className={input} /></label>
          <label className={label}>Grade<input name="grade" className={input} /></label>
          <label className={label}>Roll<input name="roll" className={input} /></label>
          <label className={label}>Former roll<input name="formerRoll" className={input} /></label>
          <label className={label}>Total students<input name="totalStudent" className={input} /></label>
          <div className="sm:col-span-3"><button className={btnPrimary}>Add / update session</button></div>
        </form>
      </Card>

      {/* Donors (admin sees real names) */}
      <Card className="mt-6 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Donors ({s.donations.length})</h2>
        {s.donations.length === 0 ? <EmptyState>No donations directed to this student.</EmptyState> : (
          <table className="w-full text-sm"><tbody>{s.donations.map((d, i) => <tr key={i} className="border-b border-slate-100"><td className="py-2">{d.donor.name}{d.donor.isAnonymous ? " (anon)" : ""}</td><td className="py-2">{usd(d.amount - d.refundedAmount)}</td><td className="py-2">{new Date(d.occurredAt).toLocaleDateString()}</td><td className="py-2">{d.isRecurring ? "recurring" : ""}</td></tr>)}</tbody></table>
        )}
      </Card>
    </div>
  );
}
