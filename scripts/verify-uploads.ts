/**
 * File upload + access verification. Storage round-trips and rejects bad files;
 * uploaded documents (minors' PII) are viewable ONLY by an admin, the owner, or a
 * mentor with an ACTIVE assignment — everyone else (incl. unauthenticated) denied.
 *
 * Run after the seed:  npx tsx scripts/verify-uploads.ts
 */
import { unlink } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { canViewFile, fileOwnerUserId } from "@/lib/services/file-access";
import { UploadRejectedError, readUpload, saveUpload } from "@/lib/storage";

const prisma = new PrismaClient();
const T = Date.now();
let failures = 0;
const userIds: string[] = [];
const studentIds: string[] = [];
let savedKey = "";
function check(label: string, ok: boolean, detail = "") { console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); if (!ok) failures++; }
async function expectThrow(label: string, fn: () => Promise<unknown>) {
  try { await fn(); check(label, false, "expected rejection"); } catch (e) { check(label, e instanceof UploadRejectedError, (e as Error)?.name); }
}

async function main() {
  console.log("\nStorage round-trip + rejections");
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
  savedKey = await saveUpload("test", "image/png", png);
  const read = await readUpload(savedKey);
  check("save + read round-trips the bytes", read.bytes.equals(png) && read.contentType === "image/png");
  await expectThrow("disallowed type rejected", () => saveUpload("test", "text/html", Buffer.from("x")));
  await expectThrow("oversized file rejected", () => saveUpload("test", "image/png", Buffer.alloc(6 * 1024 * 1024)));
  await expectThrow("empty file rejected", () => saveUpload("test", "image/png", Buffer.alloc(0)));

  console.log("\nAuthorization (admin / owner / assigned-mentor only)");
  const fileUrl = `/api/files/applications/doc-${T}.jpg`;
  const owner = await prisma.user.create({ data: { email: `owner-${T}@x.test`, role: "STUDENT", status: "ACTIVE" } });
  const other = await prisma.user.create({ data: { email: `other-${T}@x.test`, role: "DONOR", status: "ACTIVE" } });
  const mUser = await prisma.user.create({ data: { email: `mentor-${T}@x.test`, role: "MENTOR", status: "ACTIVE" } });
  userIds.push(owner.id, other.id, mUser.id);
  const student = await prisma.student.create({ data: { userId: owner.id, status: "ACTIVE", slug: `own-${T}`, firstName: "Own" } });
  studentIds.push(student.id);
  await prisma.studentApplication.create({ data: { userId: owner.id, status: "EMAIL_VERIFIED", photoUrl: fileUrl } });
  const mentor = await prisma.mentor.create({ data: { userId: mUser.id } });
  const currentSession = await prisma.academicSession.findFirstOrThrow({ where: { isCurrent: true } });
  const assignment = await prisma.mentorAssignment.create({ data: { mentorId: mentor.id, studentId: student.id, sessionId: currentSession.id, active: true } });

  check("fileOwnerUserId resolves the applicant", (await fileOwnerUserId(fileUrl)) === owner.id);
  check("ADMIN can view", (await canViewFile({ id: "x", role: "ADMIN" }, fileUrl)) === true);
  check("owner can view", (await canViewFile({ id: owner.id, role: "STUDENT" }, fileUrl)) === true);
  check("unrelated user CANNOT view", (await canViewFile({ id: other.id, role: "DONOR" }, fileUrl)) === false);
  check("unauthenticated CANNOT view", (await canViewFile(undefined, fileUrl)) === false);
  check("assigned mentor CAN view", (await canViewFile({ id: mUser.id, role: "MENTOR" }, fileUrl)) === true);

  await prisma.mentorAssignment.update({ where: { id: assignment.id }, data: { active: false, unassignedAt: new Date() } });
  check("unassigned mentor CANNOT view (access cut)", (await canViewFile({ id: mUser.id, role: "MENTOR" }, fileUrl)) === false);
  check("unknown file → denied", (await canViewFile({ id: other.id, role: "DONOR" }, "/api/files/nope.jpg")) === false);

  console.log(`\n${failures === 0 ? "✓ ALL UPLOAD CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
}

async function cleanup() {
  if (savedKey) await unlink(path.join(process.cwd(), "uploads", savedKey)).catch(() => {});
  await prisma.mentorAssignment.deleteMany({ where: { studentId: { in: studentIds } } });
  await prisma.studentApplication.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.mentor.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log("  (cleaned up test data)");
}

main().catch((e) => { console.error("verify-uploads error:", e); failures++; }).finally(async () => { await cleanup(); await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
