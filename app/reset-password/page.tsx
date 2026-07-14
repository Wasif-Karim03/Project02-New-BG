import Link from "next/link";
import { resetPasswordAction } from "./actions";

type SearchParams = Promise<{ token?: string; error?: string }>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const { token, error } = await searchParams;

  if (!token) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2-text">Bridging Generations</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Reset password</h1>
        <p className="mt-3 text-sm text-ink-2">This link is missing its token. Request a new one.</p>
        <p className="mt-6 text-sm"><Link href="/forgot-password" className="font-medium text-accent-2-text underline underline-offset-2 hover:text-accent-2-hover">Request a reset link</Link></p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-6 py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2-text">Bridging Generations</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Choose a new password</h1>
      {error && <div className="mt-6 rounded-xl border border-accent-2/30 bg-accent-2/10 px-4 py-3 text-sm text-accent-2-text">{decodeURIComponent(error)}</div>}
      <form action={resetPasswordAction} className="mt-6 grid gap-4 rounded-2xl border border-hairline bg-ground-2 p-6 shadow-sm">
        <input type="hidden" name="token" value={token} />
        <label className="block text-sm font-medium text-ink-2">New password (min 10)
          <input name="password" type="password" required minLength={10} autoComplete="new-password" className="mt-1.5 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40" />
        </label>
        <button type="submit" className="rounded-full bg-accent-2 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-2-hover">Set new password</button>
      </form>
    </main>
  );
}
