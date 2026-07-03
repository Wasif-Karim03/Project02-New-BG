import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// A lightweight, HMAC-signed cookie that identifies an APPLICANT while they fill
// their form. Deliberately NOT an Auth.js session: a PENDING applicant still
// can't hold a real session (the sign-in gate stays intact); this only scopes the
// /apply flow to their own draft. Full login happens after approval.
const COOKIE = "bg_applicant";
const SECRET = process.env.AUTH_SECRET || "dev-insecure-secret";

function sign(userId: string): string {
  const mac = createHmac("sha256", SECRET).update(userId).digest("base64url");
  return `${userId}.${mac}`;
}
function verify(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const userId = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", SECRET).update(userId).digest("base64url");
  try {
    if (mac.length === expected.length && timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return userId;
  } catch {}
  return null;
}

export async function setApplicantCookie(userId: string) {
  (await cookies()).set(COOKIE, sign(userId), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 2 });
}
export async function getApplicantUserId(): Promise<string | null> {
  const c = (await cookies()).get(COOKIE)?.value;
  return c ? verify(c) : null;
}
export async function clearApplicantCookie() {
  (await cookies()).delete(COOKIE);
}
