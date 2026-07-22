import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LARGE_DONATION_THRESHOLD_CENTS } from "@/lib/validation/donations";
import { startGiveCheckoutAction } from "../actions";
import { recipientQuery, resolveRecipient } from "../recipient";
import { ConfirmLargeGiftButton } from "../_components/ConfirmLargeGiftButton";

type SearchParams = Promise<{ student?: string; project?: string; error?: string; canceled?: string }>;
const f = "mt-1 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40";
const lbl = "block text-xs font-medium text-ink-2";
const usd = (m: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(m / 100);

export default async function GiveCheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const { student, project, error, canceled } = await searchParams;
  const recipient = await resolveRecipient({ student, project });

  const session = await auth();
  // Prefill email for a signed-in donor so their gift attributes to their account.
  const me = session?.user?.role === "DONOR" ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } }) : null;

  // Preserve the recipient across the redirect back from a validation error / cancel.
  const ctx = recipientQuery({ student, project }, recipient);
  const designationType = recipient.kind;

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2-text">Bridging Generations</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
        {recipient.kind === "STUDENT" ? `Sponsor ${recipient.label}` : recipient.kind === "PROJECT" ? `Support ${recipient.label}` : "Give where it's needed most"}
      </h1>

      {/* Recipient card */}
      {recipient.kind === "STUDENT" ? (
        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-hairline bg-ground-2 p-4">
          {recipient.portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- same-origin, watermarked server-side
            <img src={recipient.portraitUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ground-3 text-lg font-semibold text-ink-2">{recipient.label.charAt(0)}</div>
          )}
          <div className="text-sm">
            <div className="font-semibold text-ink">{recipient.label}</div>
            {recipient.goal > 0 ? <div className="text-ink-2">{usd(recipient.funded)} raised of {usd(recipient.goal)} goal</div> : null}
          </div>
        </div>
      ) : recipient.kind === "PROJECT" ? (
        <div className="mt-4 rounded-2xl border border-hairline bg-ground-2 p-4 text-sm">
          <div className="font-semibold text-ink">{recipient.label}</div>
          {recipient.summary ? <p className="mt-1 text-ink-2">{recipient.summary}</p> : null}
        </div>
      ) : null}

      {canceled && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Payment canceled — nothing was charged. You can try again below.</div>}
      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{decodeURIComponent(error)}</div>}

      <form action={startGiveCheckoutAction} className="mt-6 grid gap-3">
        <input type="hidden" name="designationType" value={designationType} />
        {recipient.kind === "STUDENT" ? <input type="hidden" name="studentId" value={recipient.id} /> : null}
        {recipient.kind === "PROJECT" ? <input type="hidden" name="projectId" value={recipient.id} /> : null}
        <input type="hidden" name="returnTo" value={`/give/checkout${ctx}`} />

        <label className={lbl}>Amount (USD)
          <input name="amountDollars" type="number" min="0.50" step="0.01" required placeholder="50.00" className={f} />
          <span className="mt-1 block text-[11px] text-ink-2">Minimum $0.50. You&apos;ll enter your card securely on the next page.</span>
        </label>
        <label className={lbl}>Email (optional — for your receipt)<input name="donorEmail" type="email" defaultValue={me?.email ?? ""} className={f} /></label>

        {/* Optional tribute */}
        <details className="rounded-lg border border-hairline bg-ground-2 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-ink-2">Dedicate this gift (optional)</summary>
          <div className="mt-3 grid gap-3">
            <label className={lbl}>In honor / in memory of
              <select name="tributeType" defaultValue="" className={f}>
                <option value="">— not a tribute —</option>
                <option value="honor">In honor of</option>
                <option value="memory">In memory of</option>
              </select>
            </label>
            <label className={lbl}>Their name<input name="tributeName" maxLength={120} className={f} /></label>
            <label className={lbl}>Message (optional)<input name="tributeMessage" maxLength={500} className={f} /></label>
            <label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" name="tributePublic" /> Allow this tribute to appear publicly</label>
          </div>
        </details>

        <label className={lbl}>Note to the team (optional)<input name="note" maxLength={500} className={f} /></label>
        {me ? null : <label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" name="isAnonymous" /> List me anonymously (hide my name on the public donor wall)</label>}

        <ConfirmLargeGiftButton
          thresholdDollars={LARGE_DONATION_THRESHOLD_CENTS / 100}
          className="mt-1 rounded-full bg-accent-2 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-2-hover"
        >
          Continue to secure payment →
        </ConfirmLargeGiftButton>
        <p className="text-center text-[11px] text-ink-2">Payments are processed securely by Stripe. Your card details never touch our servers.</p>
      </form>

      <p className="mt-6 text-center text-xs text-ink-2"><Link href="/give" className="underline underline-offset-2 hover:text-ink">← Back</Link></p>
    </main>
  );
}
