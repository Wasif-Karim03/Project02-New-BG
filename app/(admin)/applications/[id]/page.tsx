import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getApplicationForReview } from "@/lib/services/application-review";
import { approveApplicationAction, rejectApplicationAction } from "../actions";

const Row = ({ k, val }: { k: string; val: unknown }) =>
  val === null || val === undefined || val === "" ? null : (
    <div className="flex gap-2 py-1 text-sm"><span className="w-56 shrink-0 text-black/50">{k}</span><span>{String(val)}</span></div>
  );

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/api/auth/signin?callbackUrl=/applications");
  }
  const { id } = await params;
  const a = await getApplicationForReview(session.user.id, id).catch(() => null);
  if (!a) notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">{a.nameEn ?? "Application"}</h1>
      <p className="mt-1 text-sm text-black/50">{a.user.email} · status {a.status} · verified {a.emailVerifiedAt ? new Date(a.emailVerifiedAt).toLocaleString() : "—"}</p>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-black/50">Student</h2>
        <Row k="Name (Bn / En)" val={[a.nameBn, a.nameEn].filter(Boolean).join(" / ")} />
        <Row k="Father (Bn / En)" val={[a.fatherNameBn, a.fatherNameEn].filter(Boolean).join(" / ")} />
        <Row k="Mother (Bn / En)" val={[a.motherNameBn, a.motherNameEn].filter(Boolean).join(" / ")} />
        <Row k="Family mobile" val={a.familyMobile} /><Row k="Gender" val={a.gender} />
        <Row k="Orphan" val={a.isOrphan ? "Yes" : "No"} /><Row k="Ethnicity" val={a.ethnicity} />
      </section>
      <section className="mt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-black/50">Education</h2>
        <Row k="School" val={a.schoolName} /><Row k="Class needed / current" val={[a.classNeeded, a.currentClass].filter(Boolean).join(" / ")} />
        <Row k="Roll / total" val={[a.roll, a.totalStudents].filter(Boolean).join(" / ")} />
        <Row k="Favorite subject" val={a.favoriteSubject} /><Row k="Math / English" val={[a.mathMarks, a.englishMarks].filter(Boolean).join(" / ")} />
        <Row k="Recent govt exam" val={a.recentGovtExam} /><Row k="Career goal" val={a.careerGoal} /><Row k="Hobbies" val={a.hobbies} />
      </section>
      <section className="mt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-black/50">Family &amp; social</h2>
        <Row k="Address" val={[a.addrVillage, a.addrPara, a.addrPostOffice, a.addrThana, a.addrDistrict].filter(Boolean).join(", ")} />
        <Row k="Local guardian" val={[a.localGuardianName, a.localGuardianPhone].filter(Boolean).join(" · ")} />
        <Row k="Tutor" val={[a.tutorName, a.tutorPhone].filter(Boolean).join(" · ")} />
        <Row k="Family (M / F)" val={[a.familyMembersMale, a.familyMembersFemale].filter((x) => x != null).join(" / ")} />
        <Row k="Monthly income" val={a.monthlyFamilyIncome} />
        <Row k="Father profession / income" val={[a.fatherProfession, a.fatherIncome].filter(Boolean).join(" · ")} />
        <Row k="Mother profession / income" val={[a.motherProfession, a.motherIncome].filter(Boolean).join(" · ")} />
      </section>
      <section className="mt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-black/50">Documents</h2>
        <Row k="Result sheet" val={a.resultSheetUrl} /><Row k="Photo" val={a.photoUrl} /><Row k="Agreed to terms" val={a.agreedTerms ? "Yes" : "No"} />
      </section>

      {a.status === "EMAIL_VERIFIED" && (
        <div className="mt-8 flex items-center gap-3 border-t border-black/10 pt-6">
          <form action={approveApplicationAction}>
            <input type="hidden" name="id" value={a.id} />
            <button type="submit" className="rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">Approve → create student</button>
          </form>
          <form action={rejectApplicationAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={a.id} />
            <input name="reason" required placeholder="reason for rejection" className="w-56 rounded border border-black/15 px-2 py-1.5 text-sm" />
            <button type="submit" className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">Reject</button>
          </form>
        </div>
      )}
    </main>
  );
}
