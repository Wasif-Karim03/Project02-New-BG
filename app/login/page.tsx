import Link from "next/link";
import { loginAction } from "./actions";

type SearchParams = Promise<{ error?: string; callbackUrl?: string; reset?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { error, callbackUrl, reset } = await searchParams;

  return (
    <main className="mx-auto max-w-sm px-6 py-20">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Bridging Generations</p>
      <h1 className="mt-1 text-2xl font-bold">Sign in</h1>
      {reset && <div className="mt-4 rounded border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-900">Password updated — sign in with your new password.</div>}
      {error && <div className="mt-4 rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">{error === "rate" ? "Too many attempts. Please wait a minute and try again." : "Email or password is incorrect."}</div>}

      <form action={loginAction} className="mt-6 grid gap-3">
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/"} />
        <label className="block text-xs font-medium text-black/60">Email
          <input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs font-medium text-black/60">Password
          <input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="mt-2 rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85">Sign in</button>
      </form>

      <p className="mt-3 text-sm"><Link href="/forgot-password" className="text-blue-700 underline">Forgot your password?</Link></p>
      <p className="mt-4 text-sm text-black/60">
        Applying for a scholarship? <Link href="/apply" className="text-blue-700 underline">Apply here</Link>.
      </p>
    </main>
  );
}
