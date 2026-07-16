import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listPendingWallDonors } from "@/lib/services/donor-wall";
import { Badge, Card, EmptyState, Notice, PageHeader, btnDanger, btnPrimary, page } from "../_components/ui";
import { approveDonorWallAction, rejectDonorWallAction } from "./actions";

const usd = (m: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(m / 100);

export default async function DonorApprovalsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") redirect("/login?callbackUrl=/donor-approvals");
  const { ok, error } = await searchParams;
  const donors = await listPendingWallDonors();

  return (
    <div className={page}>
      <PageHeader
        title="Donor approvals"
        description="Donors who asked to appear on the public Donors page. Approving publishes their name, photo, and message on the wall. Declining just keeps them off the wall — their account and donations are unaffected. Anonymous donors never appear here. All actions are audited."
      />

      <Notice ok={ok} error={error} />

      {donors.length === 0 ? (
        <EmptyState>No donors awaiting wall review.</EmptyState>
      ) : (
        <div className="space-y-4">
          {donors.map((d) => (
            <Card key={d.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-4">
                  {d.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-only same-origin donor photo pending approval
                    <img src={d.avatarUrl} alt="" className="h-20 w-20 shrink-0 rounded-full border border-slate-200 object-cover" />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-semibold text-slate-500">{d.name.charAt(0).toUpperCase()}</div>
                  )}
                  <div>
                    <div className="text-base font-semibold text-slate-900">{d.name}</div>
                    {d.email ? <div className="text-xs text-slate-500">{d.email}</div> : null}
                    {d.phone ? <div className="text-xs text-slate-500">{d.phone}</div> : null}
                    {d.avatarUrl ? (
                      <a href={d.avatarUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500">Open full size</a>
                    ) : null}
                  </div>
                </div>
                <Badge tone="amber">Awaiting wall review</Badge>
              </div>

              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
                <div className="flex gap-2 py-0.5 text-sm"><span className="w-28 shrink-0 text-slate-500">Given</span><span className="text-slate-900">{usd(d.totalGiven)} · {d.giftCount} {d.giftCount === 1 ? "gift" : "gifts"}</span></div>
                {d.wallTier ? <div className="flex gap-2 py-0.5 text-sm"><span className="w-28 shrink-0 text-slate-500">Tier</span><span className="text-slate-900">{d.wallTier}</span></div> : null}
              </dl>
              {d.wallMessage ? <p className="mt-3 text-sm text-slate-700"><span className="text-slate-500">Message: </span>{d.wallMessage}</p> : null}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <form action={approveDonorWallAction}><input type="hidden" name="id" value={d.id} /><button className={btnPrimary}>Approve for wall</button></form>
                <form action={rejectDonorWallAction}><input type="hidden" name="id" value={d.id} /><button className={btnDanger}>Decline</button></form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
