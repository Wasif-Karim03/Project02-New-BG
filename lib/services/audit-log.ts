import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const AUDIT_PAGE_SIZE = 100;

export type AuditEntry = {
  id: string; createdAt: Date; actor: string; action: string;
  entityType: string; entityId: string | null; reason: string | null;
};

/** Resolve actor emails (null actor = "system") and shape rows for display. */
async function shape(rows: Awaited<ReturnType<typeof prisma.auditLog.findMany>>): Promise<AuditEntry[]> {
  const actorIds = [...new Set(rows.map((e) => e.actorUserId).filter((x): x is string => !!x))];
  const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } }) : [];
  const byId = new Map(actors.map((a) => [a.id, a.email]));
  return rows.map((e) => ({
    id: e.id,
    createdAt: e.createdAt,
    actor: e.actorUserId ? byId.get(e.actorUserId) ?? e.actorUserId : "system",
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    reason: e.reason,
  }));
}

/**
 * Recent audit entries (newest first) with the actor's email resolved. Simple
 * capped list — used by the admin overview and the verify suite. For the full
 * paginated/date-filtered viewer use `listAuditLogPage`.
 */
export async function listAuditLog(opts?: { action?: string; limit?: number }): Promise<AuditEntry[]> {
  const rows = await prisma.auditLog.findMany({
    where: opts?.action ? { action: opts.action } : undefined,
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 200,
  });
  return shape(rows);
}

export type AuditLogQuery = {
  action?: string;
  /** Inclusive lower bound (YYYY-MM-DD or ISO). Entries on/after this date. */
  from?: string;
  /** Inclusive upper bound (YYYY-MM-DD or ISO). Entries on/before this date. */
  to?: string;
  /** 1-based page. */
  page?: number;
  pageSize?: number;
};

export type AuditLogPage = { entries: AuditEntry[]; page: number; pageSize: number; hasMore: boolean };

function parseDay(v: string | undefined, endOfDay: boolean): Date | undefined {
  if (!v) return undefined;
  // Bare YYYY-MM-DD → span the whole local day; otherwise trust the ISO string.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`) : new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Paginated audit entries (newest first) with an action filter and a createdAt
 * date range, so older entries beyond the first page stay reachable. Fetches one
 * extra row to compute `hasMore` without a separate count query.
 */
export async function listAuditLogPage(opts?: AuditLogQuery): Promise<AuditLogPage> {
  const pageSize = Math.min(Math.max(opts?.pageSize ?? AUDIT_PAGE_SIZE, 1), 500);
  const page = Math.max(opts?.page ?? 1, 1);
  const from = parseDay(opts?.from, false);
  const to = parseDay(opts?.to, true);

  const where: Prisma.AuditLogWhereInput = {};
  if (opts?.action) where.action = opts.action;
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
  });
  const hasMore = rows.length > pageSize;
  const entries = await shape(hasMore ? rows.slice(0, pageSize) : rows);
  return { entries, page, pageSize, hasMore };
}

/** Distinct action names, for the filter dropdown. */
export async function listAuditActions(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } });
  return rows.map((r) => r.action);
}
