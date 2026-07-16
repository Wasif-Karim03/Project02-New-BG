import { prisma } from "@/lib/prisma";
import { portraitVisible } from "@/lib/public/consent";

// The thing a gift is directed at, resolved from a public slug. Kept in one place
// so the choice page (/give) and the checkout page (/give/checkout) agree.
export type Recipient =
  | { kind: "STUDENT"; id: string; label: string; portraitUrl: string | null; goal: number; funded: number }
  | { kind: "PROJECT"; id: string; label: string; summary: string | null }
  | { kind: "GENERAL" };

export async function resolveRecipient(sp: { student?: string; project?: string }): Promise<Recipient> {
  if (sp.student) {
    const s = await prisma.student.findFirst({
      where: { slug: sp.student, status: "ACTIVE", active: true, showOnWebsite: true },
      select: { id: true, firstName: true, portraitUrl: true, requireAmount: true, portraitConsent: true, storyConsent: true, consentScopes: true, consentRevokedAt: true },
    });
    if (s) {
      const funded = await prisma.donation.aggregate({ where: { studentId: s.id, designationType: "STUDENT", status: "SUCCEEDED" }, _sum: { amount: true, refundedAmount: true } });
      return {
        kind: "STUDENT", id: s.id, label: s.firstName,
        portraitUrl: portraitVisible(s) ? s.portraitUrl : null,
        goal: s.requireAmount ?? 0,
        funded: Math.max(0, (funded._sum.amount ?? 0) - (funded._sum.refundedAmount ?? 0)),
      };
    }
  }
  if (sp.project) {
    const p = await prisma.project.findFirst({ where: { slug: sp.project, status: "ACTIVE" }, select: { id: true, title: true, summary: true } });
    if (p) return { kind: "PROJECT", id: p.id, label: p.title, summary: p.summary };
  }
  return { kind: "GENERAL" };
}

/** The ?student=/?project= querystring to carry the recipient across pages, or "". */
export function recipientQuery(sp: { student?: string; project?: string }, recipient: Recipient): string {
  if (recipient.kind === "STUDENT" && sp.student) return `?student=${encodeURIComponent(sp.student)}`;
  if (recipient.kind === "PROJECT" && sp.project) return `?project=${encodeURIComponent(sp.project)}`;
  return "";
}
