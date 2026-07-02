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

export const STUDENT_KEYS = ["id", "slug", "firstName", "schoolName", "grade", "sponsorshipStatus", "portraitUrl", "quote", "bio"] as const;
export const PROJECT_KEYS = ["title", "slug", "summary", "status", "displayOrder", "fundingGoal", "fundingRaised", "currency"] as const;
export const STATS_KEYS = ["studentCount", "schoolCount", "donorCount", "totalRaised", "currency"] as const;
export const DONORWALL_KEYS = ["displayName", "message", "tier", "year"] as const;

export type PublicStudent = {
  id: string; slug: string; firstName: string; schoolName: string | null;
  grade: string | null; sponsorshipStatus: "sponsored" | "waiting";
  portraitUrl?: string; quote?: string; bio?: string;
};
export type PublicProject = {
  title: string; slug: string; summary: string | null; status: ProjectStatus;
  displayOrder: number | null; fundingGoal: number; fundingRaised: number; currency: string;
};
export type PublicStats = { studentCount: number; schoolCount: number; donorCount: number; totalRaised: number; currency: string };
export type PublicDonorWallEntry = { displayName: string; message?: string; tier?: string; year?: number };

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
  school: { select: { name: true } },
} as const;

type StudentRow = {
  id: string; slug: string | null; firstName: string; portraitUrl: string | null; quote: string | null; bio: string | null;
  portraitConsent: import("@prisma/client").ConsentStatus; storyConsent: import("@prisma/client").ConsentStatus;
  consentScopes: import("@prisma/client").ConsentScope[]; consentRevokedAt: Date | null; school: { name: string } | null;
};

function toPublicStudent(s: StudentRow, grade: string | null, sponsored: Set<string>): PublicStudent {
  const out: PublicStudent = {
    id: s.id,
    slug: s.slug as string, // ACTIVE students always have a slug (assigned at approval)
    firstName: s.firstName,
    schoolName: s.school?.name ?? null,
    grade,
    sponsorshipStatus: sponsored.has(s.id) ? "sponsored" : "waiting",
  };
  if (portraitVisible(s) && s.portraitUrl) out.portraitUrl = s.portraitUrl; // portrait gate
  if (storyVisible(s)) { // story/bio gate
    if (s.quote) out.quote = s.quote;
    if (s.bio) out.bio = s.bio;
  }
  return out;
}

export async function projectStudents(): Promise<PublicStudent[]> {
  const sid = await currentSessionId();
  const [students, sessions, sponsored] = await Promise.all([
    prisma.student.findMany({ where: { status: "ACTIVE", slug: { not: null } }, select: studentSelect, orderBy: { firstName: "asc" } }),
    sid ? prisma.studentSession.findMany({ where: { sessionId: sid }, select: { studentId: true, grade: true } }) : Promise.resolve([] as { studentId: string; grade: string | null }[]),
    sponsoredStudentIds(sid),
  ]);
  const gradeMap = new Map(sessions.map((x) => [x.studentId, x.grade]));
  return students.map((s) => toPublicStudent(s as StudentRow, gradeMap.get(s.id) ?? null, sponsored));
}

export async function projectStudentBySlug(slug: string): Promise<PublicStudent | null> {
  const s = await prisma.student.findFirst({ where: { slug, status: "ACTIVE" }, select: studentSelect });
  if (!s) return null;
  const sid = await currentSessionId();
  const [session, sponsored] = await Promise.all([
    sid ? prisma.studentSession.findFirst({ where: { sessionId: sid, studentId: s.id }, select: { grade: true } }) : Promise.resolve(null),
    sponsoredStudentIds(sid),
  ]);
  return toPublicStudent(s as StudentRow, session?.grade ?? null, sponsored);
}

export async function projectProjects(): Promise<PublicProject[]> {
  const [projects, raised] = await Promise.all([
    prisma.project.findMany({ select: { id: true, title: true, slug: true, summary: true, status: true, displayOrder: true, fundingGoal: true, currency: true }, orderBy: { displayOrder: "asc" } }),
    prisma.donation.groupBy({ by: ["projectId"], where: { status: "SUCCEEDED", projectId: { not: null } }, _sum: { amount: true, refundedAmount: true } }),
  ]);
  const raisedMap = new Map(raised.map((r) => [r.projectId, (r._sum.amount ?? 0) - (r._sum.refundedAmount ?? 0)]));
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
  const [studentCount, schoolCount, distinctDonors, totalAgg] = await Promise.all([
    prisma.student.count({ where: { status: "ACTIVE" } }),
    prisma.school.count(),
    prisma.donation.findMany({ where: { status: "SUCCEEDED" }, select: { donorId: true }, distinct: ["donorId"] }),
    prisma.donation.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amount: true, refundedAmount: true } }),
  ]);
  return {
    studentCount,
    schoolCount,
    donorCount: distinctDonors.length,
    totalRaised: (totalAgg._sum.amount ?? 0) - (totalAgg._sum.refundedAmount ?? 0),
    currency: "USD",
  };
}

export async function projectDonorWall(): Promise<PublicDonorWallEntry[]> {
  const donors = await prisma.donor.findMany({
    where: { donations: { some: { status: "SUCCEEDED" } } },
    select: {
      name: true, isAnonymous: true, wallMessage: true, wallTier: true,
      donations: { where: { status: "SUCCEEDED" }, select: { occurredAt: true }, orderBy: { occurredAt: "desc" }, take: 1 },
    },
  });
  return donors.map((d) => {
    const entry: PublicDonorWallEntry = { displayName: d.isAnonymous ? "Anonymous" : d.name };
    if (d.wallMessage) entry.message = d.wallMessage;
    if (d.wallTier) entry.tier = d.wallTier;
    const latest = d.donations[0]?.occurredAt;
    if (latest) entry.year = new Date(latest).getFullYear();
    return entry;
  });
}
