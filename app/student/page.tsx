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
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-bold">Your student profile</h1>
        <p className="mt-3 text-sm text-black/60">Your application hasn&apos;t been finalized into a student record yet. Once an admin approves your application, your profile and sponsorships will appear here.</p>
      </main>
    );
  }

  const { student, gifts, totalReceived, sponsorCount, hasActiveSponsorship } = portal;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Student portal</p>
      <h1 className="mt-1 text-2xl font-bold">Hello, {student.firstName}</h1>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-black/10 p-4 text-sm">
          <div className="text-xs text-black/50">Profile</div>
          <div className="mt-1">{student.schoolName ?? "School —"}{student.district ? ` · ${student.district}` : ""}</div>
          {student.careerGoal && <div className="mt-1 text-black/60">Goal: {student.careerGoal}</div>}
          <div className="mt-2"><span className="rounded bg-black/5 px-1.5 py-0.5 text-xs">{hasActiveSponsorship ? "Sponsored" : "Awaiting sponsor"}</span></div>
        </div>
        <div className="rounded-lg border border-black/10 p-4 text-sm">
          <div className="text-xs text-black/50">Support received</div>
          <div className="mt-1 text-2xl font-bold">{usd(totalReceived)}</div>
          <div className="mt-1 text-black/60">{sponsorCount} sponsor{sponsorCount === 1 ? "" : "s"}{student.requireAmount ? ` · goal ${usd(student.requireAmount)}` : ""}</div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50">Your sponsors</h2>
        {gifts.length === 0 ? (
          <p className="mt-2 text-sm text-black/40">No sponsorships yet. When someone sponsors you, their gifts will show here.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs uppercase text-black/50"><th className="py-2">Sponsor</th><th>Amount</th><th>Date</th><th></th></tr>
            </thead>
            <tbody>
              {gifts.map((g, i) => (
                <tr key={i} className="border-b border-black/5">
                  <td className="py-2">{g.donorName}</td>
                  <td>{usd(g.amount, g.currency)}</td>
                  <td>{new Date(g.date).toLocaleDateString()}</td>
                  <td>{g.recurring ? <span className="rounded bg-black/5 px-1.5 py-0.5 text-xs">recurring</span> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-black/40">Sponsors who chose to give anonymously appear as &ldquo;Anonymous&rdquo;.</p>
      </section>
    </main>
  );
}
