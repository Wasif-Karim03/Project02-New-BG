/**
 * Phase G verification — the security boundary. Proves:
 *   - WHITELIST: every serialized object's keys ⊆ the allowed set (the snapshot test)
 *   - no PII VALUE ever appears in any projected output (fullName, fatherName, dob,
 *     anonymous donor name…)
 *   - consent gates: portrait/story fields omitted unless GRANTED + WEBSITE + not revoked
 *   - only ACTIVE students are listed; non-ACTIVE are absent
 *   - computed numbers: fundingRaised / totalRaised / donorCount (all sources incl.
 *     LEGACY; refunds & voids excluded); sponsorshipStatus derivation
 *   - donor wall anonymizes and never leaks name/email/amount
 *
 * Run after the seed:  npx tsx scripts/verify-projection.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  DONORWALL_KEYS, PROJECT_KEYS, STATS_KEYS, STUDENT_KEYS,
  projectDonorWall, projectProjectBySlug, projectProjects, projectStats, projectStudentBySlug, projectStudents,
} from "@/lib/public/projection";

const prisma = new PrismaClient();
const T = Date.now();
const SECRET_FULL = `SECRETFULL${T}`;
const SECRET_FATHER = `SECRETFATHER${T}`;
const SECRET_ANON = `SECRETANON${T}`;
const DOB = new Date("2010-05-05");

let failures = 0;
const studentIds: string[] = [];
const donorIds: string[] = [];
const donationIds: string[] = [];
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}
function assertWhitelist(label: string, objs: object[], allowed: readonly string[]) {
  const allowSet = new Set(allowed);
  const offenders = new Set<string>();
  for (const o of objs) for (const k of Object.keys(o)) if (!allowSet.has(k)) offenders.add(k);
  check(`${label}: keys ⊆ whitelist`, offenders.size === 0, offenders.size ? `LEAKED KEYS: ${[...offenders].join(", ")}` : "");
}

async function mkStudent(opts: { first: string; slug: string; status?: "ACTIVE" | "PENDING"; portrait: "GRANTED" | "PENDING"; story: "GRANTED" | "PENDING"; scopes: ("WEBSITE" | "PRINT")[]; revoked?: boolean; schoolId: string }) {
  const s = await prisma.student.create({
    data: {
      firstName: opts.first, slug: opts.slug, status: opts.status ?? "ACTIVE", schoolId: opts.schoolId,
      fullName: SECRET_FULL, fatherName: SECRET_FATHER, dob: DOB, gender: "female", community: "chakma",
      portraitUrl: `/img/${opts.slug}.jpg`, quote: `quote-${opts.slug}`, bio: `bio-${opts.slug}`,
      portraitConsent: opts.portrait, storyConsent: opts.story, consentScopes: opts.scopes,
      consentRevokedAt: opts.revoked ? new Date() : null,
    },
  });
  studentIds.push(s.id);
  return s;
}
async function mkDonor(name: string, anon = false) {
  const d = await prisma.donor.create({ data: { userId: null, name, isAnonymous: anon } });
  donorIds.push(d.id);
  return d;
}
async function mkDonation(data: Parameters<typeof prisma.donation.create>[0]["data"]) {
  const d = await prisma.donation.create({ data });
  donationIds.push(d.id);
  return d;
}

async function main() {
  const school = await prisma.school.findFirstOrThrow({ select: { id: true } });
  const session = await prisma.academicSession.findFirstOrThrow({ where: { isCurrent: true } });
  // Baseline BEFORE creating test data, so stats assertions are robust to any
  // pre-existing donations/donors already in the DB (delta, not absolute).
  const base = await projectStats();

  const sFull = await mkStudent({ first: "Full", slug: `full-${T}`, portrait: "GRANTED", story: "GRANTED", scopes: ["WEBSITE"], schoolId: school.id });
  const sNoPortrait = await mkStudent({ first: "NoPortrait", slug: `nop-${T}`, portrait: "PENDING", story: "GRANTED", scopes: ["WEBSITE"], schoolId: school.id });
  const sNoStory = await mkStudent({ first: "NoStory", slug: `nos-${T}`, portrait: "GRANTED", story: "PENDING", scopes: ["WEBSITE"], schoolId: school.id });
  const sRevoked = await mkStudent({ first: "Revoked", slug: `rev-${T}`, portrait: "GRANTED", story: "GRANTED", scopes: ["WEBSITE"], revoked: true, schoolId: school.id });
  const sNoScope = await mkStudent({ first: "NoScope", slug: `nsc-${T}`, portrait: "GRANTED", story: "GRANTED", scopes: ["PRINT"], schoolId: school.id });
  const sPending = await mkStudent({ first: "Pending", slug: `pend-${T}`, status: "PENDING", portrait: "GRANTED", story: "GRANTED", scopes: ["WEBSITE"], schoolId: school.id });
  await prisma.studentSession.create({ data: { studentId: sFull.id, sessionId: session.id, grade: "Class 6" } });

  const project = await prisma.project.create({ data: { title: `Proj ${T}`, slug: `proj-${T}`, summary: "s", fundingGoal: 100000, currency: "USD" } });
  const [dp1, dp2, dp3, dSpon, dA, dB] = await Promise.all([mkDonor(`P1${T}`), mkDonor(`P2${T}`), mkDonor(`P3void${T}`), mkDonor(`Sponsor${T}`), mkDonor(`Alice${T}`), mkDonor(SECRET_ANON, true)]);

  await mkDonation({ donorId: dp1.id, designationType: "PROJECT", projectId: project.id, amount: 10000, refundedAmount: 2000, currency: "USD", source: "STRIPE", status: "SUCCEEDED", stripePaymentIntentId: `pi_${T}_p1`, idempotencyKey: `k_${T}_p1`, occurredAt: new Date() }); // net 8000
  await mkDonation({ donorId: dp2.id, designationType: "PROJECT", projectId: project.id, amount: 5000, currency: "USD", source: "LEGACY", status: "SUCCEEDED", isHistorical: true, occurredAt: new Date() }); // 5000
  await mkDonation({ donorId: dp3.id, designationType: "PROJECT", projectId: project.id, amount: 9999, currency: "USD", source: "STRIPE", status: "VOIDED", stripePaymentIntentId: `pi_${T}_void`, idempotencyKey: `k_${T}_void`, occurredAt: new Date() }); // excluded
  await mkDonation({ donorId: dSpon.id, designationType: "STUDENT", studentId: sFull.id, sessionId: session.id, amount: 3000, currency: "USD", source: "STRIPE", status: "SUCCEEDED", stripePaymentIntentId: `pi_${T}_sp`, idempotencyKey: `k_${T}_sp`, occurredAt: new Date() });
  await mkDonation({ donorId: dA.id, designationType: "GENERAL", amount: 2000, currency: "USD", source: "CASH", status: "SUCCEEDED", occurredAt: new Date("2024-02-02") });
  await mkDonation({ donorId: dB.id, designationType: "GENERAL", amount: 1500, currency: "USD", source: "CASH", status: "SUCCEEDED", occurredAt: new Date("2023-01-01") });
  await prisma.donor.update({ where: { id: dA.id }, data: { wallMessage: "Thank you", wallTier: "friend" } });

  const [students, projects, stats, wall] = await Promise.all([projectStudents(), projectProjects(), projectStats(), projectDonorWall()]);
  const sFullPub = await projectStudentBySlug(sFull.slug!);
  const projPub = await projectProjectBySlug(project.slug);

  console.log("\nWhitelist (the snapshot test)");
  assertWhitelist("students", students, STUDENT_KEYS);
  assertWhitelist("student-by-slug", sFullPub ? [sFullPub] : [], STUDENT_KEYS);
  assertWhitelist("projects", projects, PROJECT_KEYS);
  assertWhitelist("stats", [stats], STATS_KEYS);
  assertWhitelist("donor-wall", wall, DONORWALL_KEYS);

  console.log("\nNo PII value leaks into any projected output");
  const blob = JSON.stringify({ students, sFullPub, projects, projPub, stats, wall });
  check("fullName never serialized", !blob.includes(SECRET_FULL));
  check("fatherName never serialized", !blob.includes(SECRET_FATHER));
  check("dob never serialized", !blob.includes("2010-05-05"));
  check("anonymous donor's name never serialized", !blob.includes(SECRET_ANON));

  console.log("\nConsent gates");
  const byId = (id: string) => students.find((x) => x.id === id);
  check("full consent → portraitUrl + quote + bio", !!byId(sFull.id)?.portraitUrl && !!byId(sFull.id)?.quote && !!byId(sFull.id)?.bio);
  check("no portrait consent → portraitUrl omitted, story kept", !byId(sNoPortrait.id)?.portraitUrl && !!byId(sNoPortrait.id)?.bio);
  check("no story consent → quote/bio omitted, portrait kept", !!byId(sNoStory.id)?.portraitUrl && !byId(sNoStory.id)?.quote && !byId(sNoStory.id)?.bio);
  check("revoked → portrait + story both omitted", !byId(sRevoked.id)?.portraitUrl && !byId(sRevoked.id)?.bio);
  check("no WEBSITE scope → portrait + story omitted", !byId(sNoScope.id)?.portraitUrl && !byId(sNoScope.id)?.bio);

  console.log("\nListing + derived fields");
  check("non-ACTIVE student is NOT listed", !byId(sPending.id));
  check("non-ACTIVE student by slug → null", (await projectStudentBySlug(sPending.slug!)) === null);
  check("grade from current StudentSession", byId(sFull.id)?.grade === "Class 6");
  check("sponsored (directed donation this session)", byId(sFull.id)?.sponsorshipStatus === "sponsored");
  check("unsponsored → waiting", byId(sNoStory.id)?.sponsorshipStatus === "waiting");

  console.log("\nComputed numbers");
  check("project fundingRaised = 13000 (8000 net + 5000 legacy; void excluded)", projPub?.fundingRaised === 13000, `got ${projPub?.fundingRaised}`);
  check("stats.totalRaised +19500 (all sources; refund/void handled)", stats.totalRaised - base.totalRaised === 19500, `delta ${stats.totalRaised - base.totalRaised}`);
  check("stats.donorCount +5 (distinct donors w/ SUCCEEDED; void-only donor excluded)", stats.donorCount - base.donorCount === 5, `delta ${stats.donorCount - base.donorCount}`);
  check("stats.studentCount ≥ 5 ACTIVE", stats.studentCount >= 5);

  console.log("\nDonor wall");
  const alice = wall.find((w) => w.message === "Thank you");
  check("named donor → displayName is the name, tier + year present", alice?.displayName === `Alice${T}` && alice?.tier === "friend" && typeof alice?.year === "number");
  const anon = wall.find((w) => w.displayName === "Anonymous");
  check("anonymous donor → displayName 'Anonymous', no name", !!anon && !JSON.stringify(anon).includes(SECRET_ANON));

  console.log(`\n${failures === 0 ? "✓ ALL PROJECTION CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
  await cleanup(project.id);
}

async function cleanup(projectId: string) {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: donationIds } } });
  await prisma.donation.deleteMany({ where: { id: { in: donationIds } } });
  await prisma.studentSession.deleteMany({ where: { studentId: { in: studentIds } } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.donor.deleteMany({ where: { id: { in: donorIds } } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  console.log("  (cleaned up test data)");
}

main()
  .catch((e) => { console.error("verify-projection error:", e); failures++; })
  .finally(async () => { await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
