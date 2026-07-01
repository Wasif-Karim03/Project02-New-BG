import { signupDonorAction, signupMentorAction, signupStudentAction } from "./actions";

type SearchParams = Promise<{ status?: string; role?: string; error?: string }>;

const field = "mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm";
const label = "block text-xs font-medium text-black/70";
const submit = "mt-2 rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85";

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const { status, role, error } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Create an account</h1>
      <p className="mt-2 text-sm text-black/60">
        Donor, mentor, and student accounts are reviewed by an admin before activation.
        You&apos;ll be able to sign in once approved.
      </p>

      {status === "pending" && (
        <div className="mt-4 rounded border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-900">
          Thanks — your {role} account was created and is <strong>pending approval</strong>. You can
          sign in after an admin approves it.
        </div>
      )}
      {error && (
        <div className="mt-4 rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">
          {decodeURIComponent(error)} {role ? `(${role})` : ""}
        </div>
      )}

      <div className="mt-8 grid gap-8">
        {/* Donor */}
        <form action={signupDonorAction} className="rounded-lg border border-black/10 p-5">
          <h2 className="font-semibold">Donor</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className={label}>Name<input name="name" required className={field} /></label></div>
            <div><label className={label}>Email<input name="email" type="email" required className={field} /></label></div>
            <div><label className={label}>Password (min 10)<input name="password" type="password" required minLength={10} className={field} /></label></div>
            <div><label className={label}>Country (optional)<input name="country" className={field} /></label></div>
          </div>
          <button type="submit" className={submit}>Create donor account</button>
        </form>

        {/* Mentor */}
        <form action={signupMentorAction} className="rounded-lg border border-black/10 p-5">
          <h2 className="font-semibold">Mentor</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className={label}>Name<input name="name" required className={field} /></label></div>
            <div><label className={label}>Email<input name="email" type="email" required className={field} /></label></div>
            <div><label className={label}>Password (min 10)<input name="password" type="password" required minLength={10} className={field} /></label></div>
            <div><label className={label}>Phone (optional)<input name="phone" className={field} /></label></div>
          </div>
          <button type="submit" className={submit}>Create mentor account</button>
        </form>

        {/* Student (self) */}
        <form action={signupStudentAction} className="rounded-lg border border-black/10 p-5">
          <h2 className="font-semibold">Student</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className={label}>Account name<input name="name" required className={field} /></label></div>
            <div><label className={label}>First name (public)<input name="firstName" required className={field} /></label></div>
            <div><label className={label}>Email<input name="email" type="email" required className={field} /></label></div>
            <div><label className={label}>Password (min 10)<input name="password" type="password" required minLength={10} className={field} /></label></div>
          </div>
          <button type="submit" className={submit}>Create student account</button>
        </form>
      </div>
    </main>
  );
}
