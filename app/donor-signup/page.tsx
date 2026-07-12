import Link from "next/link";
import { createDonorAccountAction } from "./actions";

type SearchParams = Promise<{ error?: string }>;
const field = "mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm";
const label = "block text-xs font-medium text-black/60";

export default async function DonorSignupPage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Bridging Generations</p>
      <h1 className="mt-1 text-2xl font-bold">Create a donor account</h1>
      <p className="mt-2 text-sm text-black/60">Track your donations, see the students you support, and get updates. We&apos;ll email a code to verify your address — then you can donate right away.</p>
      {error && <div className="mt-4 rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">{decodeURIComponent(error)}</div>}

      <form action={createDonorAccountAction} className="mt-6 grid gap-3">
        <label className={label}>Full name<input name="name" required className={field} /></label>
        <label className={label}>Phone (optional)<input name="phone" className={field} /></label>
        <label className={label}>Email<input name="email" type="email" required className={field} /></label>
        <label className={label}>Password (min 10)<input name="password" type="password" required minLength={10} className={field} /></label>
        <button type="submit" className="mt-1 rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85">Create account</button>
      </form>

      <p className="mt-4 text-sm text-black/60">Prefer not to sign up? <Link href="/give" className="text-blue-700 underline">Just donate as a guest</Link>. Already have an account? <Link href="/login" className="text-blue-700 underline">Sign in</Link>.</p>
    </main>
  );
}
