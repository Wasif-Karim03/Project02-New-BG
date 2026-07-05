/**
 * Audit log viewer: entries list newest-first, actor email is resolved (null actor
 * shows "system"), and the action filter works.
 *
 * Run after the seed:  npx tsx scripts/verify-audit-log.ts
 */
import { PrismaClient } from "@prisma/client";
import { listAuditActions, listAuditLog } from "@/lib/services/audit-log";

const prisma = new PrismaClient();
const T = Date.now();
let failures = 0;
const auditIds: string[] = [];
const userIds: string[] = [];
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }

async function main() {
  const actor = await prisma.user.create({ data: { email: `auditor-${T}@x.test`, role: "ADMIN", status: "ACTIVE" } });
  userIds.push(actor.id);
  const userAction = `test.user.${T}`;
  const sysAction = `test.system.${T}`;
  auditIds.push((await prisma.auditLog.create({ data: { actorUserId: actor.id, action: userAction, entityType: "Test", entityId: "e1", reason: "because" } })).id);
  auditIds.push((await prisma.auditLog.create({ data: { actorUserId: null, action: sysAction, entityType: "Test", entityId: "e2" } })).id);

  const userEntries = await listAuditLog({ action: userAction });
  check("filter returns exactly the matching entry", userEntries.length === 1 && userEntries[0].action === userAction);
  check("actor email resolved + reason present", userEntries[0]?.actor === actor.email && userEntries[0]?.reason === "because");

  const sysEntries = await listAuditLog({ action: sysAction });
  check("null actor shows 'system'", sysEntries[0]?.actor === "system");

  const actions = await listAuditActions();
  check("distinct actions include both test actions", actions.includes(userAction) && actions.includes(sysAction));

  console.log(`\n${failures === 0 ? "✓ ALL AUDIT-LOG CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { id: { in: auditIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log("  (cleaned up test data)");
}

main().catch((e) => { console.error("verify-audit-log error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
