/**
 * Provider-agnostic email sender. Delivery backend is chosen by env, in order:
 *   1. RESEND_API_KEY  → Resend HTTP API (recommended on serverless — no SMTP
 *      socket to keep open, retriable, fast).
 *   2. EMAIL_SERVER    → SMTP via nodemailer (any provider, incl. Resend's SMTP).
 *   3. neither (dev)   → print to the server console, no external dependency.
 * The From address is EMAIL_FROM and must be on a domain verified with the provider.
 */
/**
 * True when a real mail backend is configured (Resend or SMTP). Verification codes
 * are only ever returned in-band ("devCode") when this is FALSE — i.e. dev, where
 * mail is printed to the console. This must gate every devCode, or a production
 * deploy using Resend would leak codes in API responses.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY || process.env.EMAIL_SERVER);
}

export async function sendEmail(msg: { to: string; subject: string; text: string }): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "no-reply@bridginggenerations.org";

  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: msg.to, subject: msg.subject, text: msg.text }),
    });
    if (!res.ok) throw new Error(`Resend send failed (${res.status}): ${await res.text()}`);
    return;
  }

  if (process.env.EMAIL_SERVER) {
    const nodemailer = (await import("nodemailer")) as unknown as {
      createTransport: (opts: string) => { sendMail: (o: Record<string, unknown>) => Promise<unknown> };
    };
    const transport = nodemailer.createTransport(process.env.EMAIL_SERVER);
    await transport.sendMail({ from, to: msg.to, subject: msg.subject, text: msg.text });
    return;
  }

  console.log(`\n[email → ${msg.to}] ${msg.subject}\n${msg.text}\n`);
}
