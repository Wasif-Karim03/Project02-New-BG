import { randomInt } from "node:crypto";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { EmailInUseError } from "@/lib/services/accounts";
import { recordAudit } from "@/lib/services/audit";

const CODE_TTL_MS = 15 * 60 * 1000;

export class DonorCodeInvalidError extends Error { constructor() { super("That code is invalid or expired."); this.name = "DonorCodeInvalidError"; } }

function isUnique(e: unknown) { return e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002"; }
const genCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/**
 * Create a donor account (email-verified, NO admin approval). If a guest Donor
 * already exists for this email, it's adopted so past guest gifts show up in the
 * new account. Emails a 6-digit code; account activates on verification.
 */
export async function registerDonorWithVerification(input: { name: string; phone?: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const code = genCode();
  const emailCodeHash = await hashPassword(code);
  let userId: string;
  try {
    userId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name: input.name, role: "DONOR", status: "PENDING", passwordHash, emailCodeHash, emailCodeExpiresAt: new Date(Date.now() + CODE_TTL_MS) },
      });
      // Adopt EVERY guest donor row for this email so no past gift is stranded on a
      // duplicate. userId is @unique, so we promote the earliest guest to the account
      // row and fold the rest into it (reassign their donations/subscriptions, then
      // drop the now-empty duplicates).
      const guests = await tx.donor.findMany({ where: { email, userId: null }, orderBy: { createdAt: "asc" } });
      if (guests.length === 0) {
        await tx.donor.create({ data: { userId: user.id, name: input.name, email, phone: input.phone } });
      } else {
        const [primary, ...rest] = guests;
        await tx.donor.update({ where: { id: primary.id }, data: { userId: user.id, name: input.name, phone: input.phone } });
        for (const dup of rest) {
          await tx.donation.updateMany({ where: { donorId: dup.id }, data: { donorId: primary.id } });
          await tx.subscription.updateMany({ where: { donorId: dup.id }, data: { donorId: primary.id } });
          await tx.donor.delete({ where: { id: dup.id } });
        }
        // Financial-attribution change — leave a trail (gifts moved across donor rows).
        if (rest.length > 0) {
          await recordAudit(tx, {
            actorUserId: null,
            action: "donor.consolidate",
            entityType: "Donor",
            entityId: primary.id,
            after: { userId: user.id, absorbedDonorIds: rest.map((d) => d.id) },
            reason: "guest donor rows folded into the new account on signup",
          });
        }
      }
      return user.id;
    });
  } catch (e) {
    if (isUnique(e)) throw new EmailInUseError();
    throw e;
  }
  await sendEmail({ to: email, subject: "Verify your Bridging Generations account", text: `Your verification code is ${code}. It expires in 15 minutes.` });
  return { userId, devCode: isEmailConfigured() ? undefined : code };
}

export async function verifyDonorEmail(userId: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.emailCodeHash || !user.emailCodeExpiresAt || user.emailCodeExpiresAt < new Date()) throw new DonorCodeInvalidError();
  if (!(await verifyPassword(code, user.emailCodeHash))) throw new DonorCodeInvalidError();
  await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE", emailVerified: new Date(), emailCodeHash: null, emailCodeExpiresAt: null } });
}

export async function resendDonorCode(userId: string): Promise<{ devCode?: string }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  const code = genCode();
  await prisma.user.update({ where: { id: userId }, data: { emailCodeHash: await hashPassword(code), emailCodeExpiresAt: new Date(Date.now() + CODE_TTL_MS) } });
  await sendEmail({ to: user.email, subject: "Your Bridging Generations verification code", text: `Your verification code is ${code}. It expires in 15 minutes.` });
  return { devCode: isEmailConfigured() ? undefined : code };
}
