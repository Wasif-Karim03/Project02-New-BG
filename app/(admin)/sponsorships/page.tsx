import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listActiveSponsorships } from "@/lib/services/subscriptions";

const usd = (minor: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);

export default async function SponsorshipsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/api/auth/signin?callbackUrl=/sponsorships");
  }

  const subs = await listActiveSponsorships();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Active sponsorships</h1>
      <p className="mt-1 text-sm text-black/60">Recurring donations currently ACTIVE. Canceled/past-due subscriptions drop off this list.</p>

      {subs.length === 0 ? (
        <p className="mt-6 text-sm text-black/40">No active sponsorships.</p>
      ) : (
        <ul className="mt-6 divide-y divide-black/10 rounded-lg border border-black/10">
          {subs.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <span>
                <strong>{s.donor.name}</strong> · {usd(s.amount, s.currency)}/{s.interval}
              </span>
              <span className="text-black/60">{s.student?.firstName ?? s.project?.title ?? "General"}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
