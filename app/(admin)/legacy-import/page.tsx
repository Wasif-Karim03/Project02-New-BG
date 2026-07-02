import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ImportForm } from "./ImportForm";

export default async function LegacyImportPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/api/auth/signin?callbackUrl=/legacy-import");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Legacy CSV import</h1>
      <p className="mt-1 text-sm text-black/60">
        Bulk-backfill historical gifts. Imported rows are <strong>historical LEGACY</strong> donations —
        no receipts or notifications, but they count toward totals. Always <strong>dry-run</strong> first;
        invalid rows are reported and skipped, never blocking the good ones. Manual entry stays the
        primary path — this is a convenience.
      </p>
      <ImportForm />
    </main>
  );
}
