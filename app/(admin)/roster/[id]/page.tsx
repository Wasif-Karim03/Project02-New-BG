import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { portraitVisible } from "@/lib/public/consent";
import { getStudentRecord } from "@/lib/services/student-record";
import { getStudentSeriesWithProgress } from "@/lib/services/installments";
import { createSeriesAction, deleteStudentAction, markInstallmentPaidAction, setFlagsAction, updateRecordAction } from "../actions";
import { page, PageHeader, Card, Badge, EmptyState, btnPrimary, btnSecondary, btnDanger, input, label } from "../../_components/ui";
import { ConfirmSubmit } from "../../_components/ConfirmSubmit";
import { EducationManager } from "./_components/EducationManager";
import Link from "next/link";

const usd = (m: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(m / 100);
type SearchParams = Promise<{ ok?: string; error?: string }>;

export default async function RosterEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/roster");
  const { id } = await params;
  const { ok, error } = await searchParams;
  const [s, sessions, schools, seriesData] = await Promise.all([
    getStudentRecord(id),
    prisma.academicSession.findMany({ orderBy: { label: "desc" } }),
    prisma.school.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getStudentSeriesWithProgress(id),
  ]);
  if (!s) notFound();
  const dollars = (m: number | null) => (m == null ? "" : (m / 100).toString());
  const thisYear = new Date().getFullYear();

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
          <form action={setFlagsAction}>
            <input type="hidden" name="studentId" value={s.id} />
            <input type="hidden" name="showOnWebsite" value={(!s.showOnWebsite).toString()} />
            <button title="Controls whether this student appears in the public website's student directory" className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${s.showOnWebsite ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{s.showOnWebsite ? "🌐 on website ✓" : "🌐 hidden from website"}</button>
          </form>
          <form action={setFlagsAction}>
            <input type="hidden" name="studentId" value={s.id} />
            <input type="hidden" name="showPhoto" value={(!portraitVisible(s)).toString()} />
            <button title="Consent to display this student's photo publicly (minors' images). Off = only the initial shows." className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${portraitVisible(s) ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{portraitVisible(s) ? "📷 photo shown ✓" : "📷 photo hidden"}</button>
          </form>
          <Link href={`/roster/${s.id}/print`} target="_blank" className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200" title="Open a printable / downloadable single-student view">🖨 Print / PDF</Link>
        </div>
      </PageHeader>

      {ok && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Saved.</div>}
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{decodeURIComponent(error)}</div>}

      {/* Record + funding */}
      <form action={updateRecordAction}>
        <input type="hidden" name="studentId" value={s.id} />
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Identity</h2>
          <p className="mb-3 text-xs text-slate-500">Correct a misspelled name, the wrong parent name, gender, school, or bio here.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>First name (public)<input name="firstName" defaultValue={s.firstName} className={input} /></label>
            <label className={label}>Full name<input name="fullName" defaultValue={s.fullName ?? ""} className={input} /></label>
            <label className={label}>Father name<input name="fatherName" defaultValue={s.fatherName ?? ""} className={input} /></label>
            <label className={label}>Mother name<input name="motherName" defaultValue={s.motherName ?? ""} className={input} /></label>
            <label className={label}>Full name (Bangla)<input name="fullNameBn" defaultValue={s.fullNameBn ?? ""} className={input} /></label>
            <label className={label}>Father name (Bangla)<input name="fatherNameBn" defaultValue={s.fatherNameBn ?? ""} className={input} /></label>
            <label className={label}>Mother name (Bangla)<input name="motherNameBn" defaultValue={s.motherNameBn ?? ""} className={input} /></label>
            <label className={label}>Gender<input name="gender" defaultValue={s.gender ?? ""} className={input} /></label>
            <label className={label}>Date of birth<input name="dob" type="date" defaultValue={s.dob ? new Date(s.dob).toISOString().slice(0, 10) : ""} className={input} /></label>
            <label className={label}>School
              <select name="schoolId" defaultValue={s.schoolId ?? ""} className={input}>
                <option value="">— none —</option>
                {schools.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
              </select>
            </label>
            <label className={`sm:col-span-2 ${label}`}>Bio<textarea name="bio" defaultValue={s.bio ?? ""} rows={3} className={input} /></label>
            <label className={`sm:col-span-2 ${label}`}>Selection note <span className="font-normal text-slate-400">(admin-only — why the selection team picked this student)</span><textarea name="selectionNote" defaultValue={s.selectionNote ?? ""} rows={3} className={input} /></label>
          </div>
        </Card>

        <Card className="mt-6 p-4">
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
            <label className={label}>Family mobile <span className="font-normal text-slate-400">(primary contact)</span><input name="familyMobile" defaultValue={s.familyMobile ?? ""} className={input} /></label>
            <label className={label}>Career goal<input name="careerGoal" defaultValue={s.careerGoal ?? ""} className={input} /></label>
            <label className={label}>Village<input name="addrVillage" defaultValue={s.addrVillage ?? ""} className={input} /></label>
            <label className={label}>Para<input name="addrPara" defaultValue={s.addrPara ?? ""} className={input} /></label>
            <label className={label}>Post office<input name="addrPostOffice" defaultValue={s.addrPostOffice ?? ""} className={input} /></label>
            <label className={label}>Thana<input name="addrThana" defaultValue={s.addrThana ?? ""} className={input} /></label>
            <label className={label}>District<input name="addrDistrict" defaultValue={s.addrDistrict ?? ""} className={input} /></label>
            <label className={label}>Ethnicity<input name="ethnicity" defaultValue={s.ethnicity ?? ""} className={input} /></label>
            <label className={label}>Orphan
              <select name="isOrphan" defaultValue={s.isOrphan ? "true" : "false"} className={input}><option value="false">No</option><option value="true">Yes</option></select>
            </label>
            <label className={label}>Father profession<input name="fatherProfession" defaultValue={s.fatherProfession ?? ""} className={input} /></label>
            <label className={label}>Father phone<input name="fatherPhone" defaultValue={s.fatherPhone ?? ""} className={input} /></label>
            <label className={label}>Mother profession<input name="motherProfession" defaultValue={s.motherProfession ?? ""} className={input} /></label>
            <label className={label}>Mother phone<input name="motherPhone" defaultValue={s.motherPhone ?? ""} className={input} /></label>
            <label className={label}>Family income<input name="familyIncome" defaultValue={s.familyIncome ?? ""} className={input} /></label>
            <label className={label}>Income source<input name="incomeSource" defaultValue={s.incomeSource ?? ""} className={input} /></label>
            <label className={label}>Guardian name<input name="guardianName" defaultValue={s.guardianName ?? ""} className={input} /></label>
            <label className={label}>Guardian mobile<input name="guardianMobile" defaultValue={s.guardianMobile ?? ""} className={input} /></label>
            <label className={label}>Guardian address<input name="guardianAddress" defaultValue={s.guardianAddress ?? ""} className={input} /></label>
            <label className={label}>Tutor name<input name="tutorName" defaultValue={s.tutorName ?? ""} className={input} /></label>
            <label className={label}>Tutor phone<input name="tutorPhone" defaultValue={s.tutorPhone ?? ""} className={input} /></label>
          </div>
          <button className={`mt-4 ${btnPrimary}`}>Save record</button>
        </Card>
      </form>

      {/* Education (per session) — each row individually editable + deletable */}
      <Card className="mt-6 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Education (per session)</h2>
        <EducationManager
          studentId={s.id}
          sessions={s.sessions.map((e) => ({ sessionId: e.sessionId, sessionLabel: e.session.label, institutionName: e.institutionName, grade: e.grade, roll: e.roll, formerRoll: e.formerRoll, totalStudent: e.totalStudent, degreeLevel: e.degreeLevel, resultSheetUrl: e.resultSheetUrl }))}
          options={sessions.map((a) => ({ id: a.id, label: a.label }))}
        />
      </Card>

      {/* Assigned mentor(s) */}
      <Card className="mt-6 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Mentor{s.assignments.length === 1 ? "" : "s"} ({s.assignments.length})</h2>
        {s.assignments.length === 0 ? <EmptyState>No mentor assigned.</EmptyState> : (
          <table className="w-full text-sm"><tbody>{s.assignments.map((a) => (
            <tr key={a.id} className="border-b border-slate-100">
              <td className="py-2">{a.mentor.user.name ?? a.mentor.user.email ?? "—"}</td>
              <td className="py-2 font-mono text-xs text-slate-500">{a.mentor.id}</td>
              <td className="py-2">assigned {new Date(a.assignedAt).toLocaleDateString()}</td>
            </tr>
          ))}</tbody></table>
        )}
      </Card>

      {/* Donors (admin sees real names) */}
      <Card className="mt-6 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Donors ({s.donations.length})</h2>
        {s.donations.length === 0 ? <EmptyState>No donations directed to this student.</EmptyState> : (
          <table className="w-full text-sm"><tbody>{s.donations.map((d, i) => <tr key={i} className="border-b border-slate-100"><td className="py-2">{d.donor.name}{d.donor.isAnonymous ? " (anon)" : ""}</td><td className="py-2 font-mono text-xs text-slate-500">{d.donor.id}</td><td className="py-2">{usd(d.amount - d.refundedAmount)}</td><td className="py-2">{new Date(d.occurredAt).toLocaleDateString()}</td><td className="py-2">{d.isRecurring ? "recurring" : ""}</td></tr>)}</tbody></table>
        )}
      </Card>

      {/* Installment series — yearly award paid monthly via bKash/Nagad/Rocket (Phase 7) */}
      <Card className="mt-6 p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Monthly installment series</h2>
        <p className="mb-3 max-w-2xl text-xs text-slate-500">
          Tracks a yearly award paid monthly via the live mobile-banking path (bKash / Nagad / Rocket). Mark
          each month paid as it arrives, with the transaction ID if you have it. This is a tracking layer — it
          does not move money on its own.
        </p>
        {seriesData ? (
          <>
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
              <span className="font-semibold">{seriesData.series.label}</span> — {seriesData.progress.paid} of {seriesData.progress.total} paid ·{" "}
              {usd(seriesData.progress.paidAmount)} of {usd(seriesData.progress.totalAmount)}
              {seriesData.progress.complete ? " · complete ✓" : seriesData.progress.nextDueMonth ? ` · next due ${seriesData.progress.nextDueMonth}` : ""}
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400"><th className="py-1">#</th><th className="py-1">Due</th><th className="py-1">Amount</th><th className="py-1">Status</th><th className="py-1">Mark paid</th></tr></thead>
              <tbody>
                {seriesData.installments.map((inst) => (
                  <tr key={inst.id} className="border-b border-slate-100 align-middle">
                    <td className="py-2">{inst.index}</td>
                    <td className="py-2 font-mono text-xs">{inst.dueMonth}</td>
                    <td className="py-2">{usd(inst.amount)}</td>
                    <td className="py-2">
                      {inst.paidAt
                        ? <span className="text-emerald-700">paid {new Date(inst.paidAt).toLocaleDateString()}{inst.txnRef ? ` · ${inst.txnRef}` : ""}</span>
                        : <span className="text-slate-400">outstanding</span>}
                    </td>
                    <td className="py-2">
                      {inst.paidAt ? <span className="text-xs text-slate-300">—</span> : (
                        <form action={markInstallmentPaidAction} className="flex flex-wrap items-center gap-1.5">
                          <input type="hidden" name="studentId" value={s.id} />
                          <input type="hidden" name="installmentId" value={inst.id} />
                          <input name="txnRef" placeholder="txn ref (optional)" className={`${input} h-8 w-40 py-1 text-xs`} />
                          <select name="method" defaultValue="bkash" className={`${input} h-8 w-24 py-1 text-xs`}><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="rocket">Rocket</option><option value="bank">Bank</option><option value="cash">Cash</option><option value="other">Other</option></select>
                          <button className={`${btnSecondary} h-8 px-2 py-1 text-xs`}>Mark paid</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <form action={createSeriesAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="studentId" value={s.id} />
            <label className={label}>Label<input name="label" defaultValue={`${thisYear} monthly award`} className={input} /></label>
            <label className={label}>Months<input name="count" type="number" min={1} max={24} defaultValue={12} className={input} /></label>
            <label className={label}>Per installment (USD)<input name="perInstallment" type="number" step="0.01" defaultValue={dollars(s.perInstallment)} className={input} /></label>
            <label className={label}>Yearly total (USD)<input name="totalAmount" type="number" step="0.01" defaultValue={s.perInstallment ? dollars(s.perInstallment * 12) : dollars(s.requireAmount)} className={input} /></label>
            <label className={label}>Start year<input name="startYear" type="number" min={2000} max={2100} defaultValue={thisYear} className={input} /></label>
            <label className={label}>Start month
              <select name="startMonth" defaultValue={1} className={input}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select>
            </label>
            <p className="sm:col-span-2 text-xs text-slate-500">Yearly total must equal per-installment × months (each month is the same amount).</p>
            <div className="sm:col-span-2"><button className={btnPrimary}>Create installment series</button></div>
          </form>
        )}
      </Card>

      {/* Danger zone — permanent erasure. Separate from the soft active/verified toggles above. */}
      <Card className="mt-6 border-red-200 p-4">
        <h2 className="mb-1 text-sm font-semibold text-red-800">Danger zone — permanently delete</h2>
        <p className="mb-3 max-w-2xl text-xs text-slate-500">
          Irreversibly erases this student record, their application(s), per-session education, mentor
          assignments, evaluations, and login (if any), plus their uploaded photo and documents. Donation
          history is kept but un-linked from the student. This cannot be undone — for a temporary hide, use
          &ldquo;inactive&rdquo; or &ldquo;hidden from website&rdquo; above instead.
        </p>
        <form action={deleteStudentAction} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="studentId" value={s.id} />
          <label className={label}>Type <span className="font-semibold text-red-700">DELETE</span> to confirm<input name="confirm" autoComplete="off" placeholder="DELETE" className={input} /></label>
          <label className={label}>Reason (audited)<input name="reason" placeholder="e.g. duplicate record / erasure request" className={input} /></label>
          <div className="sm:col-span-2">
            <ConfirmSubmit className={btnDanger} message="Permanently delete this student and their login? This CANNOT be undone.">Delete permanently</ConfirmSubmit>
          </div>
        </form>
      </Card>
    </div>
  );
}
