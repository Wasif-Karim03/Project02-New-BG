import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getStudentPortal } from "@/lib/services/student-portal";

const usd = (m: number, c = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(m / 100);

export default async function StudentPortalPage() {
  const session = await auth();
  if (!session?.user || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/student");
  if (session.user.role !== "STUDENT") redirect("/");

  const portal = await getStudentPortal(session.user.id);
  if (!portal) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2-text">Student portal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Your student profile</h1>
        <div className="mt-6 rounded-2xl border border-hairline bg-ground-2 p-6 shadow-sm">
          <p className="text-sm leading-relaxed text-ink-2">Your application hasn&apos;t been finalized into a student record yet. Once an admin approves your application, your profile and sponsorships will appear here.</p>
        </div>
      </main>
    );
  }

  const { student, gifts, totalReceived, sponsorCount, hasActiveSponsorship } = portal;
  const goalPct =
    student.requireAmount && student.requireAmount > 0
      ? Math.min(100, Math.round((totalReceived / student.requireAmount) * 100))
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2-text">Student portal</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Hello, {student.firstName} 👋</h1>
      <p className="mt-2 text-sm text-ink-2">Here&apos;s an overview of your profile and the support you&apos;ve received.</p>

      <section className="mt-8 grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-hairline bg-ground-2 p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-2">Profile</div>
          <div className="mt-3 text-lg font-semibold text-ink">{student.schoolName ?? "School —"}</div>
          {student.district && <div className="mt-0.5 text-sm text-ink-2">{student.district}</div>}
          {student.careerGoal && <div className="mt-3 text-sm text-ink-2">Goal: <span className="text-ink">{student.careerGoal}</span></div>}
          <div className="mt-4">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${hasActiveSponsorship ? "bg-accent/10 text-accent" : "bg-accent-3/20 text-accent-2-text"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${hasActiveSponsorship ? "bg-accent" : "bg-accent-2"}`} />
              {hasActiveSponsorship ? "Sponsored" : "Awaiting sponsor"}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-hairline bg-ground-2 p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-2">Support received</div>
          <div className="mt-3 text-4xl font-bold tracking-tight text-ink">{usd(totalReceived)}</div>
          <div className="mt-1 text-sm text-ink-2">
            {sponsorCount} sponsor{sponsorCount === 1 ? "" : "s"}
            {student.requireAmount ? ` · goal ${usd(student.requireAmount)}` : ""}
          </div>
          {goalPct !== null && (
            <div className="mt-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-ground-3">
                <div className="h-full rounded-full bg-accent-2" style={{ width: `${goalPct}%` }} />
              </div>
              <div className="mt-1.5 text-xs font-medium text-ink-2">{goalPct}% of goal reached</div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-hairline bg-ground-2 p-6 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-2-text">Your sponsors</h2>
        {gifts.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-hairline bg-ground-3/40 px-4 py-6 text-center text-sm text-ink-2">No sponsorships yet. When someone sponsors you, their gifts will show here.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-hairline">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-ground-3/50 text-left text-xs font-semibold uppercase tracking-wide text-ink-2">
                  <th className="px-4 py-3">Sponsor</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Date</th><th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {gifts.map((g, i) => (
                  <tr key={i} className="border-b border-hairline/60 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{g.donorName}</td>
                    <td className="px-4 py-3 text-ink">{usd(g.amount, g.currency)}</td>
                    <td className="px-4 py-3 text-ink-2">{new Date(g.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{g.recurring ? <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">recurring</span> : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs text-ink-2">Sponsors who chose to give anonymously appear as &ldquo;Anonymous&rdquo;.</p>
      </section>
    </main>
  );
}
