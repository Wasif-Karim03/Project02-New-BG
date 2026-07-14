import { createMentorAccountAction, loginContinueAction } from "./actions";

type SearchParams = Promise<{ error?: string }>;
const field = "mt-1.5 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40";
const label = "block text-sm font-medium text-ink-2";
const btn = "mt-4 rounded-full bg-accent-2 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-2-hover";

export default async function MentorApplyStartPage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-lg px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-2-text">Bridging Generations</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Join as a mentor</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">Create a mentor account, answer a few questions, and verify your email. An admin reviews every mentor application. Once approved, you can sign in and see the students assigned to you.</p>
      {error && <div className="mt-6 rounded-xl border border-accent-2/30 bg-accent-2/10 px-4 py-3 text-sm text-accent-2-text">{decodeURIComponent(error)}</div>}

      <form action={createMentorAccountAction} className="mt-8 rounded-2xl border border-hairline bg-ground-2 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Create your account</h2>
        <div className="mt-4 grid gap-4">
          <label className={label}>Your name<input name="name" required className={field} /></label>
          <label className={label}>Email<input name="email" type="email" required className={field} /></label>
          <label className={label}>Password (min 10)<input name="password" type="password" required minLength={10} className={field} /></label>
        </div>
        <button type="submit" className={btn}>Create account &amp; start</button>
      </form>

      <form action={loginContinueAction} className="mt-6 rounded-2xl border border-hairline bg-ground-3/50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Continue an application</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={label}>Email<input name="email" type="email" required className={field} /></label>
          <label className={label}>Password<input name="password" type="password" required className={field} /></label>
        </div>
        <button type="submit" className={btn}>Continue</button>
      </form>
    </main>
  );
}
