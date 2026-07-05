/**
 * Settings: org key/value round-trip (+ blank clears), and academic-session
 * management (create/set-current keeps exactly one current; duplicate label
 * refused). Restores the live current session so real data is untouched.
 *
 * Run after the seed:  npx tsx scripts/verify-settings.ts
 */
import { PrismaClient } from "@prisma/client";
import { SessionLabelTakenError, createAcademicSession, getSettings, listAcademicSessions, setCurrentAcademicSession, setSetting } from "@/lib/services/settings";

const prisma = new PrismaClient();
const T = Date.now();
let failures = 0;
const sessionIds: string[] = [];
const settingKeys: string[] = [];
let originalCurrentId: string | null = null;
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }
async function expectThrow(label: string, ErrType: new (...a: never[]) => Error, fn: () => Promise<unknown>) {
  try { await fn(); check(label, false, "expected error"); } catch (e) { check(label, e instanceof ErrType, (e as Error)?.name); }
}
const currentCount = () => prisma.academicSession.count({ where: { isCurrent: true } });

async function main() {
  const admin = (await prisma.user.findUniqueOrThrow({ where: { email: "admin@bridginggenerations.org" } })).id;
  originalCurrentId = (await prisma.academicSession.findFirst({ where: { isCurrent: true }, select: { id: true } }))?.id ?? null;

  console.log("\nOrg settings");
  const key = `pay_bkash_test_${T}`; settingKeys.push(key);
  await setSetting(admin, key, "  01700-000000  ");
  check("setting round-trips (trimmed)", (await getSettings([key]))[key] === "01700-000000");
  check("setting update audited", !!(await prisma.auditLog.findFirst({ where: { action: "settings.update", entityId: key } })));
  await setSetting(admin, key, "   ");
  check("blank value clears the setting", (await getSettings([key]))[key] === undefined);

  console.log("\nAcademic sessions (single-current invariant)");
  const s1 = await createAcademicSession(admin, `TestSess-${T}`, true); sessionIds.push(s1.id);
  check("new current session is current", s1.isCurrent === true);
  check("exactly one current session exists", (await currentCount()) === 1);
  const s2 = await createAcademicSession(admin, `TestSess2-${T}`, false); sessionIds.push(s2.id);
  check("non-current session created not current", s2.isCurrent === false);
  await setCurrentAcademicSession(admin, s2.id);
  check("set-current switches the current (still exactly one)", (await currentCount()) === 1 && (await prisma.academicSession.findUnique({ where: { id: s2.id } }))?.isCurrent === true && (await prisma.academicSession.findUnique({ where: { id: s1.id } }))?.isCurrent === false);
  check("session actions audited", !!(await prisma.auditLog.findFirst({ where: { action: "session.create", entityId: s1.id } })) && !!(await prisma.auditLog.findFirst({ where: { action: "session.setCurrent", entityId: s2.id } })));
  await expectThrow("duplicate label refused", SessionLabelTakenError, () => createAcademicSession(admin, `TestSess-${T}`, false));
  check("listAcademicSessions includes the new ones", (await listAcademicSessions()).filter((s) => sessionIds.includes(s.id)).length === 2);

  console.log(`\n${failures === 0 ? "✓ ALL SETTINGS CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  // Restore the real current session BEFORE deleting the test ones.
  if (originalCurrentId) {
    await prisma.academicSession.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
    await prisma.academicSession.update({ where: { id: originalCurrentId }, data: { isCurrent: true } }).catch(() => {});
  }
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...sessionIds, ...settingKeys] } } });
  await prisma.academicSession.deleteMany({ where: { id: { in: sessionIds } } });
  await prisma.orgSetting.deleteMany({ where: { key: { in: settingKeys } } });
  console.log("  (cleaned up test data; current session restored)");
}

main().catch((e) => { console.error("verify-settings error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
