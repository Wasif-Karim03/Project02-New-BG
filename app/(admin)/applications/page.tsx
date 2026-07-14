import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listPendingApplications } from "@/lib/services/application-review";
import { approveApplicationAction, rejectApplicationAction } from "./actions";
import { page, PageHeader, Card, EmptyState, Notice, btnPrimary, btnDanger, input } from "../_components/ui";

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/login?callbackUrl=/applications");
  }
  const { ok, error } = await searchParams;
  const apps = await listPendingApplications();

  return (
    <div className={page}>
      <PageHeader
        title="Student applications"
        description="Email-verified applications awaiting review. Approving creates the student record and activates the account; rejecting requires a reason. Every decision is audited."
      />

      <Notice ok={ok} error={error} />

      {apps.length === 0 ? (
        <EmptyState>No applications awaiting review.</EmptyState>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {apps.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  {a.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-only auth-gated same-origin thumbnail
                    <img src={a.photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full border border-slate-200 object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">{(a.nameEn ?? "?").charAt(0).toUpperCase()}</div>
                  )}
                  <div className="min-w-0">
                    <Link href={`/applications/${a.id}`} className="font-medium text-slate-900 hover:underline">{a.nameEn ?? "(no name)"}</Link>
                    <p className="truncate text-xs text-slate-500">{a.user.email} · {a.schoolName ?? "—"}, {a.addrDistrict ?? "—"}</p>
                  </div>
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
