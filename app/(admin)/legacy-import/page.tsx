import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ImportForm } from "./ImportForm";
import { page, PageHeader } from "../_components/ui";

export default async function LegacyImportPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE") {
    redirect("/login?callbackUrl=/legacy-import");
  }

  return (
    <div className={page}>
      <PageHeader
        title="Legacy CSV import"
        description="Bulk-backfill historical gifts. Imported rows are historical LEGACY donations — no receipts or notifications, but they count toward totals. Always dry-run first; invalid rows are reported and skipped, never blocking the good ones. Manual entry stays the primary path — this is a convenience."
      />
      <ImportForm />
    </div>
  );
}
