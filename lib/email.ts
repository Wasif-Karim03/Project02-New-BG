/**
 * Minimal email sender. In dev (EMAIL_SERVER empty) it prints to the server
 * console — no external provider needed. At handoff, point EMAIL_SERVER at real
 * SMTP (or swap the transport) and messages go out for real. Provider-agnostic.
 */
export async function sendEmail(msg: { to: string; subject: string; text: string }): Promise<void> {
  if (!process.env.EMAIL_SERVER) {
    console.log(`\n[email → ${msg.to}] ${msg.subject}\n${msg.text}\n`);
    return;
  }
  // Real SMTP delivery is wired at handoff (nodemailer is already a dependency).
  const nodemailer = (await import("nodemailer")) as unknown as {
    createTransport: (opts: string) => { sendMail: (o: Record<string, unknown>) => Promise<unknown> };
  };
  const transport = nodemailer.createTransport(process.env.EMAIL_SERVER);
  await transport.sendMail({ from: process.env.EMAIL_FROM, to: msg.to, subject: msg.subject, text: msg.text });
}
