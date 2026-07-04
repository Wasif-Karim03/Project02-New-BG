import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listPendingDonations } from "@/lib/services/donation-claims";
import { confirmDonationAction, declineDonationAction } from "./actions";

const usd = (m: number, c = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(m / 100);

export default async function DonationsPendingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/login?callbackUrl=/donations-pending");
  }
  const pending = await listPendingDonations();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Pending donations</h1>
      <p className="mt-1 text-sm text-black/60">Gifts donors reported sending (mobile banking / bank / cash). Verify the money arrived, then confirm — confirming counts it toward totals and emails a receipt. Declining requires a reason. All audited.</p>

      {pending.length === 0 ? (
        <p className="mt-6 text-sm text-black/40">No pending donations.</p>
      ) : (
        <ul className="mt-6 divide-y divide-black/10 rounded-lg border border-black/10">
          {pending.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="text-sm">
                <span className="font-semibold">{usd(d.amount, d.currency)}</span>{" "}
                <span className="text-black/60">from {d.donor.name}{d.donor.email ? ` (${d.donor.email})` : ""}</span>{" "}
                <span className="text-black/50">→ {d.student?.firstName ?? d.project?.title ?? "General"}</span>
                <div className="text-xs text-black/40">{d.note}</div>
              </div>
              <div className="flex items-center gap-2">
                <form action={confirmDonationAction}><input type="hidden" name="id" value={d.id} /><button className="rounded bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800">Confirm</button></form>
                <form action={declineDonationAction} className="flex items-center gap-1"><input type="hidden" name="id" value={d.id} /><input name="reason" required placeholder="reason" className="w-32 rounded border border-black/15 px-2 py-1 text-xs" /><button className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800">Decline</button></form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
