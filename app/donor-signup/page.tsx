import Link from "next/link";
import { createDonorAccountAction } from "./actions";

type SearchParams = Promise<{ error?: string }>;
const field = "mt-1.5 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40";
const label = "block text-sm font-medium text-ink-2";

export default async function DonorSignupPage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2-text">Bridging Generations</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Create a donor account</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">Track your donations, see the students you support, and get updates. We&apos;ll email a code to verify your address — then you can donate right away.</p>
      {error && <div className="mt-6 rounded-xl border border-accent-2/30 bg-accent-2/10 px-4 py-3 text-sm text-accent-2-text">{decodeURIComponent(error)}</div>}

      <form action={createDonorAccountAction} className="mt-6 grid gap-4 rounded-2xl border border-hairline bg-ground-2 p-6 shadow-sm">
        <label className={label}>Full name<input name="name" required className={field} /></label>
        <label className={label}>Phone (optional)<input name="phone" className={field} /></label>
        <label className={label}>Email<input name="email" type="email" required className={field} /></label>
        <label className={label}>Password (min 10)<input name="password" type="password" required minLength={10} className={field} /></label>
        <button type="submit" className="mt-1 rounded-full bg-accent-2 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-2-hover">Create account</button>
      </form>

      <p className="mt-4 text-sm text-ink-2">Prefer not to sign up? <Link href="/give" className="font-medium text-accent-2-text underline underline-offset-2 hover:text-accent-2-hover">Just donate as a guest</Link>. Already have an account? <Link href="/login" className="font-medium text-accent-2-text underline underline-offset-2 hover:text-accent-2-hover">Sign in</Link>.</p>
    </main>
  );
}
