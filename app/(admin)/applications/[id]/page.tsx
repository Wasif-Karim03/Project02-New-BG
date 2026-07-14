import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getApplicationForReview } from "@/lib/services/application-review";
import { approveApplicationAction, rejectApplicationAction } from "../actions";
import { page, PageHeader, Card, Badge, btnPrimary, btnDanger, input } from "../../_components/ui";

const Row = ({ k, val }: { k: string; val: unknown }) =>
  val === null || val === undefined || val === "" ? null : (
    <div className="flex gap-2 py-1 text-sm"><span className="w-56 shrink-0 text-slate-500">{k}</span><span className="text-slate-900">{String(val)}</span></div>
  );

const statusTone = (status: string): "green" | "amber" | "red" | "neutral" =>
  status === "EMAIL_VERIFIED" || status === "APPROVED" || status === "ACTIVE"
    ? "green"
    : status === "SUBMITTED" || status === "PENDING"
      ? "amber"
      : status === "REJECTED"
        ? "red"
        : "neutral";

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/login?callbackUrl=/applications");
  }
  const { id } = await params;
  const a = await getApplicationForReview(session.user.id, id).catch(() => null);
  if (!a) notFound();

  return (
    <div className={page}>
      <PageHeader
        title={a.nameEn ?? "Application"}
        description={`${a.user.email} · verified ${a.emailVerifiedAt ? new Date(a.emailVerifiedAt).toLocaleString() : "—"}`}
      >
        <Badge tone={statusTone(a.status)}>{a.status}</Badge>
      </PageHeader>

      {a.photoUrl ? (
        <div className="mb-4 flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-only preview of the applicant's uploaded photo (auth-gated same-origin) */}
          <img src={a.photoUrl} alt={a.nameEn ?? "Applicant photo"} className="h-40 w-32 shrink-0 rounded-lg border border-slate-200 object-cover" />
          <div className="text-sm">
            <p className="font-medium text-slate-900">Applicant photo</p>
            <p className="mt-1 text-slate-500">The photo submitted with this application.</p>
            <p className="mt-2 flex flex-wrap gap-3">
              <a href={a.photoUrl} target="_blank" rel="noreferrer" className="text-slate-700 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500">Open full size</a>
              {a.resultSheetUrl ? <a href={a.resultSheetUrl} target="_blank" rel="noreferrer" className="text-slate-700 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500">Result sheet</a> : null}
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        <Card className="p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Student</h2>
          <Row k="Name (Bn / En)" val={[a.nameBn, a.nameEn].filter(Boolean).join(" / ")} />
          <Row k="Father (Bn / En)" val={[a.fatherNameBn, a.fatherNameEn].filter(Boolean).join(" / ")} />
          <Row k="Mother (Bn / En)" val={[a.motherNameBn, a.motherNameEn].filter(Boolean).join(" / ")} />
          <Row k="Family mobile" val={a.familyMobile} /><Row k="Gender" val={a.gender} />
          <Row k="Orphan" val={a.isOrphan ? "Yes" : "No"} /><Row k="Ethnicity" val={a.ethnicity} />
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Education</h2>
          <Row k="School" val={a.schoolName} /><Row k="Class needed / current" val={[a.classNeeded, a.currentClass].filter(Boolean).join(" / ")} />
          <Row k="Roll / total" val={[a.roll, a.totalStudents].filter(Boolean).join(" / ")} />
          <Row k="Favorite subject" val={a.favoriteSubject} /><Row k="Math / English" val={[a.mathMarks, a.englishMarks].filter(Boolean).join(" / ")} />
          <Row k="Recent govt exam" val={a.recentGovtExam} /><Row k="Career goal" val={a.careerGoal} /><Row k="Hobbies" val={a.hobbies} />
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Family &amp; social</h2>
          <Row k="Address" val={[a.addrVillage, a.addrPara, a.addrPostOffice, a.addrThana, a.addrDistrict].filter(Boolean).join(", ")} />
          <Row k="Local guardian" val={[a.localGuardianName, a.localGuardianPhone].filter(Boolean).join(" · ")} />
          <Row k="Tutor" val={[a.tutorName, a.tutorPhone].filter(Boolean).join(" · ")} />
          <Row k="Family (M / F)" val={[a.familyMembersMale, a.familyMembersFemale].filter((x) => x != null).join(" / ")} />
          <Row k="Monthly income" val={a.monthlyFamilyIncome} />
          <Row k="Father profession / income" val={[a.fatherProfession, a.fatherIncome].filter(Boolean).join(" · ")} />
          <Row k="Mother profession / income" val={[a.motherProfession, a.motherIncome].filter(Boolean).join(" · ")} />
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Documents</h2>
          <div className="flex gap-2 py-1 text-sm"><span className="w-56 shrink-0 text-slate-500">Result sheet</span>{a.resultSheetUrl ? <a href={a.resultSheetUrl} target="_blank" rel="noreferrer" className="text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500">view</a> : <span className="text-slate-900">—</span>}</div>
          <div className="flex gap-2 py-1 text-sm"><span className="w-56 shrink-0 text-slate-500">Photo</span>{a.photoUrl ? <a href={a.photoUrl} target="_blank" rel="noreferrer" className="text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500">view</a> : <span className="text-slate-900">—</span>}</div>
          <Row k="Agreed to terms" val={a.agreedTerms ? "Yes" : "No"} />
        </Card>
      </div>

      {a.status === "EMAIL_VERIFIED" && (
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
          <form action={approveApplicationAction}>
            <input type="hidden" name="id" value={a.id} />
            <button type="submit" className={btnPrimary}>Approve → create student</button>
          </form>
          <form action={rejectApplicationAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={a.id} />
            <input name="reason" required placeholder="reason for rejection" className={`${input} w-56`} />
            <button type="submit" className={btnDanger}>Reject</button>
          </form>
        </div>
      )}
    </div>
  );
}
