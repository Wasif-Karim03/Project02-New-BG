import Script from "next/script";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startCheckoutAction } from "./actions";

type SearchParams = Promise<{ error?: string }>;
const field = "mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm";
const label = "block text-xs font-medium text-black/60";

export default async function DonatePage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  const [session, projects, students] = await Promise.all([
    auth(),
    prisma.project.findMany({ where: { status: "ACTIVE" }, select: { id: true, title: true }, orderBy: { displayOrder: "asc" } }),
    prisma.student.findMany({ where: { status: "ACTIVE" }, select: { id: true, firstName: true }, orderBy: { firstName: "asc" } }),
  ]);
  // Prefill the signed-in donor's own contact details so a logged-in gift always
  // attributes to their account and earns a receipt (attribution + receipt key off
  // the email the webhook records).
  const sessionEmail = session?.user?.email ?? "";
  const sessionName = session?.user?.name ?? "";

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
          <select id="designationType" name="designationType" className={field} defaultValue="GENERAL">
            <option value="GENERAL">Where needed most</option>
            <option value="STUDENT">Sponsor a student</option>
            <option value="PROJECT">A specific project</option>
          </select>
        </label>
        {/* Target selectors coupled to the designation (client-side): only the matching
            one is shown + enabled, and a disabled control isn't submitted — so the
            server's STUDENT→studentId / PROJECT→projectId rule can't be violated. */}
        {students.length > 0 && (
          <label id="donateStudentField" hidden className={label}>Student
            <select id="studentId" name="studentId" disabled className={field} defaultValue="">
              <option value="">Choose a student…</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.firstName}</option>)}
            </select>
          </label>
        )}
        {projects.length > 0 && (
          <label id="donateProjectField" hidden className={label}>Project
            <select id="projectId" name="projectId" disabled className={field} defaultValue="">
              <option value="">Choose a project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
        )}
        <label className={label}>Your name
          <input name="donorName" defaultValue={sessionName} className={field} />
        </label>
        <label className={label}>Email (for your receipt)
          <input name="donorEmail" type="email" defaultValue={sessionEmail} className={field} />
        </label>
        <label className="flex items-center gap-2 text-sm text-black/70">
          <input type="checkbox" name="recurring" /> Make this a monthly sponsorship
        </label>
        <button type="submit" className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85">
          Continue to payment
        </button>
      </form>

      {/* Couple the designation dropdown to its target selector (client-side). */}
      <Script id="donate-designation-sync" strategy="afterInteractive">{`
        (function () {
          var sel = document.getElementById('designationType');
          if (!sel) return;
          var sf = document.getElementById('donateStudentField');
          var pf = document.getElementById('donateProjectField');
          var ss = document.getElementById('studentId');
          var ps = document.getElementById('projectId');
          function sync() {
            var v = sel.value;
            if (sf) sf.hidden = v !== 'STUDENT';
            if (ss) { ss.disabled = v !== 'STUDENT'; if (v !== 'STUDENT') ss.value = ''; }
            if (pf) pf.hidden = v !== 'PROJECT';
            if (ps) { ps.disabled = v !== 'PROJECT'; if (v !== 'PROJECT') ps.value = ''; }
          }
          sel.addEventListener('change', sync);
          sync();
        })();
      `}</Script>
    </main>
  );
}
