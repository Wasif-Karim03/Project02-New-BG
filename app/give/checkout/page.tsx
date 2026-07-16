import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/services/settings";
import { submitClaimAction } from "../actions";
import { recipientQuery, resolveRecipient } from "../recipient";

type SearchParams = Promise<{ student?: string; project?: string; submitted?: string; error?: string }>;
const f = "mt-1 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40";
const lbl = "block text-xs font-medium text-ink-2";
const usd = (m: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(m / 100);

export default async function GiveCheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const { student, project, submitted, error } = await searchParams;
  const recipient = await resolveRecipient({ student, project });

  const [session, pay] = await Promise.all([auth(), getSettings(["pay_bkash", "pay_nagad", "pay_rocket", "pay_bank"])]);
  // Prefill for a signed-in donor so their gift attributes to their account.
  const me = session?.user?.role === "DONOR" ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true } }) : null;

  const CHANNELS = [
    { label: "bKash", value: pay.pay_bkash || process.env.NEXT_PUBLIC_PAY_BKASH },
    { label: "Nagad", value: pay.pay_nagad || process.env.NEXT_PUBLIC_PAY_NAGAD },
    { label: "Rocket", value: pay.pay_rocket || process.env.NEXT_PUBLIC_PAY_ROCKET },
    { label: "Bank transfer", value: pay.pay_bank || process.env.NEXT_PUBLIC_PAY_BANK },
  ].filter((c) => c.value);

  // Preserve the recipient across redirects (submit/error come back to this URL).
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

      {submitted && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Thank you! Your gift is recorded and pending verification. We&apos;ll confirm and email your receipt shortly.</div>}
      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{decodeURIComponent(error)}</div>}

      <section className="mt-6 rounded-lg border border-hairline bg-ground-2 p-4 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-2">How to send your gift</h2>
        {CHANNELS.length === 0 ? (
          <p className="mt-2 text-ink-2">Payment details will appear here once the organization sets them.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-ink">{CHANNELS.map((c) => <li key={c.label}><strong>{c.label}:</strong> {c.value}</li>)}</ul>
        )}
        <p className="mt-2 text-xs text-ink-2">Card payments are coming soon. For now, send your gift via one of the channels above, then record it below so we can match and receipt it.</p>
      </section>

      <form action={submitClaimAction} className="mt-6 grid gap-3">
        <input type="hidden" name="designationType" value={designationType} />
        {recipient.kind === "STUDENT" ? <input type="hidden" name="studentId" value={recipient.id} /> : null}
        {recipient.kind === "PROJECT" ? <input type="hidden" name="projectId" value={recipient.id} /> : null}
        <input type="hidden" name="returnTo" value={`/give/checkout${ctx}`} />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-2">Tell us about your gift</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={lbl}>Your name<input name="donorName" required defaultValue={me?.name ?? ""} className={f} /></label>
          <label className={lbl}>Email (for your receipt)<input name="donorEmail" type="email" defaultValue={me?.email ?? ""} className={f} /></label>
          <label className={lbl}>Amount (USD)<input name="amountDollars" type="number" min="1" step="0.01" required className={f} /></label>
          <label className={lbl}>Sent via
            <select name="method" required className={f} defaultValue="bkash">
              <option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="rocket">Rocket</option><option value="bank">Bank transfer</option><option value="cash">Cash</option><option value="other">Other</option>
            </select>
          </label>
          <label className={`${lbl} sm:col-span-2`}>Transaction ID / reference<input name="reference" placeholder="e.g. bKash TrxID" className={f} /></label>
        </div>
        <label className={lbl}>Note (optional)<input name="note" className={f} /></label>
        {me ? null : <label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" name="isAnonymous" /> List me anonymously (hide my name on the public wall)</label>}
        <button type="submit" className="mt-1 rounded-full bg-accent-2 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-2-hover">Record my gift</button>
      </form>

      <p className="mt-6 text-center text-xs text-ink-2"><Link href="/give" className="underline underline-offset-2 hover:text-ink">← Back</Link></p>
    </main>
  );
}
