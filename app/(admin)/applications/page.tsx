import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listPendingApplications } from "@/lib/services/application-review";
import { approveApplicationAction, rejectApplicationAction } from "./actions";
import { page, PageHeader, Card, EmptyState, btnPrimary, btnDanger, input } from "../_components/ui";

export default async function ApplicationsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/login?callbackUrl=/applications");
  }
  const apps = await listPendingApplications();

  return (
    <div className={page}>
      <PageHeader
        title="Student applications"
        description="Email-verified applications awaiting review. Approving creates the student record and activates the account; rejecting requires a reason. Every decision is audited."
      />

      {apps.length === 0 ? (
        <EmptyState>No applications awaiting review.</EmptyState>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {apps.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="text-sm">
                  <Link href={`/applications/${a.id}`} className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500">{a.nameEn ?? "(no name)"}</Link>{" "}
                  <span className="text-slate-500">· {a.user.email} · {a.schoolName ?? "—"}, {a.addrDistrict ?? "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <form action={approveApplicationAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className={btnPrimary}>Approve</button>
                  </form>
                  <form action={rejectApplicationAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={a.id} />
                    <input name="reason" required placeholder="reason" className={`${input} w-36`} />
                    <button type="submit" className={btnDanger}>Reject</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
