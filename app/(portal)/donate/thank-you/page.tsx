import Link from "next/link";
import { getGiftContext } from "@/lib/services/gift-context";

type SearchParams = Promise<{ ref?: string }>;
const usd = (m: number, c = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(m / 100);
const DESIGNATION: Record<string, string> = { STUDENT: "a student", PROJECT: "a project", GENERAL: "the program where it's needed most" };

export default async function ThankYouPage({ searchParams }: { searchParams: SearchParams }) {
  const { ref } = await searchParams;
  // Real gift data (webhook-written). Null if the webhook hasn't landed yet — we
  // still thank the donor rather than assume nothing happened.
  const gift = ref ? await getGiftContext(ref) : null;

  return (
    <main className="mx-auto max-w-md px-6 py-20 text-center">
      <div className="text-4xl">💚</div>
      <h1 className="mt-3 text-2xl font-bold">Thank you{gift?.firstName ? `, ${gift.firstName}` : ""}!</h1>
      {gift ? (
        <p className="mt-3 text-sm text-black/60">
          Your gift of <strong>{usd(gift.amount, gift.currency)}</strong> toward {DESIGNATION[gift.designation] ?? "the program"} is confirmed.
          A tax-deductible receipt is on its way to your email.
        </p>
      ) : (
        <p className="mt-3 text-sm text-black/60">Your gift is being processed — a tax-deductible receipt will arrive by email shortly. Thank you for supporting our students.</p>
      )}
      <Link href="/" className="mt-6 inline-block rounded bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-black/85">Done</Link>
    </main>
  );
}
