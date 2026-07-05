import Link from "next/link";
import { resetPasswordAction } from "./actions";

type SearchParams = Promise<{ token?: string; error?: string }>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const { token, error } = await searchParams;

  if (!token) {
    return (
      <main className="mx-auto max-w-sm px-6 py-20">
        <h1 className="text-2xl font-bold">Reset password</h1>
        <p className="mt-3 text-sm text-black/60">This link is missing its token. Request a new one.</p>
        <p className="mt-4 text-sm"><Link href="/forgot-password" className="text-blue-700 underline">Request a reset link</Link></p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-20">
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      {error && <div className="mt-4 rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">{decodeURIComponent(error)}</div>}
      <form action={resetPasswordAction} className="mt-6 grid gap-3">
        <input type="hidden" name="token" value={token} />
        <label className="block text-xs font-medium text-black/60">New password (min 10)
          <input name="password" type="password" required minLength={10} autoComplete="new-password" className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85">Set new password</button>
      </form>
    </main>
  );
}
