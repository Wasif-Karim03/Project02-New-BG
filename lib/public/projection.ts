import type { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { portraitVisible, storyVisible } from "@/lib/public/consent";

// =============================================================================
// PUBLIC PROJECTION — the ONLY path that reads PII tables for public output.
// Whitelist, not blacklist: only the *_KEYS fields below ever cross. Consent
// gates are evaluated here, server-side, and a failed gate OMITS the field.
// See PUBLIC_PROJECTION.md. These key arrays are the single source of truth the
// snapshot test asserts against.
// =============================================================================

export const STUDENT_KEYS = ["id", "slug", "firstName", "schoolName", "grade", "sponsorshipStatus", "portraitUrl", "quote", "bio",
  // Sponsorship "ask" — intentionally public (the funding model). Photo/story stay consent-gated.
  "registrationId", "purpose", "requireAmount", "fundedAmount", "perInstallment", "currency", "isOrphan", "ethnicity", "district"] as const;
export const PROJECT_KEYS = ["title", "slug", "summary", "status", "displayOrder", "fundingGoal", "fundingRaised", "currency"] as const;
export const STATS_KEYS = ["studentCount", "schoolCount", "donorCount", "totalRaised", "currency"] as const;
export const DONORWALL_KEYS = ["id", "displayName", "message", "tier", "year", "avatarUrl"] as const;

export type PublicStudent = {
  id: string; slug: string; firstName: string; schoolName: string | null;
  grade: string | null; sponsorshipStatus: "sponsored" | "waiting";
  portraitUrl?: string; quote?: string; bio?: string;
  // Sponsorship "ask" — shown publicly to attract sponsors (the funding model).
  registrationId: string | null;
  purpose: string | null;
  requireAmount: number; // goal, minor units (0 if unset)
  fundedAmount: number; // real raised toward this student, minor units
  perInstallment: number | null; // minor units
  currency: string;
  isOrphan: boolean;
  ethnicity: string | null;
  district: string | null;
};
// Full public student profile (the per-student "donate" page). Family/guardian
// details are the sponsorship ask (matching the sector). Photo/story stay consent-gated.
export type PublicStudentDetail = PublicStudent & {
  fullName: string | null;
  gender: string | null;
  school: string | null;
  roll: string | null;
  totalStudents: string | null;
  fatherProfession: string | null;
  motherProfession: string | null;
  guardianName: string | null;
  // guardianAddress and familyIncome are minors' PII — intentionally NOT projected
  // to the public API (they never cross the boundary).
  careerGoal: string | null;
  targetPeriod: string | null;
  village: string | null;
  donors: { name: string; amount: number; year: number }[];
};

export type PublicProject = {
  title: string; slug: string; summary: string | null; status: ProjectStatus;
  displayOrder: number | null; fundingGoal: number; fundingRaised: number; currency: string;
};
export type PublicStats = { studentCount: number; schoolCount: number; donorCount: number; totalRaised: number; currency: string };
export type PublicDonorWallEntry = { id?: string; displayName: string; message?: string; tier?: string; year?: number; avatarUrl?: string };

// Per-donor public profile with giving history. NAMED donors only — anonymous
// donors chose anonymity, so they get no public profile (404). Exposes amounts by
// explicit product decision (public donor wall with per-gift chart).
export type PublicDonorProfile = {
  displayName: string;
  tier?: string;
  avatarUrl?: string;
  currency: string;
  totalAmount: number; // minor units, net of refunds
  gifts: { date: string; amount: number }[]; // date = YYYY-MM-DD, amount = minor units net
};

export async function projectDonorProfile(id: string): Promise<PublicDonorProfile | null> {
  const donor = await prisma.donor.findFirst({
    // A public profile exists ONLY for a named donor the admin approved for the wall.
    where: { id, isAnonymous: false, wallStatus: "APPROVED", donations: { some: { status: "SUCCEEDED" } } },
    select: {
      name: true,
      wallTier: true,
      avatarUrl: true,
      donations: {
        where: { status: "SUCCEEDED" },
        select: { amount: true, refundedAmount: true, currency: true, occurredAt: true },
        orderBy: { occurredAt: "asc" },
      },
    },
  });
  if (!donor) return null;
  const gifts = donor.donations.map((g) => ({ date: g.occurredAt.toISOString().slice(0, 10), amount: g.amount - g.refundedAmount }));
  const profile: PublicDonorProfile = {
    displayName: donor.name,
    currency: donor.donations[0]?.currency ?? "USD",
    totalAmount: gifts.reduce((s, g) => s + g.amount, 0),
    gifts,
  };
  if (donor.wallTier) profile.tier = donor.wallTier;
  if (donor.avatarUrl) profile.avatarUrl = donor.avatarUrl;
  return profile;
}

async function currentSessionId(): Promise<string | null> {
  const s = await prisma.academicSession.findFirst({ where: { isCurrent: true }, select: { id: true } });
  return s?.id ?? null;
}

// A student is "sponsored" iff an ACTIVE subscription OR a directed SUCCEEDED
// donation in the CURRENT session targets them.
async function sponsoredStudentIds(sessionId: string | null): Promise<Set<string>> {
  const [subs, directed] = await Promise.all([
    prisma.subscription.findMany({ where: { status: "ACTIVE", studentId: { not: null } }, select: { studentId: true } }),
    sessionId
      ? prisma.donation.findMany({ where: { designationType: "STUDENT", status: "SUCCEEDED", sessionId, studentId: { not: null } }, select: { studentId: true } })
      : Promise.resolve([] as { studentId: string | null }[]),
  ]);
  const set = new Set<string>();
  for (const s of subs) if (s.studentId) set.add(s.studentId);
  for (const d of directed) if (d.studentId) set.add(d.studentId);
  return set;
}

const studentSelect = {
  id: true, slug: true, firstName: true, portraitUrl: true, quote: true, bio: true,
  portraitConsent: true, storyConsent: true, consentScopes: true, consentRevokedAt: true,
  registrationId: true, purpose: true, requireAmount: true, perInstallment: true,
  isOrphan: true, ethnicity: true, addrDistrict: true,
  school: { select: { name: true } },
} as const;

type StudentRow = {
  id: string; slug: string | null; firstName: string; portraitUrl: string | null; quote: string | null; bio: string | null;
  portraitConsent: import("@prisma/client").ConsentStatus; storyConsent: import("@prisma/client").ConsentStatus;
  consentScopes: import("@prisma/client").ConsentScope[]; consentRevokedAt: Date | null; school: { name: string } | null;
  registrationId: string | null; purpose: string | null; requireAmount: number | null; perInstallment: number | null;
  isOrphan: boolean; ethnicity: string | null; addrDistrict: string | null;
};

function toPublicStudent(s: StudentRow, grade: string | null, sponsored: Set<string>, fundedAmount: number): PublicStudent {
  const out: PublicStudent = {
    id: s.id,
    slug: s.slug as string, // ACTIVE students always have a slug (assigned at approval)
    firstName: s.firstName,
    schoolName: s.school?.name ?? null,
    grade,
    sponsorshipStatus: sponsored.has(s.id) ? "sponsored" : "waiting",
    registrationId: s.registrationId,
    purpose: s.purpose,
    requireAmount: s.requireAmount ?? 0,
    fundedAmount,
    perInstallment: s.perInstallment,
    currency: "USD",
    isOrphan: s.isOrphan,
    ethnicity: s.ethnicity,
    district: s.addrDistrict,
  };
  if (portraitVisible(s) && s.portraitUrl) out.portraitUrl = s.portraitUrl; // portrait gate
  if (storyVisible(s)) { // story/bio gate
    if (s.quote) out.quote = s.quote;
    if (s.bio) out.bio = s.bio;
  }
  return out;
}

/** Real amount raised toward each student (SUCCEEDED, directed donations), minor units. */
async function studentRaisedMap(): Promise<Map<string, number>> {
  const raised = await prisma.donation.groupBy({
    by: ["studentId"],
    where: { status: "SUCCEEDED", designationType: "STUDENT", studentId: { not: null } },
    _sum: { amount: true, refundedAmount: true },
  });
  // Clamp at 0 — a net-negative adjustment run should never render as negative funding.
  return new Map(raised.map((r) => [r.studentId as string, Math.max(0, (r._sum.amount ?? 0) - (r._sum.refundedAmount ?? 0))]));
}

export async function projectStudents(): Promise<PublicStudent[]> {
  const sid = await currentSessionId();
  const [students, sessions, sponsored, raised] = await Promise.all([
    prisma.student.findMany({ where: { status: "ACTIVE", active: true, slug: { not: null }, showOnWebsite: true }, select: studentSelect, orderBy: { firstName: "asc" } }),
    sid ? prisma.studentSession.findMany({ where: { sessionId: sid }, select: { studentId: true, grade: true } }) : Promise.resolve([] as { studentId: string; grade: string | null }[]),
    sponsoredStudentIds(sid),
    studentRaisedMap(),
  ]);
  const gradeMap = new Map(sessions.map((x) => [x.studentId, x.grade]));
  return students.map((s) => toPublicStudent(s as StudentRow, gradeMap.get(s.id) ?? null, sponsored, raised.get(s.id) ?? 0));
}

export async function projectStudentBySlug(slug: string): Promise<PublicStudent | null> {
  const s = await prisma.student.findFirst({ where: { slug, status: "ACTIVE", active: true, showOnWebsite: true }, select: studentSelect });
  if (!s) return null;
  const sid = await currentSessionId();
  const [session, sponsored, raised] = await Promise.all([
    sid ? prisma.studentSession.findFirst({ where: { sessionId: sid, studentId: s.id }, select: { grade: true } }) : Promise.resolve(null),
    sponsoredStudentIds(sid),
    studentRaisedMap(),
  ]);
  return toPublicStudent(s as StudentRow, session?.grade ?? null, sponsored, raised.get(s.id) ?? 0);
}

export async function projectStudentDetail(slug: string): Promise<PublicStudentDetail | null> {
  const s = await prisma.student.findFirst({
    where: { slug, status: "ACTIVE", active: true, showOnWebsite: true },
    select: {
      ...studentSelect,
      fullName: true, gender: true, fatherProfession: true, motherProfession: true,
      addrVillage: true, guardianName: true,
      careerGoal: true, targetPeriod: true,
    },
  });
  if (!s) return null;
  const sid = await currentSessionId();
  const [session, sponsored, raised, donations] = await Promise.all([
    sid
      ? prisma.studentSession.findFirst({ where: { sessionId: sid, studentId: s.id }, select: { grade: true, institutionName: true, formerRoll: true, totalStudent: true } })
      : Promise.resolve(null),
    sponsoredStudentIds(sid),
    studentRaisedMap(),
    prisma.donation.findMany({
      where: { studentId: s.id, designationType: "STUDENT", status: "SUCCEEDED" },
      select: { amount: true, refundedAmount: true, occurredAt: true, donor: { select: { name: true, isAnonymous: true } } },
      orderBy: { occurredAt: "desc" },
    }),
  ]);
  const base = toPublicStudent(s as StudentRow, session?.grade ?? null, sponsored, raised.get(s.id) ?? 0);
  return {
    ...base,
    fullName: s.fullName,
    gender: s.gender,
    school: session?.institutionName ?? s.school?.name ?? null,
    roll: session?.formerRoll ?? null,
    totalStudents: session?.totalStudent ?? null,
    fatherProfession: s.fatherProfession,
    motherProfession: s.motherProfession,
    guardianName: s.guardianName,
    careerGoal: s.careerGoal,
    targetPeriod: s.targetPeriod,
    village: s.addrVillage,
    donors: donations.map((d) => ({
      name: d.donor.isAnonymous ? "Anonymous" : d.donor.name,
      amount: d.amount - d.refundedAmount,
      year: new Date(d.occurredAt).getFullYear(),
    })),
  };
}

export async function projectProjects(): Promise<PublicProject[]> {
  const [projects, raised] = await Promise.all([
    prisma.project.findMany({ select: { id: true, title: true, slug: true, summary: true, status: true, displayOrder: true, fundingGoal: true, currency: true }, orderBy: { displayOrder: "asc" } }),
    prisma.donation.groupBy({ by: ["projectId"], where: { status: "SUCCEEDED", projectId: { not: null } }, _sum: { amount: true, refundedAmount: true } }),
  ]);
  const raisedMap = new Map(raised.map((r) => [r.projectId, Math.max(0, (r._sum.amount ?? 0) - (r._sum.refundedAmount ?? 0))]));
  // Construct explicitly — id is used to join fundingRaised but NEVER projected.
  return projects.map((p) => ({
    title: p.title, slug: p.slug, summary: p.summary, status: p.status, displayOrder: p.displayOrder,
    fundingGoal: p.fundingGoal, fundingRaised: raisedMap.get(p.id) ?? 0, currency: p.currency,
  }));
}

export async function projectProjectBySlug(slug: string): Promise<PublicProject | null> {
  return (await projectProjects()).find((p) => p.slug === slug) ?? null;
}

export async function projectStats(): Promise<PublicStats> {
  // Count only PUBLICLY-VISIBLE students — the SAME filter as projectStudents() — so
  // the homepage "students" number never exceeds the directory a visitor can browse.
  // schoolCount is the distinct schools those visible students attend (not every
  // seeded School row), so a fresh site never advertises schools with no live student.
  const [visibleStudents, distinctDonors, totalAgg] = await Promise.all([
    prisma.student.findMany({
      where: { status: "ACTIVE", active: true, slug: { not: null }, showOnWebsite: true },
      select: { schoolId: true },
    }),
    prisma.donation.findMany({ where: { status: "SUCCEEDED" }, select: { donorId: true }, distinct: ["donorId"] }),
    prisma.donation.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amount: true, refundedAmount: true } }),
  ]);
  const schoolCount = new Set(visibleStudents.map((s) => s.schoolId).filter((id): id is string => Boolean(id))).size;
  return {
    studentCount: visibleStudents.length,
    schoolCount,
    donorCount: distinctDonors.length,
    totalRaised: Math.max(0, (totalAgg._sum.amount ?? 0) - (totalAgg._sum.refundedAmount ?? 0)),
    currency: "USD",
  };
}

export async function projectDonorWall(): Promise<PublicDonorWallEntry[]> {
  const donors = await prisma.donor.findMany({
    where: {
      donations: { some: { status: "SUCCEEDED" } },
      // Named donors appear ONLY once an admin approves them for the wall; anonymous
      // donors always appear as "Anonymous" (no approval needed). Everyone else —
      // pending, declined, or never-opted-in (e.g. guest gifts) — is off the wall.
      OR: [{ isAnonymous: false, wallStatus: "APPROVED" }, { isAnonymous: true }],
    },
    // Stable, deterministic order so the public wall doesn't reshuffle on refresh.
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, name: true, isAnonymous: true, avatarUrl: true, wallMessage: true, wallTier: true,
      donations: { where: { status: "SUCCEEDED" }, select: { occurredAt: true }, orderBy: { occurredAt: "desc" }, take: 1 },
    },
  });
  return donors.map((d) => {
    if (d.isAnonymous) {
      // Nothing identifying — name, photo, message, and tier are all withheld.
      const entry: PublicDonorWallEntry = { displayName: "Anonymous" };
      const latest = d.donations[0]?.occurredAt;
      if (latest) entry.year = new Date(latest).getFullYear();
      return entry;
    }
    const entry: PublicDonorWallEntry = { id: d.id, displayName: d.name };
    if (d.avatarUrl) entry.avatarUrl = d.avatarUrl;
    if (d.wallMessage) entry.message = d.wallMessage;
    if (d.wallTier) entry.tier = d.wallTier;
    const latest = d.donations[0]?.occurredAt;
    if (latest) entry.year = new Date(latest).getFullYear();
    return entry;
  });
}
