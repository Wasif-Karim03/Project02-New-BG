import Link from "next/link";
import { forgotPasswordAction } from "./actions";

type SearchParams = Promise<{ sent?: string; error?: string }>;

export default async function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const { sent, error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm px-6 py-20">
      <h1 className="text-2xl font-bold">Reset your password</h1>
      {sent ? (
        <div className="mt-4 rounded border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-900">
          If an account exists for that email, we&apos;ve sent a reset link. Check your inbox (in dev, the link prints to the server console).
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-black/60">Enter your email and we&apos;ll send a reset link.</p>
          {error && <div className="mt-4 rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">{decodeURIComponent(error)}</div>}
          <form action={forgotPasswordAction} className="mt-6 grid gap-3">
            <label className="block text-xs font-medium text-black/60">Email
              <input name="email" type="email" required className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm" />
            </label>
            <button type="submit" className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85">Send reset link</button>
          </form>
        </>
      )}
      <p className="mt-6 text-sm"><Link href="/login" className="text-blue-700 underline">Back to sign in</Link></p>
    </main>
  );
}
