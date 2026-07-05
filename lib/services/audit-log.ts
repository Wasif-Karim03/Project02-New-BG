import { prisma } from "@/lib/prisma";

/** Recent audit entries with the actor's email resolved (null actor = system). */
export async function listAuditLog(opts?: { action?: string; limit?: number }) {
  const entries = await prisma.auditLog.findMany({
    where: opts?.action ? { action: opts.action } : undefined,
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 200,
  });
  const actorIds = [...new Set(entries.map((e) => e.actorUserId).filter((x): x is string => !!x))];
  const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } }) : [];
  const byId = new Map(actors.map((a) => [a.id, a.email]));
  return entries.map((e) => ({
    id: e.id,
    createdAt: e.createdAt,
    actor: e.actorUserId ? byId.get(e.actorUserId) ?? e.actorUserId : "system",
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    reason: e.reason,
  }));
}

/** Distinct action names, for the filter dropdown. */
export async function listAuditActions(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } });
  return rows.map((r) => r.action);
}
