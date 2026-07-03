import { createAccountAction, loginContinueAction } from "./actions";

type SearchParams = Promise<{ error?: string }>;
const field = "mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm";
const label = "block text-xs font-medium text-black/60";
const btn = "mt-2 rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85";

export default async function ApplyStartPage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Bridging Generations</p>
      <h1 className="mt-1 text-2xl font-bold">Apply for a scholarship</h1>
      <p className="mt-2 text-sm text-black/60">Create an applicant account (or continue an existing application), fill the form, and verify your email. An admin reviews every application. There is no application fee.</p>
      {error && <div className="mt-4 rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">{decodeURIComponent(error)}</div>}

      <form action={createAccountAction} className="mt-8 rounded-lg border border-black/10 p-5">
        <h2 className="font-semibold">Create your account</h2>
        <div className="mt-3 grid gap-3">
          <label className={label}>Your name<input name="name" required className={field} /></label>
          <label className={label}>Email<input name="email" type="email" required className={field} /></label>
          <label className={label}>Password (min 10)<input name="password" type="password" required minLength={10} className={field} /></label>
        </div>
        <button type="submit" className={btn}>Create account &amp; start</button>
      </form>

      <form action={loginContinueAction} className="mt-6 rounded-lg border border-black/10 p-5">
        <h2 className="font-semibold">Continue an application</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className={label}>Email<input name="email" type="email" required className={field} /></label>
          <label className={label}>Password<input name="password" type="password" required className={field} /></label>
        </div>
        <button type="submit" className={btn}>Continue</button>
      </form>
    </main>
  );
}
