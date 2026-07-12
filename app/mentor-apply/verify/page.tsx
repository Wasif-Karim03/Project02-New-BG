import { redirect } from "next/navigation";
import { getApplicantUserId } from "@/lib/apply-session";
import { resendMentorCodeAction, verifyMentorCodeAction } from "../actions";

type SearchParams = Promise<{ error?: string; resent?: string; dev?: string }>;

export default async function MentorApplyVerifyPage({ searchParams }: { searchParams: SearchParams }) {
  if (!(await getApplicantUserId())) redirect("/mentor-apply");
  const { error, resent, dev } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold">Verify your email</h1>
      <p className="mt-2 text-sm text-black/60">We emailed a 6-digit code. Enter it to finish submitting your mentor application. (In dev, the code prints to the server console.)</p>
      {dev && <div className="mt-4 rounded border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-900">Dev mode: your code is <strong className="tracking-widest">{dev}</strong>.</div>}
      {resent && <div className="mt-4 rounded border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-900">A new code was sent.</div>}
      {error && <div className="mt-4 rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">{decodeURIComponent(error)}</div>}

      <form action={verifyMentorCodeAction} className="mt-6 flex items-end gap-3">
        <label className="block text-xs font-medium text-black/60">Verification code
          <input name="code" inputMode="numeric" pattern="[0-9]*" maxLength={6} required className="mt-1 w-40 rounded border border-black/15 px-3 py-2 text-lg tracking-widest" />
        </label>
        <button type="submit" className="rounded bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-black/85">Verify</button>
      </form>

      <form action={resendMentorCodeAction} className="mt-4">
        <button type="submit" className="text-sm text-blue-700 underline">Resend code</button>
      </form>
    </main>
  );
}
