import { recordAudit } from "@/lib/services/audit";
import { prisma } from "@/lib/prisma";
import { type LegacyCsvRow, legacyCsvRowSchema } from "@/lib/validation/offline-donations";

// Minimal CSV parser: handles quoted fields, escaped quotes ("") and commas in quotes.
function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n");
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
        } else cur += c;
      } else if (c === ",") { out.push(cur); cur = ""; }
      else if (c === '"') inQ = true;
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  if (lines.length === 0 || !lines[0].trim()) return { header: [], rows: [] };
  const header = parseLine(lines[0]);
  const rows = lines.slice(1).filter((l) => l.trim()).map(parseLine);
  return { header, rows };
}

export type RowError = { row: number; message: string };
export type ImportPreview = {
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: RowError[];
  sample: LegacyCsvRow[];
};

async function validateRows(csvText: string): Promise<{ valid: { row: number; data: LegacyCsvRow }[]; errors: RowError[] }> {
  const { header, rows } = parseCsv(csvText);
  const valid: { row: number; data: LegacyCsvRow }[] = [];
  const errors: RowError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // 1-based + header line
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => { obj[h] = rows[i][idx] ?? ""; });

    const parsed = legacyCsvRowSchema.safeParse(obj);
    if (!parsed.success) {
      errors.push({ row: rowNum, message: parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
      continue;
    }
    // Existence check for a designated target (read-only; no writes).
    const d = parsed.data;
    if (d.designationType !== "GENERAL") {
      if (!d.targetSlug) { errors.push({ row: rowNum, message: `${d.designationType} row needs a targetSlug` }); continue; }
      const found = d.designationType === "STUDENT"
        ? await prisma.student.findUnique({ where: { slug: d.targetSlug }, select: { id: true } })
        : await prisma.project.findUnique({ where: { slug: d.targetSlug }, select: { id: true } });
      if (!found) { errors.push({ row: rowNum, message: `${d.designationType} targetSlug "${d.targetSlug}" not found` }); continue; }
    }
    valid.push({ row: rowNum, data: parsed.data });
  }
  return { valid, errors };
}

/** Validate + preview only. Performs NO writes. */
export async function dryRunImport(csvText: string): Promise<ImportPreview> {
  const { valid, errors } = await validateRows(csvText);
  return {
    totalRows: valid.length + errors.length,
    validCount: valid.length,
    errorCount: errors.length,
    errors,
    sample: valid.slice(0, 5).map((v) => v.data),
  };
}

/**
 * Commit valid rows as isHistorical=true LEGACY donations (suppresses receipts/
 * notifications; still counts toward totals). Invalid rows are skipped and
 * reported — a partial import never blocks the good rows. Audited.
 */
export async function commitImport(adminUserId: string, csvText: string): Promise<{ imported: number; skipped: number; errors: RowError[] }> {
  const { valid, errors } = await validateRows(csvText);
  let imported = 0;

  for (const { data } of valid) {
    const targetId = data.designationType === "STUDENT"
      ? (await prisma.student.findUnique({ where: { slug: data.targetSlug! }, select: { id: true } }))?.id
      : data.designationType === "PROJECT"
        ? (await prisma.project.findUnique({ where: { slug: data.targetSlug! }, select: { id: true } }))?.id
        : undefined;

    await prisma.$transaction(async (tx) => {
      const donor = await tx.donor.create({ data: { userId: null, name: data.donorName, email: data.donorEmail } });
      const donation = await tx.donation.create({
        data: {
          donorId: donor.id,
          designationType: data.designationType,
          studentId: data.designationType === "STUDENT" ? targetId : undefined,
          projectId: data.designationType === "PROJECT" ? targetId : undefined,
          amount: Math.round(data.amountUsd * 100),
          currency: "USD",
          source: "LEGACY",
          status: "SUCCEEDED",
          isHistorical: true, // backfill — no receipt/notification, still counts in totals
          occurredAt: data.occurredAt,
          note: data.note,
          createdById: adminUserId,
        },
      });
      await recordAudit(tx, {
        actorUserId: adminUserId,
        action: "donation.legacy.import",
        entityType: "Donation",
        entityId: donation.id,
        after: { source: "LEGACY", amountUsd: data.amountUsd, isHistorical: true },
      });
    });
    imported++;
  }
  return { imported, skipped: errors.length, errors };
}
