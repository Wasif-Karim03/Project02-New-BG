import { randomInt } from "node:crypto";
import { sendEmail } from "@/lib/email";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { EmailInUseError } from "@/lib/services/accounts";

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
      const guest = await tx.donor.findFirst({ where: { email, userId: null } });
      if (guest) await tx.donor.update({ where: { id: guest.id }, data: { userId: user.id, name: input.name, phone: input.phone } });
      else await tx.donor.create({ data: { userId: user.id, name: input.name, email, phone: input.phone } });
      return user.id;
    });
  } catch (e) {
    if (isUnique(e)) throw new EmailInUseError();
    throw e;
  }
  await sendEmail({ to: email, subject: "Verify your Bridging Generations account", text: `Your verification code is ${code}. It expires in 15 minutes.` });
  return { userId, devCode: process.env.EMAIL_SERVER ? undefined : code };
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
  return { devCode: process.env.EMAIL_SERVER ? undefined : code };
}
