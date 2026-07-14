import Link from "next/link";

export default function MentorApplyDonePage() {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-20 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-2xl text-accent">✓</div>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-accent-2-text">Bridging Generations</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Request sent</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">Thanks for applying to mentor with Bridging Generations. Your application is now with our team for review. Once an admin approves it, you can sign in as a mentor and see the students assigned to you.</p>
      <Link href="/login" className="mt-8 inline-block rounded-full bg-accent-2 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-2-hover">Go to sign in</Link>
    </main>
  );
}
