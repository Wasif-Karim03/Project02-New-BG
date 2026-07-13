import { randomInt } from "node:crypto";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/services/audit";
import { EmailInUseError } from "@/lib/services/accounts";
import { type ApplicationDraftInput, REQUIRED_TO_SUBMIT } from "@/lib/validation/applications";

const CODE_TTL_MS = 15 * 60 * 1000;

export class NotFoundError extends Error {
  constructor() { super("Application not found"); this.name = "NotFoundError"; }
}
export class MissingFieldsError extends Error {
  fields: string[];
  constructor(fields: string[]) { super(`Missing required fields: ${fields.join(", ")}`); this.name = "MissingFieldsError"; this.fields = fields; }
}
export class CodeInvalidError extends Error {
  constructor(msg = "Invalid or expired code") { super(msg); this.name = "CodeInvalidError"; }
}

/**
 * Create the applicant's account (STUDENT, PENDING) + a DRAFT application. No
 * Student record yet — that is created on admin approval. Email+password so they
 * can come back and finish / later sign in once approved.
 */
export async function registerStudentApplicant(input: { email: string; password: string; name: string }) {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, name: input.name, role: "STUDENT", status: "PENDING", passwordHash } });
      const application = await tx.studentApplication.create({ data: { userId: user.id, status: "DRAFT" } });
      return { userId: user.id, applicationId: application.id, status: application.status };
    });
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002") throw new EmailInUseError();
    throw e;
  }
}

/** The applicant's current (non-approved) application, creating a DRAFT if none. */
export async function getOrCreateDraft(userId: string) {
  const existing = await prisma.studentApplication.findFirst({
    where: { userId, status: { in: ["DRAFT", "SUBMITTED", "EMAIL_VERIFIED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  return prisma.studentApplication.create({ data: { userId, status: "DRAFT" } });
}

/** Save draft fields (partial). Only allowed while DRAFT or SUBMITTED (pre-verify). */
export async function saveDraft(userId: string, data: ApplicationDraftInput) {
  const app = await getOrCreateDraft(userId);
  if (app.status === "EMAIL_VERIFIED" || app.status === "APPROVED") throw new CodeInvalidError("Application already submitted");
  return prisma.studentApplication.update({ where: { id: app.id }, data });
}

/**
 * Submit: validate required fields + agreement, generate a 6-digit code, store it
 * hashed with a 15-min expiry, email it, and move to SUBMITTED (awaiting verify).
 */
export async function submitApplication(userId: string): Promise<{ applicationId: string; devCode?: string }> {
  const app = await getOrCreateDraft(userId);
  const missing: string[] = REQUIRED_TO_SUBMIT.filter((f) => !(app as Record<string, unknown>)[f]);
  if (!app.agreedTerms) missing.push("agreedTerms");
  if (missing.length) throw new MissingFieldsError(missing);

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const emailCodeHash = await hashPassword(code);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });

  await prisma.studentApplication.update({
    where: { id: app.id },
    data: { status: "SUBMITTED", emailCodeHash, emailCodeExpiresAt: new Date(Date.now() + CODE_TTL_MS), submittedAt: new Date() },
  });
  await sendEmail({ to: user.email, subject: "Your Bridging Generations verification code", text: `Your verification code is ${code}. It expires in 15 minutes.` });

  // devCode is returned ONLY when there is no real email transport, so a dev/test
  // can complete the flow. Never surfaced to the client when email is configured.
  return { applicationId: app.id, devCode: isEmailConfigured() ? undefined : code };
}

/** Verify the emailed code → EMAIL_VERIFIED (enters the admin queue). */
export async function verifyEmail(userId: string, code: string): Promise<{ applicationId: string }> {
  const app = await prisma.studentApplication.findFirst({ where: { userId, status: "SUBMITTED" }, orderBy: { createdAt: "desc" } });
  if (!app) throw new NotFoundError();
  if (!app.emailCodeHash || !app.emailCodeExpiresAt || app.emailCodeExpiresAt.getTime() < Date.now()) throw new CodeInvalidError();
  if (!(await verifyPassword(code.trim(), app.emailCodeHash))) throw new CodeInvalidError();

  await prisma.studentApplication.update({
    where: { id: app.id },
    data: { status: "EMAIL_VERIFIED", emailVerifiedAt: new Date(), emailCodeHash: null, emailCodeExpiresAt: null },
  });
  await recordAudit(prisma, { actorUserId: userId, action: "application.email_verified", entityType: "StudentApplication", entityId: app.id });
  return { applicationId: app.id };
}
