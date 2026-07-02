"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { commitImport, dryRunImport, type ImportPreview, type RowError } from "@/lib/services/legacy-import";

export type ImportState = {
  mode?: "dryrun" | "commit";
  preview?: ImportPreview;
  result?: { imported: number; skipped: number; errors: RowError[] };
  error?: string;
};

export async function importAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const admin = await requireAdmin();
  const csv = String(formData.get("csv") || "");
  const mode = String(formData.get("mode") || "dryrun") === "commit" ? "commit" : "dryrun";
  if (!csv.trim()) return { error: "Paste CSV first." };
  try {
    if (mode === "commit") return { mode, result: await commitImport(admin.id, csv) };
    return { mode, preview: await dryRunImport(csv) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
