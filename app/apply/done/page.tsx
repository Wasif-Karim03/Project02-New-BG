import Link from "next/link";

export default function ApplyDonePage() {
  return (
    <main className="mx-auto max-w-md px-6 py-20 text-center">
      <div className="text-4xl">✓</div>
      <h1 className="mt-3 text-2xl font-bold">Your request has been sent</h1>
      <p className="mt-2 text-sm text-black/60">
        Thank you — your application is verified and now with our team for review. Once an admin
        approves it, you&apos;ll be able to sign in with your email and password to see your profile
        and sponsorship details.
      </p>
      <Link href="/login" className="mt-6 inline-block rounded bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-black/85">
        Go to sign in
      </Link>
    </main>
  );
}
