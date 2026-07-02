import type { Db } from "@/lib/services/audit";

/** The current AcademicSession id (or null). Used to attribute each donation cycle. */
export async function getCurrentSessionId(db: Db): Promise<string | null> {
  const current = await db.academicSession.findFirst({ where: { isCurrent: true }, select: { id: true } });
  return current?.id ?? null;
}
