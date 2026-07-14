import Link from "next/link";
import { loginAction } from "./actions";

type SearchParams = Promise<{ error?: string; callbackUrl?: string; reset?: string; status?: string }>;

const STATUS_MESSAGES: Record<string, string> = {
  pending: "Your account is awaiting review. We'll email you as soon as it's approved.",
  rejected: "Your application was not approved. If you think this is a mistake, please contact us.",
  suspended: "Your account has been suspended. Please contact us for help.",
};

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { error, callbackUrl, reset, status } = await searchParams;
  const statusMessage = status ? STATUS_MESSAGES[status] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-6 py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2-text">Bridging Generations</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-2 text-sm text-ink-2">Sign in to your account to continue.</p>

      {reset && <div className="mt-6 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm text-accent">Password updated — sign in with your new password.</div>}
      {statusMessage && <div className="mt-6 rounded-xl border border-accent-3/50 bg-accent-3/15 px-4 py-3 text-sm text-ink">{statusMessage}</div>}
      {error && <div className="mt-6 rounded-xl border border-accent-2/30 bg-accent-2/10 px-4 py-3 text-sm text-accent-2-text">{error === "rate" ? "Too many attempts. Please wait a minute and try again." : "Email or password is incorrect."}</div>}

      <form action={loginAction} className="mt-6 grid gap-4 rounded-2xl border border-hairline bg-ground-2 p-6 shadow-sm">
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/"} />
        <label className="block text-sm font-medium text-ink-2">Email
          <input name="email" type="email" required autoComplete="email" className="mt-1.5 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40" />
        </label>
        <label className="block text-sm font-medium text-ink-2">Password
          <input name="password" type="password" required autoComplete="current-password" className="mt-1.5 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40" />
        </label>
        <button type="submit" className="mt-1 rounded-full bg-accent-2 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-2-hover">Sign in</button>
      </form>

      <p className="mt-4 text-sm"><Link href="/forgot-password" className="font-medium text-accent-2-text underline underline-offset-2 hover:text-accent-2-hover">Forgot your password?</Link></p>
      <p className="mt-3 text-sm text-ink-2">
        Applying for a scholarship? <Link href="/apply" className="font-medium text-accent-2-text underline underline-offset-2 hover:text-accent-2-hover">Apply here</Link>.
      </p>
    </main>
  );
}
