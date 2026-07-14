import { redirect } from "next/navigation";
import { getApplicantUserId } from "@/lib/apply-session";
import { resendCodeAction, verifyCodeAction } from "../actions";

type SearchParams = Promise<{ error?: string; resent?: string; dev?: string }>;

export default async function ApplyVerifyPage({ searchParams }: { searchParams: SearchParams }) {
  if (!(await getApplicantUserId())) redirect("/apply");
  const { error, resent, dev } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2-text">Bridging Generations</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Verify your email</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">We emailed a 6-digit code. Enter it below to submit your application. (In dev, the code is printed to the server console.)</p>
      {dev && <div className="mt-6 rounded-xl border border-accent-3/50 bg-accent-3/15 px-4 py-3 text-sm text-ink">Dev mode (no email provider): your code is <strong className="tracking-widest">{dev}</strong>.</div>}
      {resent && <div className="mt-6 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm text-accent">A new code was sent.</div>}
      {error && <div className="mt-6 rounded-xl border border-accent-2/30 bg-accent-2/10 px-4 py-3 text-sm text-accent-2-text">{decodeURIComponent(error)}</div>}

      <form action={verifyCodeAction} className="mt-6 flex items-end gap-3 rounded-2xl border border-hairline bg-ground-2 p-6 shadow-sm">
        <label className="block text-sm font-medium text-ink-2">Verification code
          <input name="code" inputMode="numeric" pattern="[0-9]*" maxLength={6} required className="mt-1.5 w-40 rounded-lg border border-hairline bg-white px-3 py-2.5 text-lg tracking-widest text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40" />
        </label>
        <button type="submit" className="rounded-full bg-accent-2 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-2-hover">Verify</button>
      </form>

      <form action={resendCodeAction} className="mt-4">
        <button type="submit" className="text-sm font-medium text-accent-2-text underline underline-offset-2 hover:text-accent-2-hover">Resend code</button>
      </form>
    </main>
  );
}
