import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listPendingDonations } from "@/lib/services/donation-claims";
import { confirmDonationAction, declineDonationAction } from "./actions";
import { page, PageHeader, Card, EmptyState, Notice, btnPrimary, btnDanger, input } from "../_components/ui";
import { ConfirmSubmit } from "../_components/ConfirmSubmit";

const usd = (m: number, c = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(m / 100);

export default async function DonationsPendingPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/login?callbackUrl=/donations-pending");
  }
  const { ok, error } = await searchParams;
  const pending = await listPendingDonations();

  return (
    <div className={page}>
      <PageHeader title="Pending donations" description="Gifts donors reported sending (mobile banking / bank / cash). Verify the money arrived, then confirm — confirming counts it toward totals and emails a receipt. Declining requires a reason. All audited." />

      <Notice ok={ok} error={error} />

      {pending.length === 0 ? (
        <EmptyState>No pending donations.</EmptyState>
      ) : (
        <Card className="divide-y divide-slate-100">
          {pending.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="text-sm">
                <span className="font-semibold text-slate-900">{usd(d.amount, d.currency)}</span>{" "}
                <span className="text-slate-600">from {d.donor.name}{d.donor.email ? ` (${d.donor.email})` : ""}</span>{" "}
                <span className="text-slate-500">→ {d.student?.firstName ?? d.project?.title ?? "General"}</span>
                <div className="text-xs text-slate-400">{d.note}</div>
              </div>
              <div className="flex items-center gap-2">
                <form action={confirmDonationAction}><input type="hidden" name="id" value={d.id} /><button className={btnPrimary}>Confirm</button></form>
                <form action={declineDonationAction} className="flex items-center gap-1"><input type="hidden" name="id" value={d.id} /><input name="reason" required placeholder="reason" className={`w-32 ${input}`} /><ConfirmSubmit className={btnDanger} message="Decline this donation claim? It will be marked FAILED.">Decline</ConfirmSubmit></form>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
