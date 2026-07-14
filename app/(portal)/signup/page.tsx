import Link from "next/link";
import { signupMentorAction } from "./actions";

type SearchParams = Promise<{ status?: string; role?: string; error?: string }>;

const field = "mt-1.5 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40";
const label = "block text-sm font-medium text-ink-2";
const submit = "mt-4 rounded-full bg-accent-2 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-2-hover";

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const { status, role, error } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2-text">Bridging Generations</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Create an account</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        Donors activate instantly by verifying their email. Mentor and student accounts
        are reviewed by an admin before activation.
      </p>

      {status === "pending" && (
        <div className="mt-6 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm text-accent">
          Thanks — your {role} account was created and is <strong>pending approval</strong>. You can
          sign in after an admin approves it.
        </div>
      )}
      {error && (
        <div className="mt-6 rounded-xl border border-accent-2/30 bg-accent-2/10 px-4 py-3 text-sm text-accent-2-text">
          {decodeURIComponent(error)} {role ? `(${role})` : ""}
        </div>
      )}

      <div className="mt-8 grid gap-6">
        {/* Donor — donors self-activate via email verification at /donor-signup
            (no admin approval), so we send them straight there instead of an
            admin-approval form. */}
        <div className="rounded-2xl border border-hairline bg-ground-2 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Donor</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Create a donor account in a minute — verify your email with a code and you can
            donate and track your gifts right away, no waiting for approval.
          </p>
          <Link href="/donor-signup" className={`${submit} inline-block`}>Create donor account →</Link>
        </div>

        {/* Mentor */}
        <form action={signupMentorAction} className="rounded-2xl border border-hairline bg-ground-2 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Mentor</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><label className={label}>Name<input name="name" required className={field} /></label></div>
            <div><label className={label}>Email<input name="email" type="email" required className={field} /></label></div>
            <div><label className={label}>Password (min 10)<input name="password" type="password" required minLength={10} className={field} /></label></div>
            <div><label className={label}>Phone (optional)<input name="phone" className={field} /></label></div>
          </div>
          <button type="submit" className={submit}>Create mentor account</button>
        </form>

        {/* Students apply through the scholarship application flow, not here. */}
        <div className="rounded-2xl border border-hairline bg-ground-3/50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Student?</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Students seeking a scholarship apply through the application form (with the
            questions and email verification), not this signup.
          </p>
          <Link href="/apply" className={`${submit} inline-block`}>Apply to be a student →</Link>
        </div>
      </div>
    </main>
  );
}
