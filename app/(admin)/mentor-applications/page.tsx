import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listMentorApplications } from "@/lib/services/mentor-applications";
import { Badge, Card, EmptyState, PageHeader, btnDanger, btnPrimary, input, page } from "../_components/ui";
import { approveMentorAction, rejectMentorAction } from "./actions";

const FIELDS: { key: string; label: string }[] = [
  { key: "phone", label: "Phone" }, { key: "profession", label: "Profession" }, { key: "organization", label: "Organization" },
  { key: "city", label: "City" }, { key: "country", label: "Country" }, { key: "education", label: "Education" },
  { key: "languages", label: "Languages" }, { key: "availability", label: "Availability" }, { key: "howHeard", label: "Heard via" },
];

export default async function MentorApplicationsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/mentor-applications");
  const apps = await listMentorApplications();

  return (
    <div className={page}>
      <PageHeader title="Mentor applications" description="People who applied to mentor and verified their email. Approve to create their mentor account (they can then sign in). All actions are audited." />

      {apps.length === 0 ? (
        <EmptyState>No mentor applications awaiting review.</EmptyState>
      ) : (
        <div className="space-y-4">
          {apps.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-slate-900">{a.fullName ?? a.user.name ?? "—"}</div>
                  <div className="text-xs text-slate-500">{a.user.email}</div>
                </div>
                <Badge tone="amber">Verified · awaiting review</Badge>
              </div>

              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
                {FIELDS.map((f) => {
                  const val = (a as Record<string, unknown>)[f.key] as string | null;
                  return val ? (
                    <div key={f.key} className="flex gap-2 py-0.5 text-sm">
                      <span className="w-28 shrink-0 text-slate-500">{f.label}</span>
                      <span className="text-slate-900">{val}</span>
                    </div>
                  ) : null;
                })}
              </dl>
              {a.experience ? <p className="mt-3 text-sm text-slate-700"><span className="text-slate-500">Experience: </span>{a.experience}</p> : null}
              {a.motivation ? <p className="mt-1 text-sm text-slate-700"><span className="text-slate-500">Motivation: </span>{a.motivation}</p> : null}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <form action={approveMentorAction}><input type="hidden" name="id" value={a.id} /><button className={btnPrimary}>Approve</button></form>
                <form action={rejectMentorAction} className="flex items-center gap-1"><input type="hidden" name="id" value={a.id} /><input name="reason" required placeholder="reason" className={`w-40 ${input}`} /><button className={btnDanger}>Reject</button></form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
