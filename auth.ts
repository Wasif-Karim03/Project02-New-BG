import { PrismaAdapter } from "@auth/prisma-adapter";
import type { AccountStatus, Role } from "@prisma/client";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Nodemailer from "next-auth/providers/nodemailer";
import { z } from "zod";
import { isSignInAllowed, verifyCredentials } from "@/lib/auth/credentials";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Self-hosted over http(localhost) → trust the host so sign-in isn't rejected.
  trustHost: true,
  // Use our own /login page (the built-in Auth.js page's CSRF/action handling is
  // fragile in a production build over http).
  pages: { signIn: "/login" },
  // Credentials requires JWT sessions, so role/status ride on the JWT (the
  // Session table stays for any future DB-session provider but is dormant here).
  session: { strategy: "jwt" },
  providers: [
    // PRIMARY: email + password.
    Credentials({
      name: "Email and password",
      credentials: { email: { label: "Email" }, password: { label: "Password", type: "password" } },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await verifyCredentials(parsed.data.email, parsed.data.password);
        if (!user) return null; // unknown email or wrong password
        if (!isSignInAllowed(user.status)) return null; // PENDING / SUSPENDED / REJECTED
        return user;
      },
    }),
    // FALLBACK / dev: magic link. Empty EMAIL_SERVER => link is printed to the
    // server console (no external email dependency). Real SMTP wired at handoff.
    Nodemailer({
      from: process.env.EMAIL_FROM,
      server: process.env.EMAIL_SERVER || { host: "localhost", port: 1025 },
      async sendVerificationRequest({ identifier, url }) {
        console.log(`\n[auth] Magic sign-in link for ${identifier}:\n  ${url}\n`);
      },
    }),
  ],
  callbacks: {
    // Central sign-in gate for ALL providers (defense in depth; also covers the
    // magic-link path, where authorize() does not run).
    async signIn({ user }) {
      const status = user?.status;
      if (status && !isSignInAllowed(status)) return false;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.status = user.status;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as Role;
        session.user.status = token.status as AccountStatus;
      }
      return session;
    },
  },
});
