import { sendEmail } from "@/lib/email";

// Human labels for the decision email, keyed by role. Falls back to a generic one.
const LABELS: Record<string, string> = {
  STUDENT: "scholarship application",
  MENTOR: "mentor application",
  DONOR: "donor account",
};

/**
 * Notify an applicant/account of an admin approve/reject decision.
 * - Approved → a welcome note with a sign-in link.
 * - Rejected → a brief, polite "not approved" note inviting them to get in touch.
 *   (The internal rejection reason is NEVER included — it's an admin-only note.)
 *
 * Best-effort: a mail failure is logged, never thrown, so it can't roll back or
 * block the admin's decision. No-ops when there's no recipient email on file
 * (e.g. a mentor-registered, login-less student).
 */
export async function sendDecisionEmail(opts: {
  to: string | null | undefined;
  name?: string | null;
  role?: string | null; // STUDENT / MENTOR / DONOR — selects the label
  label?: string; // explicit label override
  approved: boolean;
}): Promise<void> {
  if (!opts.to) return;
  const label = opts.label ?? LABELS[opts.role ?? ""] ?? "account request";
  const loginUrl = `${process.env.AUTH_URL || "http://localhost:3000"}/login`;
  const hi = opts.name ? `Hi ${opts.name},` : "Hello,";
  try {
    if (opts.approved) {
      await sendEmail({
        to: opts.to,
        subject: `Your Bridging Generations ${label} has been approved`,
        text: `${hi}\n\nGreat news — your ${label} has been approved. You can now sign in to your account here:\n\n${loginUrl}\n\nWelcome to Bridging Generations.\n\n— The Bridging Generations Team`,
      });
    } else {
      await sendEmail({
        to: opts.to,
        subject: `Update on your Bridging Generations ${label}`,
        text: `${hi}\n\nThank you for your interest in Bridging Generations. After review, your ${label} was not approved at this time.\n\nIf you have any questions or would like to discuss this further, please reply to this email or get in touch — we're always happy to help.\n\n— The Bridging Generations Team`,
      });
    }
  } catch (e) {
    // Notification is best-effort — never block the admin decision on it.
    console.error("decision email failed:", (e as Error).message);
  }
}
