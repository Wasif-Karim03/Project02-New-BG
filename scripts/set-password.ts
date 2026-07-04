/**
 * Admin utility: set (reset) a user's password.
 *   npx tsx scripts/set-password.ts <email> <newPassword>
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/password";

const [email, password] = process.argv.slice(2);
const prisma = new PrismaClient();

async function main() {
  if (!email || !password) {
    console.error("usage: npx tsx scripts/set-password.ts <email> <newPassword>");
    process.exit(1);
  }
  const passwordHash = await hashPassword(password);
  const u = await prisma.user.update({ where: { email: email.toLowerCase() }, data: { passwordHash } });
  console.log(`✓ Password set for ${u.email} (role ${u.role}, status ${u.status})`);
}

main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
