/**
 * Phase A seed — foundation data only.
 *
 * Creates: one ADMIN (ACTIVE), three AcademicSessions (two PAST for legacy
 * backfill + one CURRENT), and the schools (slugs mirror the marketing site's
 * content/schools/* so the Phase H public bridge can key on a shared slug).
 *
 * Idempotent: every write is an upsert keyed on a unique column, so re-running
 * is safe and will not trip the single-current-session partial unique index.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@bridginggenerations.org";
// Dev-only seed password. NEVER use in any deployed environment — the admin must
// rotate it after first sign-in. Overridable via SEED_ADMIN_PASSWORD.
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Admin-dev";

const SESSIONS = [
  { label: "2023-2024", startDate: new Date("2023-07-01"), endDate: new Date("2024-06-30"), isCurrent: false },
  { label: "2024-2025", startDate: new Date("2024-07-01"), endDate: new Date("2025-06-30"), isCurrent: false },
  { label: "2025-2026", startDate: new Date("2025-07-01"), endDate: new Date("2026-06-30"), isCurrent: true },
];

const SCHOOLS = [
  { slug: "rangamati-school", name: "Rangamati Government Primary School", location: "Rangamati Sadar, Rangamati", establishedYear: 1985 },
  { slug: "khagrachari-school", name: "Khagrachari Model School", location: "Khagrachari Sadar, Khagrachari", establishedYear: 1992 },
  { slug: "bandarban-school", name: "Bandarban Hill School", location: "Bandarban Sadar, Bandarban", establishedYear: 1998 },
  { slug: "dighinala-primary-school", name: "Dighinala Primary School", location: "Dighinala, Khagrachari", establishedYear: 2001 },
  { slug: "thanchi-high-school", name: "Thanchi High School", location: "Thanchi, Bandarban", establishedYear: 1979 },
];

async function main() {
  // Admin — ACTIVE so it can immediately work the approval queue. emailVerified
  // is set so the magic-link sign-in succeeds without a verification round-trip.
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: "ADMIN", status: "ACTIVE", passwordHash },
    create: {
      email: ADMIN_EMAIL,
      name: "Bridging Generations Admin",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: new Date(),
      passwordHash,
    },
  });

  // Academic sessions. Upsert the two past ones first (isCurrent=false), then the
  // current one — keeps us within the "at most one current" partial unique index.
  const sessions = [];
  for (const s of SESSIONS) {
    sessions.push(
      await prisma.academicSession.upsert({
        where: { label: s.label },
        update: { startDate: s.startDate, endDate: s.endDate, isCurrent: s.isCurrent },
        create: s,
      }),
    );
  }

  // Schools.
  const schools = [];
  for (const sc of SCHOOLS) {
    schools.push(
      await prisma.school.upsert({
        where: { slug: sc.slug },
        update: { name: sc.name, location: sc.location, establishedYear: sc.establishedYear },
        create: sc,
      }),
    );
  }

  const current = sessions.find((s) => s.isCurrent);
  console.log("✓ Seed complete");
  console.log(`  admin:    ${admin.email} (role=${admin.role}, status=${admin.status})`);
  console.log(`  password: ${ADMIN_PASSWORD}  (DEV ONLY — rotate after first sign-in)`);
  console.log(`  sessions: ${sessions.map((s) => `${s.label}${s.isCurrent ? "*" : ""}`).join(", ")}  (* = current)`);
  console.log(`  current:  ${current?.label}`);
  console.log(`  schools:  ${schools.length} (${schools.map((s) => s.slug).join(", ")})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
