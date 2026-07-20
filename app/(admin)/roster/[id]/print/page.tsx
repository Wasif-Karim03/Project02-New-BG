import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getStudentRecord } from "@/lib/services/student-record";
import { PrintButton } from "./PrintButton";

const usd = (m: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(m / 100);
const d = (v: Date | string | null | undefined) => (v ? new Date(v).toLocaleDateString() : "—");

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="break-inside-avoid">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm text-slate-900">{value || "—"}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="mb-2 border-b border-slate-300 pb-1 text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h2>
      {children}
    </section>
  );
}

// Printable / downloadable single-student record. Admin uses the browser's
// print → Save as PDF. Chrome (nav etc.) is hidden via the `no-print` styles.
export default async function StudentPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/roster");
  const { id } = await params;
  const s = await getStudentRecord(id);
  if (!s) notFound();

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-slate-900 print:p-0">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 16mm; } }`}</style>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Bridging Generations · Student record</p>
          <h1 className="mt-1 text-2xl font-bold">{s.fullName || s.firstName}</h1>
          <p className="text-sm text-slate-600">{s.registrationId ?? "—"}{s.slug ? ` · ${s.slug}` : ""} · {s.status}</p>
        </div>
        <PrintButton />
      </div>

      <Section title="Identity">
        <div className="grid grid-cols-3 gap-3">
          <Field label="First name" value={s.firstName} />
          <Field label="Full name" value={s.fullName} />
          <Field label="Date of birth" value={d(s.dob)} />
          <Field label="Gender" value={s.gender} />
          <Field label="Ethnicity" value={s.ethnicity} />
          <Field label="Orphan" value={s.isOrphan ? "Yes" : "No"} />
          <Field label="Father name" value={s.fatherName} />
          <Field label="Mother name" value={s.motherName} />
          <Field label="Career goal" value={s.careerGoal} />
        </div>
      </Section>

      <Section title="Family & contact">
        <div className="grid grid-cols-3 gap-3">
          <Field label="District" value={s.addrDistrict} />
          <Field label="Father profession" value={s.fatherProfession} />
          <Field label="Father phone" value={s.fatherPhone} />
          <Field label="Mother profession" value={s.motherProfession} />
          <Field label="Mother phone" value={s.motherPhone} />
          <Field label="Family income" value={s.familyIncome} />
          <Field label="Income source" value={s.incomeSource} />
          <Field label="Guardian name" value={s.guardianName} />
          <Field label="Guardian mobile" value={s.guardianMobile} />
          <Field label="Tutor name" value={s.tutorName} />
          <Field label="Tutor phone" value={s.tutorPhone} />
        </div>
      </Section>

      {s.selectionNote && (
        <Section title="Selection note (admin)">
          <p className="whitespace-pre-wrap text-sm">{s.selectionNote}</p>
        </Section>
      )}

      <Section title="Education (per session)">
        {s.sessions.length === 0 ? <p className="text-sm text-slate-500">No education rows.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
              <th className="py-1">Session</th><th>Institution</th><th>Grade</th><th>Degree</th><th>Roll</th><th>Total</th><th>Result</th>
            </tr></thead>
            <tbody>{s.sessions.map((e) => (
              <tr key={e.id} className="border-t border-slate-200">
                <td className="py-1">{e.session.label}</td><td>{e.institutionName ?? "—"}</td><td>{e.grade ?? "—"}</td>
                <td>{e.degreeLevel ?? "—"}</td><td>{e.roll ?? "—"}</td><td>{e.totalStudent ?? "—"}</td>
                <td>{e.resultSheetUrl ? "✓" : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Section>

      <Section title="Mentor">
        {s.assignments.length === 0 ? <p className="text-sm text-slate-500">No mentor assigned.</p> : (
          <ul className="text-sm">{s.assignments.map((a) => (
            <li key={a.id}>{a.mentor.user.name ?? a.mentor.user.email ?? "—"} · <span className="font-mono text-xs">{a.mentor.id}</span> · assigned {d(a.assignedAt)}</li>
          ))}</ul>
        )}
      </Section>

      <Section title="Donors">
        {s.donations.length === 0 ? <p className="text-sm text-slate-500">No donations directed to this student.</p> : (
          <ul className="text-sm">{s.donations.map((dn, i) => (
            <li key={i}>{dn.donor.name}{dn.donor.isAnonymous ? " (anon)" : ""} · <span className="font-mono text-xs">{dn.donor.id}</span> · {usd(dn.amount - dn.refundedAmount)} · {d(dn.occurredAt)}</li>
          ))}</ul>
        )}
      </Section>
    </div>
  );
}
