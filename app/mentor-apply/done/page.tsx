import Link from "next/link";

export default function MentorApplyDonePage() {
  return (
    <main className="mx-auto max-w-md px-6 py-20 text-center">
      <div className="text-4xl">✅</div>
      <h1 className="mt-3 text-2xl font-bold">Request sent</h1>
      <p className="mt-3 text-sm text-black/60">Thanks for applying to mentor with Bridging Generations. Your application is now with our team for review. Once an admin approves it, you can sign in as a mentor and see the students assigned to you.</p>
      <Link href="/login" className="mt-6 inline-block rounded bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-black/85">Go to sign in</Link>
    </main>
  );
}
