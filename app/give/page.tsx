import Link from "next/link";
import { auth } from "@/auth";
import { recipientQuery, resolveRecipient } from "./recipient";

type SearchParams = Promise<{ student?: string; project?: string }>;
const usd = (m: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(m / 100);

export default async function GivePage({ searchParams }: { searchParams: SearchParams }) {
  const { student, project } = await searchParams;
  const [recipient, session] = await Promise.all([resolveRecipient({ student, project }), auth()]);
  const ctx = recipientQuery({ student, project }, recipient);
  const checkoutHref = `/give/checkout${ctx}`;
  // next carries the full checkout URL (with recipient) through signup → verify → login.
  const signupHref = `/donor-signup?next=${encodeURIComponent(checkoutHref)}`;
  const isDonor = session?.user?.role === "DONOR" && session.user.status === "ACTIVE";

  const heading =
    recipient.kind === "STUDENT" ? `Sponsor ${recipient.label}` : recipient.kind === "PROJECT" ? `Support ${recipient.label}` : "Make a gift";

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2-text">Bridging Generations</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">{heading}</h1>

      {/* Recipient card */}
      {recipient.kind === "STUDENT" ? (
        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-hairline bg-ground-2 p-4">
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
        <div className="mt-5 rounded-2xl border border-hairline bg-ground-2 p-4 text-sm">
          <div className="font-semibold text-ink">{recipient.label}</div>
          {recipient.summary ? <p className="mt-1 text-ink-2">{recipient.summary}</p> : null}
        </div>
      ) : null}

      <p className="mt-6 text-sm leading-relaxed text-ink-2">How would you like to give?</p>

      {isDonor ? (
        // Already signed in — no need to choose; go straight to the gift.
        <Link href={checkoutHref} className="mt-4 block rounded-2xl bg-accent-2 px-5 py-4 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-2-hover">
          Continue to your gift →
        </Link>
      ) : (
        <div className="mt-4 grid gap-3">
          <Link href={checkoutHref} className="group rounded-2xl border border-hairline bg-ground-2 p-5 transition-colors hover:border-accent">
            <div className="text-base font-semibold text-ink">Donate as a guest</div>
            <p className="mt-1 text-sm text-ink-2">Give now without an account. We&apos;ll email your receipt. <span className="font-medium text-accent-2-text group-hover:underline">Continue →</span></p>
          </Link>
          <Link href={signupHref} className="group rounded-2xl border border-hairline bg-ground-2 p-5 transition-colors hover:border-accent">
            <div className="text-base font-semibold text-ink">Create a donor account</div>
            <p className="mt-1 text-sm text-ink-2">Track your donations, see who you support, and be recognized on our Donors page (or stay anonymous). <span className="font-medium text-accent-2-text group-hover:underline">Sign up &amp; continue →</span></p>
          </Link>
        </div>
      )}

      {!isDonor ? (
        <p className="mt-5 text-center text-sm text-ink-2">Already have an account? <Link href={`/login?callbackUrl=${encodeURIComponent(checkoutHref)}`} className="font-medium text-accent-2-text underline underline-offset-2 hover:text-accent-2-hover">Sign in</Link>.</p>
      ) : null}
    </main>
  );
}
