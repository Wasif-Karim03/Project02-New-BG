/**
 * Phase G + Phase 7 verification — the PUBLIC security boundary. Proves:
 *   - WHITELIST: every serialized object's keys ⊆ the allowed set (list AND detail)
 *   - Phase 7 tightening: the student DETAIL payload contains ONLY the approved fields
 *     (first name, photo, school, grade, district, why-note) + funding "ask" + consent
 *     story + career goal + donor list — and OMITS, field-by-field, every removed field
 *     (full name, guardian, gender, village, orphan, ethnicity, professions, DOB, roll,
 *     class size, target period). Asserted key-by-key so a future model field can't leak.
 *   - no PII VALUE ever appears in any projected output (fullName, fatherName, dob,
 *     ethnicity, village, professions, guardian, anonymous donor name…)
 *   - consent gates: portrait/story fields omitted unless GRANTED + WEBSITE + not revoked
 *   - only ACTIVE students are listed; non-ACTIVE are absent
 *   - computed numbers: fundingRaised (isolated, exact) + stats aggregation LOGIC
 *     (matched against a direct DB aggregate — robust to concurrent writers on the
 *     shared branch, which is what made this test intermittently flaky before)
 *   - donor wall anonymizes and never leaks name/email/amount
 *
 * Isolation: this test creates its OWN school + donors + students + project and cleans
 * them up. It does NOT depend on any pre-existing shared row (a concurrent test mutating
 * "the first school" or global donation counts can no longer flip its result).
 *
 * Run after the seed:  npx tsx scripts/verify-projection.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  DONORWALL_KEYS, PROJECT_KEYS, STATS_KEYS, STUDENT_DETAIL_KEYS, STUDENT_KEYS,
  projectDonorWall, projectProjectBySlug, projectProjects, projectStats, projectStudentBySlug, projectStudentDetail, projectStudents,
} from "@/lib/public/projection";

const prisma = new PrismaClient();
// Per-RUN unique token (time + pid + random), so concurrent runs on the shared branch
// never collide on a unique slug/name/key. Fixture isolation, not just per-millisecond.
const T = `${Date.now()}${process.pid}${Math.floor(Math.random() * 1e6)}`;
// Unique markers for every PII value that must NEVER cross the public boundary.
const SECRET_FULL = `SECRETFULL${T}`;
const SECRET_FATHER = `SECRETFATHER${T}`;
const SECRET_MOTHER = `SECRETMOTHER${T}`;
const SECRET_ETH = `SECRETETH${T}`;
const SECRET_VILLAGE = `SECRETVILLAGE${T}`;
const SECRET_FPROF = `SECRETFPROF${T}`;
const SECRET_MPROF = `SECRETMPROF${T}`;
const SECRET_GUARDIAN = `SECRETGUARDIAN${T}`;
const SECRET_INCOME = `SECRETINCOME${T}`;
const SECRET_ANON = `SECRETANON${T}`;
const DOB = new Date("2010-05-05");

let failures = 0;
const studentIds: string[] = [];
const donorIds: string[] = [];
const donationIds: string[] = [];
const schoolIds: string[] = [];
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

/**
 * Verify projectStats() equals a DIRECT DB aggregate using the SAME filters. This
 * tests the aggregation LOGIC (void/refund/pending handling, distinct-donor counting,
 * visible-student + distinct-school filtering) without asserting a brittle absolute
 * number. projectStats and the direct reads run together; a concurrent writer landing
 * between them can skew one read, so we RETRY — a transient skew converges within a few
 * attempts, while a genuine logic regression mismatches on every attempt. This is the
 * fix for the historical flakiness (which came from asserting a fixed global delta
 * across a wide window on the shared branch).
 */
async function statsConsistent(): Promise<{ ok: boolean; detail: string }> {
  let detail = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const [stats, donors, total, visible] = await Promise.all([
      projectStats(),
      prisma.donation.findMany({ where: { status: "SUCCEEDED" }, select: { donorId: true }, distinct: ["donorId"] }),
      prisma.donation.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amount: true, refundedAmount: true } }),
      prisma.student.findMany({ where: { status: "ACTIVE", active: true, slug: { not: null }, showOnWebsite: true }, select: { schoolId: true } }),
    ]);
    const expectTotal = Math.max(0, (total._sum.amount ?? 0) - (total._sum.refundedAmount ?? 0));
    const expectSchools = new Set(visible.map((s) => s.schoolId).filter((id): id is string => Boolean(id))).size;
    detail = `donors ${stats.donorCount}/${donors.length}, total ${stats.totalRaised}/${expectTotal}, students ${stats.studentCount}/${visible.length}, schools ${stats.schoolCount}/${expectSchools}`;
    if (stats.donorCount === donors.length && stats.totalRaised === expectTotal && stats.studentCount === visible.length && stats.schoolCount === expectSchools) {
      return { ok: true, detail };
    }
  }
  return { ok: false, detail: `disagreed across 6 attempts — ${detail}` };
}

// Every test student carries a FULL set of sensitive PII, so the whitelist/omission
// assertions are meaningful — if the projection leaked any of it, it would show here.
async function mkStudent(opts: { first: string; slug: string; status?: "ACTIVE" | "PENDING"; portrait: "GRANTED" | "PENDING"; story: "GRANTED" | "PENDING"; scopes: ("WEBSITE" | "PRINT")[]; revoked?: boolean; schoolId: string }) {
  const s = await prisma.student.create({
    data: {
      firstName: opts.first, slug: opts.slug, status: opts.status ?? "ACTIVE", schoolId: opts.schoolId,
      fullName: SECRET_FULL, fatherName: SECRET_FATHER, motherName: SECRET_MOTHER, dob: DOB, gender: "female", community: "chakma",
      // Phase 7 removed fields — all populated so omission is actually tested:
      ethnicity: SECRET_ETH, isOrphan: true, addrVillage: SECRET_VILLAGE, fatherProfession: SECRET_FPROF,
      motherProfession: SECRET_MPROF, guardianName: SECRET_GUARDIAN, guardianMobile: "01700000000", familyIncome: SECRET_INCOME,
      // Kept-public fields:
      addrDistrict: "Rangamati", purpose: "school fees", careerGoal: "doctor",
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
  // Own isolated school (not a shared findFirst) — a concurrent test can't disturb it.
  const school = await prisma.school.create({ data: { name: `TestSchool-${T}`, slug: `test-school-${T}` } });
  schoolIds.push(school.id);
  const session = await prisma.academicSession.findFirstOrThrow({ where: { isCurrent: true } });

  const sFull = await mkStudent({ first: "Full", slug: `full-${T}`, portrait: "GRANTED", story: "GRANTED", scopes: ["WEBSITE"], schoolId: school.id });
  const sNoPortrait = await mkStudent({ first: "NoPortrait", slug: `nop-${T}`, portrait: "PENDING", story: "GRANTED", scopes: ["WEBSITE"], schoolId: school.id });
  const sNoStory = await mkStudent({ first: "NoStory", slug: `nos-${T}`, portrait: "GRANTED", story: "PENDING", scopes: ["WEBSITE"], schoolId: school.id });
  const sRevoked = await mkStudent({ first: "Revoked", slug: `rev-${T}`, portrait: "GRANTED", story: "GRANTED", scopes: ["WEBSITE"], revoked: true, schoolId: school.id });
  const sNoScope = await mkStudent({ first: "NoScope", slug: `nsc-${T}`, portrait: "GRANTED", story: "GRANTED", scopes: ["PRINT"], schoolId: school.id });
  const sPending = await mkStudent({ first: "Pending", slug: `pend-${T}`, status: "PENDING", portrait: "GRANTED", story: "GRANTED", scopes: ["WEBSITE"], schoolId: school.id });
  await prisma.studentSession.create({ data: { studentId: sFull.id, sessionId: session.id, grade: "Class 6", institutionName: "Test Institution", formerRoll: "42", totalStudent: "60" } });

  const project = await prisma.project.create({ data: { title: `Proj ${T}`, slug: `proj-${T}`, summary: "s", fundingGoal: 100000, currency: "USD" } });
  const [dp1, dp2, dp3, dSpon, dA, dB] = await Promise.all([mkDonor(`P1${T}`), mkDonor(`P2${T}`), mkDonor(`P3void${T}`), mkDonor(`Sponsor${T}`), mkDonor(`Alice${T}`), mkDonor(SECRET_ANON, true)]);

  await mkDonation({ donorId: dp1.id, designationType: "PROJECT", projectId: project.id, amount: 10000, refundedAmount: 2000, currency: "USD", source: "STRIPE", status: "SUCCEEDED", stripePaymentIntentId: `pi_${T}_p1`, idempotencyKey: `k_${T}_p1`, occurredAt: new Date() }); // net 8000
  await mkDonation({ donorId: dp2.id, designationType: "PROJECT", projectId: project.id, amount: 5000, currency: "USD", source: "LEGACY", status: "SUCCEEDED", isHistorical: true, occurredAt: new Date() }); // 5000
  await mkDonation({ donorId: dp3.id, designationType: "PROJECT", projectId: project.id, amount: 9999, currency: "USD", source: "STRIPE", status: "VOIDED", stripePaymentIntentId: `pi_${T}_void`, idempotencyKey: `k_${T}_void`, occurredAt: new Date() }); // excluded
  await mkDonation({ donorId: dSpon.id, designationType: "STUDENT", studentId: sFull.id, sessionId: session.id, amount: 3000, currency: "USD", source: "STRIPE", status: "SUCCEEDED", stripePaymentIntentId: `pi_${T}_sp`, idempotencyKey: `k_${T}_sp`, occurredAt: new Date() });
  await mkDonation({ donorId: dA.id, designationType: "GENERAL", amount: 2000, currency: "USD", source: "CASH", status: "SUCCEEDED", occurredAt: new Date("2024-02-02") });
  await mkDonation({ donorId: dB.id, designationType: "GENERAL", amount: 1500, currency: "USD", source: "CASH", status: "SUCCEEDED", occurredAt: new Date("2023-01-01") });
  // Alice opted in AND was approved for the wall (with a photo); the other named
  // donors (dp1/dp2/dSpon) never opted in, so they must NOT appear on the wall.
  await prisma.donor.update({ where: { id: dA.id }, data: { wallMessage: `Thank you ${T}`, wallTier: "friend", wallStatus: "APPROVED", avatarUrl: `/api/files/donors/alice-${T}.jpg` } });

  const [students, projects, wall] = await Promise.all([projectStudents(), projectProjects(), projectDonorWall()]);
  const sFullPub = await projectStudentBySlug(sFull.slug!);
  const detail = await projectStudentDetail(sFull.slug!);
  const projPub = await projectProjectBySlug(project.slug);

  console.log("\nWhitelist (the snapshot test) — LIST projection");
  assertWhitelist("students", students, STUDENT_KEYS);
  assertWhitelist("student-by-slug", sFullPub ? [sFullPub] : [], STUDENT_KEYS);
  assertWhitelist("projects", projects, PROJECT_KEYS);
  assertWhitelist("donor-wall", wall, DONORWALL_KEYS);

  console.log("\nStudent DETAIL projection — strict allow-list (Phase 7 tightening)");
  assertWhitelist("student-detail", detail ? [detail] : [], STUDENT_DETAIL_KEYS);
  check("detail resolved", !!detail);
  const dkeys = detail ? Object.keys(detail) : [];
  // Field-by-field OMISSION — a future model field can't silently start leaking.
  for (const forbidden of ["fullName", "guardianName", "gender", "ethnicity", "isOrphan", "village", "fatherProfession", "motherProfession", "dob", "roll", "totalStudents", "targetPeriod"]) {
    check(`detail OMITS "${forbidden}"`, !dkeys.includes(forbidden));
  }
  // Field-by-field PRESENCE — the approved set is actually delivered.
  for (const required of ["firstName", "school", "grade", "district", "purpose", "careerGoal", "donors", "portraitUrl"]) {
    check(`detail INCLUDES "${required}"`, dkeys.includes(required));
  }
  check("detail exposes the FIRST name only", detail?.firstName === "Full");
  check("detail.district correct (kept)", detail?.district === "Rangamati");
  check("detail.careerGoal kept", detail?.careerGoal === "doctor");
  check("detail.school from session institution", detail?.school === "Test Institution");

  console.log("\nNo PII value leaks into any projected output (list + detail)");
  const blob = JSON.stringify({ students, sFullPub, detail, projects, projPub, wall });
  check("fullName never serialized", !blob.includes(SECRET_FULL));
  check("fatherName never serialized", !blob.includes(SECRET_FATHER));
  check("motherName never serialized", !blob.includes(SECRET_MOTHER));
  check("dob never serialized", !blob.includes("2010-05-05"));
  check("ethnicity never serialized", !blob.includes(SECRET_ETH));
  check("village never serialized", !blob.includes(SECRET_VILLAGE));
  check("father's profession never serialized", !blob.includes(SECRET_FPROF));
  check("mother's profession never serialized", !blob.includes(SECRET_MPROF));
  check("guardian name never serialized", !blob.includes(SECRET_GUARDIAN));
  check("family income never serialized", !blob.includes(SECRET_INCOME));
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
  // ISOLATED + EXACT: own project / own student — robust regardless of other data.
  check("project fundingRaised = 13000 (8000 net + 5000 legacy; void excluded)", projPub?.fundingRaised === 13000, `got ${projPub?.fundingRaised}`);
  check("sFull fundedAmount = 3000 (isolated directed gift)", sFullPub?.fundedAmount === 3000, `got ${sFullPub?.fundedAmount}`);
  // AGGREGATION LOGIC: projectStats() must equal a DIRECT DB aggregate using the SAME
  // filters — verifies the summing/counting logic (void/refund/pending handling, distinct
  // donors, visible-student filter) WITHOUT asserting a brittle absolute delta that a
  // concurrent writer on the shared branch could shift. This is the flakiness fix.
  assertWhitelist("stats", [await projectStats()], STATS_KEYS);
  const cons = await statsConsistent();
  check("stats aggregation matches a direct DB aggregate (donorCount, totalRaised, studentCount, schoolCount)", cons.ok, cons.detail);

  console.log("\nDonor wall");
  const alice = wall.find((w) => w.message === `Thank you ${T}`);
  check("approved named donor → name, tier, avatar, year present", alice?.displayName === `Alice${T}` && alice?.tier === "friend" && alice?.avatarUrl === `/api/files/donors/alice-${T}.jpg` && typeof alice?.year === "number");
  const anon = wall.find((w) => w.displayName === "Anonymous");
  check("anonymous donor → displayName 'Anonymous', no name", !!anon && !JSON.stringify(anon).includes(SECRET_ANON));
  // Named donors who never opted in / weren't approved must NOT be on the public wall.
  check("unapproved named donor is NOT on the wall", !wall.some((w) => w.displayName === `P1${T}`));

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
  await prisma.school.deleteMany({ where: { id: { in: schoolIds } } });
  console.log("  (cleaned up test data)");
}

main()
  .catch((e) => { console.error("verify-projection error:", e); failures++; })
  .finally(async () => { await prisma.$disconnect(); process.exit(failures === 0 ? 0 : 1); });
