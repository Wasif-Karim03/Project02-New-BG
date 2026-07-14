import { randomInt } from "node:crypto";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { EmailInUseError } from "@/lib/services/accounts";
import { recordAudit } from "@/lib/services/audit";
import { MENTOR_REQUIRED_TO_SUBMIT, type MentorApplicationDraft, mentorApplicationDraftSchema } from "@/lib/validation/mentor-application";

const CODE_TTL_MS = 15 * 60 * 1000;

export class MentorMissingFieldsError extends Error {
  fields: string[];
  constructor(fields: string[]) { super(`Missing: ${fields.join(", ")}`); this.fields = fields; this.name = "MentorMissingFieldsError"; }
}
export class MentorCodeInvalidError extends Error { constructor() { super("That code is invalid or expired."); this.name = "MentorCodeInvalidError"; } }

/** Create a PENDING mentor User + a DRAFT MentorApplication. Guest→account by email. */
export async function registerMentorApplicant(input: { email: string; password: string; name: string }) {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, name: input.name, role: "MENTOR", status: "PENDING", passwordHash } });
      const application = await tx.mentorApplication.create({ data: { userId: user.id, status: "DRAFT", fullName: input.name } });
      return { userId: user.id, applicationId: application.id };
    });
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002") throw new EmailInUseError();
    throw e;
  }
}

export async function getOrCreateMentorDraft(userId: string) {
  // Only ever touch an in-progress application; never a terminal one
  // (EMAIL_VERIFIED sitting in the queue, APPROVED, or REJECTED).
  const existing = await prisma.mentorApplication.findFirst({ where: { userId, status: { in: ["DRAFT", "SUBMITTED"] } }, orderBy: { createdAt: "desc" } });
  return existing ?? prisma.mentorApplication.create({ data: { userId, status: "DRAFT" } });
}

export async function saveMentorDraft(userId: string, data: MentorApplicationDraft) {
  const parsed = mentorApplicationDraftSchema.parse(data);
  const app = await getOrCreateMentorDraft(userId);
  return prisma.mentorApplication.update({ where: { id: app.id }, data: parsed });
}

export async function submitMentorApplication(userId: string): Promise<{ applicationId: string; devCode?: string }> {
  const app = await getOrCreateMentorDraft(userId);
  const missing: string[] = MENTOR_REQUIRED_TO_SUBMIT.filter((f) => !(app as Record<string, unknown>)[f]);
  if (!app.agreedTerms) missing.push("agreedTerms");
  if (missing.length) throw new MentorMissingFieldsError(missing);

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const emailCodeHash = await hashPassword(code);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  await prisma.mentorApplication.update({
    where: { id: app.id },
    data: { status: "SUBMITTED", emailCodeHash, emailCodeExpiresAt: new Date(Date.now() + CODE_TTL_MS), submittedAt: new Date() },
  });
  await sendEmail({ to: user.email, subject: "Your Bridging Generations mentor verification code", text: `Your mentor verification code is ${code}. It expires in 15 minutes.` });
  return { applicationId: app.id, devCode: isEmailConfigured() ? undefined : code };
}

export async function verifyMentorEmail(userId: string, code: string): Promise<{ applicationId: string }> {
  const app = await prisma.mentorApplication.findFirst({ where: { userId, status: "SUBMITTED" }, orderBy: { createdAt: "desc" } });
  if (!app || !app.emailCodeHash || !app.emailCodeExpiresAt || app.emailCodeExpiresAt < new Date()) throw new MentorCodeInvalidError();
  if (!(await verifyPassword(code, app.emailCodeHash))) throw new MentorCodeInvalidError();
  await prisma.mentorApplication.update({ where: { id: app.id }, data: { status: "EMAIL_VERIFIED", emailVerifiedAt: new Date(), emailCodeHash: null } });
  return { applicationId: app.id };
}

// ── Admin ────────────────────────────────────────────────────────────────────
export async function listMentorApplications() {
  return prisma.mentorApplication.findMany({
    where: { status: "EMAIL_VERIFIED" },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { submittedAt: "asc" },
  });
}

export async function getMentorApplication(id: string) {
  return prisma.mentorApplication.findUnique({ where: { id }, include: { user: { select: { email: true, name: true } } } });
}

export class MentorNotReviewableError extends Error { constructor() { super("Application is not awaiting review."); this.name = "MentorNotReviewableError"; } }

export async function approveMentorApplication(adminUserId: string, applicationId: string) {
  return prisma.$transaction(async (tx) => {
    // Only an EMAIL_VERIFIED application may be approved — never a DRAFT/SUBMITTED/
    // already-APPROVED/REJECTED one (prevents activating an unverified or rejected user).
    const app = await tx.mentorApplication.findFirst({ where: { id: applicationId, status: "EMAIL_VERIFIED" } });
    if (!app) throw new MentorNotReviewableError();
    const mentor = await tx.mentor.upsert({
      where: { userId: app.userId },
      create: { userId: app.userId, phone: app.phone, bio: app.motivation, photoUrl: app.photoUrl },
      update: { phone: app.phone, bio: app.motivation, photoUrl: app.photoUrl },
    });
    await tx.user.update({ where: { id: app.userId }, data: { status: "ACTIVE", reviewedById: adminUserId, reviewedAt: new Date() } });
    await tx.mentorApplication.update({ where: { id: applicationId }, data: { status: "APPROVED", mentorId: mentor.id, reviewedById: adminUserId, reviewedAt: new Date() } });
    await recordAudit(tx, { actorUserId: adminUserId, action: "mentor.application.approve", entityType: "MentorApplication", entityId: applicationId, after: { mentorId: mentor.id } });
    return mentor;
  });
}

export async function rejectMentorApplication(adminUserId: string, applicationId: string, reason: string) {
  const app = await prisma.mentorApplication.update({ where: { id: applicationId }, data: { status: "REJECTED", reviewedById: adminUserId, reviewedAt: new Date() } });
  await prisma.user.update({ where: { id: app.userId }, data: { status: "REJECTED" } });
  await recordAudit(prisma, { actorUserId: adminUserId, action: "mentor.application.reject", entityType: "MentorApplication", entityId: applicationId, reason });
  return app;
}

/** The mentor's own submitted profile (for the portal — read-only display). */
export async function getMentorOwnProfile(userId: string) {
  const approved = await prisma.mentorApplication.findFirst({ where: { userId, status: "APPROVED" }, orderBy: { reviewedAt: "desc" } });
  if (approved) return approved;
  return prisma.mentorApplication.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
}
