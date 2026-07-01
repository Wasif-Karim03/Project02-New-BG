import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * A Prisma client OR an interactive-transaction client. Audit writes happen in
 * the SAME transaction as the change they record, so the two never diverge.
 */
export type Db = PrismaClient | Prisma.TransactionClient;

export type AuditInput = {
  actorUserId?: string | null; // null for system/unauthenticated actions
  action: string; // e.g. "user.approve", "student.reject", "student.create"
  entityType: string; // e.g. "User", "Student", "Donor"
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ipAddress?: string | null;
};

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

/**
 * Append an immutable audit entry. NEVER include secrets or full PII in
 * before/after — record status transitions and ids, not passwords or raw PII.
 */
export async function recordAudit(db: Db, input: AuditInput) {
  return db.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: asJson(input.before),
      after: asJson(input.after),
      reason: input.reason ?? null,
      ipAddress: input.ipAddress ?? null,
    },
  });
}
