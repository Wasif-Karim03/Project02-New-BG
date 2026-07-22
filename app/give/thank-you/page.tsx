import Link from "next/link";
import { getGiftContext } from "@/lib/services/gift-context";

type SearchParams = Promise<{ ref?: string }>;
const usd = (m: number, c = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(m / 100);
const DESIGNATION: Record<string, string> = { STUDENT: "a student", PROJECT: "a project", GENERAL: "the program where it's needed most" };

export default async function GiveThankYouPage({ searchParams }: { searchParams: SearchParams }) {
  const { ref } = await searchParams;
  // Real gift data (webhook-written). Null if the webhook hasn't landed yet — we still
  // thank the donor rather than assume nothing happened. `ref` is the Checkout session id.
  const gift = ref ? await getGiftContext(ref) : null;

  return (
    <main className="mx-auto max-w-md px-6 py-20 text-center">
      <div className="text-4xl">💚</div>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink">Thank you{gift?.firstName ? `, ${gift.firstName}` : ""}!</h1>
      {gift ? (
        <p className="mt-3 text-sm text-ink-2">
          Your gift of <strong>{usd(gift.amount, gift.currency)}</strong> toward {DESIGNATION[gift.designation] ?? "the program"} is confirmed.
          Stripe has emailed your payment receipt.
        </p>
      ) : (
        <p className="mt-3 text-sm text-ink-2">Your payment is being confirmed — Stripe will email your receipt shortly. Thank you for supporting our students.</p>
      )}
      <Link href="/" className="mt-6 inline-block rounded-full bg-accent-2 px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-2-hover">Done</Link>
    </main>
  );
}
