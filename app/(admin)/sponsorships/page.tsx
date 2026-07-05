import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listActiveSponsorships } from "@/lib/services/subscriptions";
import { page, PageHeader, Card, EmptyState } from "../_components/ui";

const usd = (minor: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);

export default async function SponsorshipsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/login?callbackUrl=/sponsorships");
  }

  const subs = await listActiveSponsorships();

  return (
    <div className={page}>
      <PageHeader
        title="Active sponsorships"
        description="Recurring donations currently ACTIVE. Canceled/past-due subscriptions drop off this list."
      />

      {subs.length === 0 ? (
        <EmptyState>No active sponsorships.</EmptyState>
      ) : (
        <Card className="p-4">
          <ul className="divide-y divide-slate-100">
            {subs.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="text-slate-900">
                  <strong>{s.donor.name}</strong> · {usd(s.amount, s.currency)}/{s.interval}
                </span>
                <span className="text-slate-600">{s.student?.firstName ?? s.project?.title ?? "General"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
