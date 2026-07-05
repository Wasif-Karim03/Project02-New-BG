import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/services/audit";

export const PAYMENT_KEYS = ["pay_bkash", "pay_nagad", "pay_rocket", "pay_bank"] as const;

export class SessionLabelTakenError extends Error { constructor() { super("A session with that label already exists."); this.name = "SessionLabelTakenError"; } }

export async function getSettings(keys: readonly string[]): Promise<Record<string, string>> {
  const rows = await prisma.orgSetting.findMany({ where: { key: { in: [...keys] } } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Upsert (or clear if blank) a setting. Audited. */
export async function setSetting(adminUserId: string, key: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) await prisma.orgSetting.deleteMany({ where: { key } });
  else await prisma.orgSetting.upsert({ where: { key }, create: { key, value: trimmed }, update: { value: trimmed } });
  await recordAudit(prisma, { actorUserId: adminUserId, action: "settings.update", entityType: "OrgSetting", entityId: key, after: { value: trimmed } });
}

// ── Academic sessions ────────────────────────────────────────────────────────
export async function listAcademicSessions() {
  return prisma.academicSession.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, isCurrent: true, startDate: true, endDate: true },
  });
}

export async function createAcademicSession(adminUserId: string, label: string, makeCurrent: boolean) {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Label is required");
  try {
    const session = await prisma.$transaction(async (tx) => {
      if (makeCurrent) await tx.academicSession.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
      return tx.academicSession.create({ data: { label: trimmed, isCurrent: makeCurrent } });
    });
    await recordAudit(prisma, { actorUserId: adminUserId, action: "session.create", entityType: "AcademicSession", entityId: session.id, after: { label: trimmed, isCurrent: makeCurrent } });
    return session;
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") throw new SessionLabelTakenError();
    throw e;
  }
}

/** Make a session the single current one (unset the previous). Audited. */
export async function setCurrentAcademicSession(adminUserId: string, sessionId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.academicSession.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
    await tx.academicSession.update({ where: { id: sessionId }, data: { isCurrent: true } });
  });
  await recordAudit(prisma, { actorUserId: adminUserId, action: "session.setCurrent", entityType: "AcademicSession", entityId: sessionId, after: { isCurrent: true } });
}
