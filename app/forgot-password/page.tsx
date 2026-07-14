import Link from "next/link";
import { forgotPasswordAction } from "./actions";

type SearchParams = Promise<{ sent?: string; error?: string }>;

export default async function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const { sent, error } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-6 py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2-text">Bridging Generations</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Reset your password</h1>
      {sent ? (
        <div className="mt-6 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm text-accent">
          If an account exists for that email, we&apos;ve sent a reset link. Check your inbox (in dev, the link prints to the server console).
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-2">Enter your email and we&apos;ll send a reset link.</p>
          {error && <div className="mt-6 rounded-xl border border-accent-2/30 bg-accent-2/10 px-4 py-3 text-sm text-accent-2-text">{decodeURIComponent(error)}</div>}
          <form action={forgotPasswordAction} className="mt-6 grid gap-4 rounded-2xl border border-hairline bg-ground-2 p-6 shadow-sm">
            <label className="block text-sm font-medium text-ink-2">Email
              <input name="email" type="email" required className="mt-1.5 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40" />
            </label>
            <button type="submit" className="rounded-full bg-accent-2 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-2-hover">Send reset link</button>
          </form>
        </>
      )}
      <p className="mt-6 text-sm"><Link href="/login" className="font-medium text-accent-2-text underline underline-offset-2 hover:text-accent-2-hover">Back to sign in</Link></p>
    </main>
  );
}
