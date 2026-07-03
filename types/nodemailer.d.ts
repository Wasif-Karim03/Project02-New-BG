// nodemailer ships no bundled types; it is only used by the SMTP path in
// lib/email.ts (wired at handoff). A minimal ambient declaration is enough.
declare module "nodemailer";
