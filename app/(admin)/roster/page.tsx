import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listStudentsForAdmin } from "@/lib/services/student-record";
import { deactivateAllAction } from "./actions";
import { page, PageHeader, Card, Badge, EmptyState, btnDanger } from "../_components/ui";
import { ConfirmSubmit } from "../_components/ConfirmSubmit";

export default async function RosterPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/login?callbackUrl=/roster");
  }
  const students = await listStudentsForAdmin();

  return (
    <div className={page}>
      <PageHeader
        title="Student roster"
        description="All student records. Click one to edit its backend record (registration, funding plan, per-session education, contacts, verified/active). Year-end deactivation flips every active student to inactive (runs automatically on Dec 30 once the cron is wired)."
      >
        <form action={deactivateAllAction}>
          <ConfirmSubmit className={btnDanger} message="Deactivate ALL active students? Every student will need to re-enroll for the new session. This is audited.">Run year-end deactivation</ConfirmSubmit>
        </form>
      </PageHeader>

      {students.length === 0 ? (
        <EmptyState>No student records yet.</EmptyState>
      ) : (
        <Card className="p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2">Student</th>
                <th className="py-2">Registration</th>
                <th className="py-2">Status</th>
                <th className="py-2">Verified</th>
                <th className="py-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="py-2">
                    <Link href={`/roster/${s.id}`} className="font-medium text-slate-900 hover:underline">{s.firstName}</Link>
                  </td>
                  <td className="py-2 text-slate-600">{s.registrationId ?? "—"}</td>
                  <td className="py-2"><Badge tone={s.status === "ACTIVE" ? "green" : s.status === "PENDING" ? "amber" : "neutral"}>{s.status}</Badge></td>
                  <td className="py-2"><Badge tone={s.verified ? "green" : "neutral"}>{s.verified ? "verified" : "unverified"}</Badge></td>
                  <td className="py-2"><Badge tone={s.active ? "green" : "red"}>{s.active ? "active" : "inactive"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
