import Link from "next/link";
import { auth } from "@/auth";

const card = "block rounded-lg border border-black/10 px-4 py-3 text-sm hover:bg-black/[0.03] transition";
const heading = "text-xs font-semibold uppercase tracking-wide text-black/50";

export default async function Home() {
  const session = await auth();
  const user = session?.user;

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Bridging Generations</p>
      <h1 className="mt-1 text-3xl font-bold">Operational portal</h1>
      <p className="mt-2 text-sm text-black/60">
        Accounts, approvals, mentor evaluations, donations (Stripe + offline), and the read-only
        public API. {user ? (
          <>Signed in as <strong>{user.email}</strong> ({user.role}).{" "}
          <Link href="/api/auth/signout" className="text-blue-700 underline">Sign out</Link></>
        ) : (
          <><Link href="/api/auth/signin" className="text-blue-700 underline">Sign in</Link> to reach the admin/donor/mentor screens.</>
        )}
      </p>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className={heading}>Get in</h2>
          <div className="mt-3 grid gap-2">
            <Link href="/api/auth/signin" className={card}>Sign in →</Link>
            <Link href="/signup" className={card}>Sign up (donor / mentor / student) →</Link>
            <Link href="/apply" className={card}>Apply to be a student (scholarship) →</Link>
          </div>
          <h2 className={`${heading} mt-6`}>Admin</h2>
          <div className="mt-3 grid gap-2">
            <Link href="/approvals" className={card}>Approval queue →</Link>
            <Link href="/applications" className={card}>Student applications →</Link>
            <Link href="/assignments" className={card}>Mentor assignments →</Link>
            <Link href="/offline-donations" className={card}>Record an offline gift →</Link>
            <Link href="/legacy-import" className={card}>Legacy CSV import →</Link>
            <Link href="/sponsorships" className={card}>Active sponsorships →</Link>
          </div>
        </section>

        <section>
          <h2 className={heading}>Donor &amp; mentor</h2>
          <div className="mt-3 grid gap-2">
            <Link href="/dashboard" className={card}>Donor dashboard (giving + subscriptions) →</Link>
            <Link href="/my-students" className={card}>Mentor: my students →</Link>
            <Link href="/donate" className={card}>Donate (needs a Stripe test key) →</Link>
          </div>
          <h2 className={`${heading} mt-6`}>Public API (read-only, no login)</h2>
          <div className="mt-3 grid gap-2 text-sm">
            <a href="/api/public/stats" className={card}>/api/public/stats →</a>
            <a href="/api/public/projects" className={card}>/api/public/projects →</a>
            <a href="/api/public/students" className={card}>/api/public/students →</a>
            <a href="/api/public/donor-wall" className={card}>/api/public/donor-wall →</a>
          </div>
        </section>
      </div>

      <p className="mt-10 text-xs text-black/40">
        Seeded admin: admin@bridginggenerations.org · dev password ChangeMe!Admin-dev (rotate after first sign-in).
      </p>
    </main>
  );
}
