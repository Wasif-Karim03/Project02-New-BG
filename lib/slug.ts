import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** Lowercase, ASCII-ish, dash-separated. Strips diacritics where possible. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "student";
}

/** Short random base36 suffix (default 4 chars) for slug uniqueness. */
export function randomSuffix(len = 4): string {
  // 3 bytes -> 6 base36-ish chars; slice to len.
  return randomBytes(4).toString("hex").replace(/[^a-z0-9]/g, "").slice(0, len) || "0000";
}

/**
 * Generate a unique Student.slug from firstName + a short random suffix, e.g.
 * "rima-x7q2". Retries on the (rare) collision; the DB @unique is the backstop.
 * Used AT APPROVAL — the slug is immutable once set.
 */
export async function generateUniqueStudentSlug(firstName: string, attempts = 6): Promise<string> {
  const base = slugify(firstName);
  for (let i = 0; i < attempts; i++) {
    const candidate = `${base}-${randomSuffix()}`;
    const existing = await prisma.student.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  throw new Error(`Could not generate a unique slug for "${firstName}" after ${attempts} attempts`);
}
