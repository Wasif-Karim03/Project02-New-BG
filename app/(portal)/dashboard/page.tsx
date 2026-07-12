import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listDonorGivingHistory, listDonorSubscriptions } from "@/lib/services/subscriptions";
import { cancelSubscriptionAction } from "./actions";

const usd = (minor: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);

type SearchParams = Promise<{ error?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/dashboard");
  const { error } = await searchParams;

  const [subs, history] = await Promise.all([
    listDonorSubscriptions(session.user.id),
    listDonorGivingHistory(session.user.id),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Your giving</h1>
      {error && <div className="mt-4 rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">{decodeURIComponent(error)}</div>}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50">Recurring sponsorships</h2>
        {subs.length === 0 ? (
          <p className="mt-2 text-sm text-black/40">No active sponsorships.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/10 rounded-lg border border-black/10">
            {subs.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span>
                  {usd(s.amount, s.currency)}/{s.interval} ·{" "}
                  {s.student?.firstName ?? s.project?.title ?? "General"}{" "}
                  <span className="rounded bg-black/5 px-1.5 py-0.5 text-xs">{s.status}</span>
                </span>
                {s.status === "ACTIVE" && (
                  <form action={cancelSubscriptionAction}>
                    <input type="hidden" name="subscriptionId" value={s.id} />
                    <button type="submit" className="rounded border border-black/20 px-3 py-1.5 text-xs font-semibold hover:bg-black/5">Cancel</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50">Giving history</h2>
        <p className="mt-0.5 text-xs text-black/40">Recipient status updates live as students are funded — this always reflects the latest data.</p>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-black/40">No donations yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/10 rounded-lg border border-black/10">
            {history.map((d) => {
              const toWhom = d.student?.firstName ?? d.project?.title ?? "Where needed most";
              const funded = d.studentFunded ?? 0;
              const goal = d.student?.requireAmount ?? 0;
              return (
                <li key={d.id} className="p-4 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">{usd(d.amount, d.currency)}{d.refundedAmount > 0 ? ` (−${usd(d.refundedAmount, d.currency)})` : ""} · {toWhom}</span>
                    <span className="text-xs text-black/50">{new Date(d.occurredAt).toLocaleDateString()} · {d.isRecurring ? "recurring" : "one-time"} · {d.status}</span>
                  </div>
                  {d.student ? (
                    <div className="mt-1 text-xs text-black/60">
                      {toWhom}&apos;s status: {goal > 0 ? <><strong>{usd(funded)}</strong> funded of <strong>{usd(goal)}</strong>{funded >= goal ? " · fully funded ✓" : ""}</> : `record ${d.student.status.toLowerCase()}`}
                    </div>
                  ) : null}
                  {d.tributeName ? (
                    <div className="mt-1 flex items-center gap-2 text-xs text-black/60">
                      {d.tributeImageUrl ? (
                        // biome-ignore lint/performance/noImgElement: small tribute thumbnail
                        <img src={d.tributeImageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : null}
                      <span>{d.tributeType === "memory" ? "In memory of" : "In honor of"} <strong>{d.tributeName}</strong>{d.tributeMessage ? ` — ${d.tributeMessage}` : ""}</span>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
