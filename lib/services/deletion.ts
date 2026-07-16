import { unlink } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/services/audit";
import { MARKETING_TAGS, revalidateMarketing } from "@/lib/services/revalidate-marketing";

export class NotFoundError extends Error {
  constructor() { super("Student not found"); this.name = "NotFoundError"; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Best-effort file deletion. This mirrors the backend selection in lib/storage.ts
// (R2 in prod, local uploads/ dir in dev/CI). It NEVER throws — erasing the DB
// row is the contract; orphaned bytes are logged, not fatal.
// ─────────────────────────────────────────────────────────────────────────────
const R2_BUCKET = process.env.R2_BUCKET;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const useR2 = Boolean(R2_BUCKET && R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
const ROOT = path.join(process.cwd(), "uploads");

let _s3: S3Client | null = null;
function s3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY! },
    });
  }
  return _s3;
}

/** Normalize a stored value to an opaque storage key (strips origin / route prefix). */
function toKey(stored: string): string | null {
  let v = stored.trim();
  if (!v) return null;
  // Absolutized values may be full URLs — reduce to the pathname.
  if (/^https?:\/\//i.test(v)) {
    try { v = new URL(v).pathname; } catch { return null; }
  }
  // Files are served through /api/files/<key>; strip that (and any leading slash).
  v = v.replace(/^\/+/, "").replace(/^api\/files\//, "");
  return v || null;
}

async function deleteStoredFile(stored: string | null | undefined): Promise<void> {
  if (!stored) return;
  const key = toKey(stored);
  if (!key) return;
  try {
    if (useR2) {
      await s3().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    } else {
      const full = path.normalize(path.join(ROOT, key));
      if (!full.startsWith(ROOT + path.sep)) return; // guard traversal
      await unlink(full);
    }
  } catch (err) {
    // Best-effort: a missing/unreachable object must not fail the erasure.
    console.warn(`[deletion] failed to delete stored file "${key}":`, err);
  }
}

/**
 * Permanently and irreversibly erase a student and everything personal tied to
 * them (GDPR-style erasure / right to be forgotten). In a single transaction:
 *   - StudentEvaluations, StudentSessions, MentorAssignments for the student
 *   - the student's StudentApplication rows
 *   - the Student row itself
 *   - the linked User (if any) and its Account / Session / PasswordResetToken rows
 * then, OUTSIDE the transaction and best-effort, deletes the student's uploaded
 * files (portrait + application documents + evaluation attachments).
 *
 * Donation/Subscription ledger rows are intentionally PRESERVED — their studentId
 * is set null (financial history must survive). Audited with the supplied reason.
 */
export async function deleteStudentCompletely(
  adminUserId: string,
  studentId: string,
  reason?: string,
) {
  // Gather everything we need for auditing + file cleanup up front.
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true, firstName: true, registrationId: true, portraitUrl: true, userId: true,
      applications: { select: { id: true, userId: true, photoUrl: true, resultSheetUrl: true } },
      evaluations: { select: { fileUrl: true } },
    },
  });
  if (!student) throw new NotFoundError();

  const userId = student.userId;
  const fileKeys = [
    student.portraitUrl,
    ...student.applications.flatMap((a) => [a.photoUrl, a.resultSheetUrl]),
    ...student.evaluations.map((e) => e.fileUrl),
  ];

  await prisma.$transaction(async (tx) => {
    // PRESERVE the ledger but detach it from the student BEFORE deleting the row.
    // The studentId FK is SetNull, but a designation CHECK requires
    // (designationType='STUDENT' ⇒ studentId NOT NULL); a bare SetNull would leave
    // STUDENT + null and violate the CHECK, aborting the whole erasure for any
    // funded student. Re-designate their gifts/subscriptions to GENERAL first.
    await tx.donation.updateMany({ where: { studentId }, data: { designationType: "GENERAL", studentId: null } });
    await tx.subscription.updateMany({ where: { studentId }, data: { designationType: "GENERAL", studentId: null } });

    // Child rows next (some cascade from Student/User, but delete explicitly so
    // the erasure is deterministic and independent of schema cascade settings).
    await tx.studentEvaluation.deleteMany({ where: { studentId } });
    await tx.studentSession.deleteMany({ where: { studentId } });
    await tx.mentorAssignment.deleteMany({ where: { studentId } });
    await tx.studentApplication.deleteMany({ where: { studentId } });
    await tx.student.delete({ where: { id: studentId } });

    if (userId) {
      // Any applications linked by user (not studentId) + auth rows.
      await tx.studentApplication.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    }

    await recordAudit(tx, {
      actorUserId: adminUserId,
      action: "student.delete",
      entityType: "Student",
      entityId: studentId,
      before: { firstName: student.firstName, registrationId: student.registrationId, hadUser: Boolean(userId) },
      reason: reason?.trim() || null,
    });
  });

  // Files last — outside the tx, best-effort, never fatal.
  await Promise.all(fileKeys.map(deleteStoredFile));

  // Drop the removed student from the public site right away.
  await revalidateMarketing([MARKETING_TAGS.students, MARKETING_TAGS.stats]);

  return { deletedUser: Boolean(userId) };
}
