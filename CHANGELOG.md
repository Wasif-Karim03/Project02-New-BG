# Changelog

All notable changes to the operational app. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Dates are ISO-8601.

## [Unreleased]

### Phase C — Mentor scoping & evaluations (2026-07-01)

- **`assertMentorCanAccess` is the one door** (`lib/auth/mentor-access.ts`): pure,
  default-deny row-level guard. A mentor may access a student ONLY via an ACTIVE
  `MentorAssignment` (active && unassignedAt == null) for the relevant session
  (explicit or current). Every failure mode throws a single uniform
  `AccessDeniedError` (no existence disclosure about a minor's record).
- **`withMentorAccess`** wraps every sensitive mentor read/write: runs the guard,
  audits the outcome (granted → the action; denied → `mentor.access.denied`,
  including owner-scope failures thrown inside the operation), keyed by the STUDENT
  with the mentor as actor.
- Mentor evaluation CRUD (`lib/services/mentor.ts`) — contact log, remarks, file
  reference, publishConsent — all routed through the guard; mutations are
  owner-scoped (a mentor edits only their own evaluations). Admin assign/unassign
  (`lib/services/assignments.ts`); unassigning cuts access immediately.
- Route surface: mentor `/my-students` (guarded evaluation logging) and admin
  `/assignments` (assign/unassign), both server-side authorized.
- Verified (`npm run verify:mentor`), negatives as the proof — all denials are
  guard-produced `AccessDeniedError`, not empty data: cross-mentor access, unassigned
  student, wrong session, and post-unassign access are refused; assigned access
  works scoped to the session and is audited; evaluation CRUD works only within the
  guard (unassigned and non-owner denied). No object-storage upload yet — `fileUrl`
  stores a reference only (deferred).

### Phase B — Accounts & approval workflow (2026-06-26)

- Service layer (`lib/services/*`, `lib/validation/*`, `lib/slug.ts`, `lib/auth/guards.ts`):
  - Three entry paths into one queue: self-signup (donor/mentor/student) → `User(PENDING)`
    + profile; mentor-registered student → `Student(PENDING)`, no login; admin-created
    record → auto-`ACTIVE` **and** audited. Guest donor → `Donor` row, no approval, no queue.
  - Approve/reject for accounts and login-less students. Reject **requires a reason**.
    Every decision writes an `AuditLog` row (actor, action, entity, before/after, reason).
    Approving a self-signup student account **cascades** to its `Student` profile and
    assigns the immutable public `slug` at approval.
  - Sign-in reuses the Phase A `isSignInAllowed` gate, so approved-then-suspended is
    handled consistently.
- Thin route/action layer: signup server actions + page (`/signup`); admin-gated approval
  queue (`/approvals`) with approve/reject server actions. Authorization checked
  server-side on the actual action (`requireAdmin`), not just in the UI.
- Verified (`npm run verify:approvals`): three paths/one queue, guest donor excluded,
  admin-create audited, PENDING cannot get a session until approved, approval enables it,
  rejection refuses it and logs the reason, and rejection without a reason is refused.

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
