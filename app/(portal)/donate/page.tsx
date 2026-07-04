import { prisma } from "@/lib/prisma";
import { startCheckoutAction } from "./actions";

type SearchParams = Promise<{ error?: string }>;
const field = "mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm";
const label = "block text-xs font-medium text-black/60";

export default async function DonatePage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  const projects = await prisma.project.findMany({ where: { status: "ACTIVE" }, select: { id: true, title: true }, orderBy: { displayOrder: "asc" } });

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="text-2xl font-bold">Make a donation</h1>
      <p className="mt-1 text-sm text-black/60">One-time gift via Stripe Checkout. You choose the amount; your receipt reflects the amount Stripe charges.</p>
      {error && <div className="mt-4 rounded border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-900">{decodeURIComponent(error)}</div>}

      <form action={startCheckoutAction} className="mt-6 grid gap-4">
        <label className={label}>Amount (USD)
          <input name="amountDollars" type="number" min="1" step="1" required placeholder="30" className={field} />
        </label>
        <label className={label}>Designation
          <select name="designationType" className={field} defaultValue="GENERAL">
            <option value="GENERAL">Where needed most</option>
            <option value="PROJECT">A specific project</option>
          </select>
        </label>
        {projects.length > 0 && (
          <label className={label}>Project (if designating a project)
            <select name="projectId" className={field} defaultValue="">
              <option value="">—</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
        )}
        <label className={label}>Email (optional — for your receipt)
          <input name="donorEmail" type="email" className={field} />
        </label>
        <label className="flex items-center gap-2 text-sm text-black/70">
          <input type="checkbox" name="recurring" /> Make this a monthly sponsorship
        </label>
        <button type="submit" className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85">
          Continue to payment
        </button>
      </form>
    </main>
  );
}
