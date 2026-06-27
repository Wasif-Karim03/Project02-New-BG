# Changelog

All notable changes to the operational app. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Dates are ISO-8601.

## [Unreleased]

### Phase A — Foundation (2026-06-25)

- Scaffolded a standalone Next.js 16 (App Router, TS strict) app, separate from the
  marketing site. Pinned Prisma to 6.x (stable `prisma-client-js` generator).
- Wired Prisma + the canonical operational schema; first migration `init` creates
  12 enums and 18 tables, plus hand-authored SQL the schema language can't express:
  a partial unique index enforcing a single current `AcademicSession`, and CHECK
  constraints tying `Donation`/`Subscription` `designationType` to their target FK.
- **Contract changes** (applied to `schema.prisma` + `PUBLIC_PROJECTION.md`, signed off):
  - `Student.slug` / `Project.slug` — unique, generated, immutable public keys.
  - USD-only v1 (currency columns retained; rejected at the Zod boundary).
  - `StripeEvent` ledger for event-level webhook idempotency.
  - `Donation.refundedAmount` for partial-refund accounting; projections subtract it.
  - `sponsorshipStatus` = active subscription OR directed SUCCEEDED donation in the
    current session; `donorCount` distinct-Donor v1 limitation documented.
  - Removed the dangling `AcademicSession.subscriptions` back-relation (subscriptions
    are donor-scoped/cross-term; per-cycle attribution lives on `Donation.sessionId`).
  - Added `User.passwordHash` (nullable) for email+password login.
- **Auth.js v5**: Prisma adapter, JWT sessions, email+password (primary) +
  magic-link (dev console transport, fallback). `role` + `status` on the JWT/session;
  only `ACTIVE` accounts may sign in. Passwords hashed with Node `crypto.scrypt`
  (no native deps). Verified: admin sign-in, role/status propagation, and
  PENDING/SUSPENDED/wrong-password refusal (`npm run verify:auth`).
- Seed: one `ADMIN` (ACTIVE), three `AcademicSession`s (two past + one current), five
  schools (slugs mirror the marketing site for the Phase H bridge). Idempotent.
- Hygiene: README, this changelog, `docs/ARCHITECTURE.md`, structure guard, `.env.example`,
  `.gitignore` hardening, `docker-compose.yml`.
