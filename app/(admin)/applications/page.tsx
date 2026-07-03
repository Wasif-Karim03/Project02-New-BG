import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listPendingApplications } from "@/lib/services/application-review";
import { approveApplicationAction, rejectApplicationAction } from "./actions";

export default async function ApplicationsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/api/auth/signin?callbackUrl=/applications");
  }
  const apps = await listPendingApplications();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Student applications</h1>
      <p className="mt-1 text-sm text-black/60">Email-verified applications awaiting review. Approving creates the student record and activates the account; rejecting requires a reason. Every decision is audited.</p>

      {apps.length === 0 ? (
        <p className="mt-6 text-sm text-black/40">No applications awaiting review.</p>
      ) : (
        <ul className="mt-6 divide-y divide-black/10 rounded-lg border border-black/10">
          {apps.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="text-sm">
                <Link href={`/applications/${a.id}`} className="font-medium text-blue-700 underline">{a.nameEn ?? "(no name)"}</Link>{" "}
                <span className="text-black/50">· {a.user.email} · {a.schoolName ?? "—"}, {a.addrDistrict ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <form action={approveApplicationAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="rounded bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800">Approve</button>
                </form>
                <form action={rejectApplicationAction} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={a.id} />
                  <input name="reason" required placeholder="reason" className="w-36 rounded border border-black/15 px-2 py-1 text-xs" />
                  <button type="submit" className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800">Reject</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
