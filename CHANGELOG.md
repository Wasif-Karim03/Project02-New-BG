# Changelog

All notable changes to the operational app. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Dates are ISO-8601.

## [Unreleased]

### Admin part — UI redesign + shared shell (2026-07-05)

- **Shared admin shell** (`app/(admin)/layout.tsx`): one auth gate for the whole admin
  area (removes the per-page copy), a fixed dark **sidebar** with grouped navigation
  (Overview / Queues / People / Money / Insights), a sticky header with the signed-in
  admin + sign-out, and a mobile nav fallback.
- **Design system** (`app/(admin)/_components/ui.tsx` + `AdminNav.tsx`): `PageHeader`,
  `Card`, `StatCard`, `Badge`, `EmptyState`, and shared button/input classes on a
  slate/stone/emerald/amber/red palette.
- **All 15 admin pages** restyled to the system (consistent cards, tables, badges,
  buttons, inputs) — dashboard, users, reports, audit, settings, approvals, applications
  (+ detail), roster (+ record editor), assignments, pledges, offline gifts, sponsorships,
  legacy import, pending donations. Build clean; every page verified 200 for an admin.

### Admin part — audit viewer + settings (2026-07-05)

- **Audit log viewer** (`/audit`): searchable, newest-first view of every logged action
  with the actor's email resolved (null → "system") and an action filter
  (`lib/services/audit-log.ts`, `npm run verify:audit-log`).
- **Settings** (`/settings`): editable payment channels (new `OrgSetting` key/value table;
  `/give` now reads them with env fallback), academic-session management (create /
  set-current, keeping the single-current invariant), and a year-end deactivation button.
  (`lib/services/settings.ts`, `npm run verify:settings`.)

### Admin part — reports & exports (2026-07-05)

- **Reports & CSV exports** (`/reports` + admin-only `/api/admin/export/[type]`): donations
  (net of refunds, date-range filter), donors (lifetime totals), and student roster — for
  accounting / 990 / board reports. RFC-4180 CSV, no dependencies.
  (`lib/services/exports.ts`, `lib/csv.ts`, `npm run verify:exports`.)

### Admin part — staff & user management (2026-07-05)

- **`/users`**: list all users, change roles (auto-creating a Mentor row on promotion),
  suspend/reactivate, and invite staff (admin/mentor) via an emailed set-password link.
  Guards: no self-demote/suspend, no removing the last active admin. All audited.
  (`lib/services/user-management.ts`, `npm run verify:user-management`.)

### Admin part — dashboard (2026-07-05)

- New `/admin` dashboard: live metrics (total raised, donors, active students, active
  pledges) + "needs attention" cards with badges (pending approvals / applications /
  donations, each mirroring its queue page exactly) + quick links to every admin tool.
- Admins now land on `/admin` after sign-in (`lib/services/admin-overview.ts`,
  `npm run verify:admin-overview` — delta-checked counts).

### Hardening — Tier 1 (2026-07-05)

- **Self-service password reset**: `PasswordResetToken` (raw token emailed, only its
  SHA-256 hash stored, 1-hour expiry, single-use, all tokens invalidated on use).
  `/forgot-password` + `/reset-password` pages; "Forgot your password?" on `/login`.
  Request is a silent no-op for unknown emails (no account enumeration).
  (`lib/services/password-reset.ts`, `npm run verify:password-reset`.)
- **Security headers on the ops app** (it holds PII + money): CSP, HSTS, X-Frame-Options
  DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (`next.config.ts`;
  'unsafe-eval' dev-only).
- **Rate limiting** on the sensitive forms — `/login`, `/apply` account creation, and
  `/give` claims — via a shared per-(bucket, IP) limiter (`lib/rate-limit.ts`).

### Stripe activation-readiness (2026-07-04)

- Completed the one Stripe gap: **`createSubscriptionCheckout`** (mode=subscription,
  inline recurring price, metadata on session + subscription) so a donor can START a
  Stripe recurring sponsorship — the webhook side (record subscription, per-cycle
  donations, no first-cycle double-count) was already built/verified. `/donate` now has a
  "make this monthly" checkbox.
- Added **`docs/STRIPE_SETUP.md`** — the exact activation checklist: keys, the webhook URL
  + the 7 events to enable, Stripe CLI local testing, test cards, go-live. Re-surfaced the
  `/donate` (card) link in the portal, labelled "add keys to enable".
- Net: Stripe is fully wired and dormant; switching it on is plugging in
  `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` and registering the endpoint. The free
  mobile-banking flow (`/give`, `/pledges`) coexists on the same ledger.

### Free donation flow — no Stripe / no fees (2026-07-04)

- Direction change: donations move off Stripe to a free, manual model (mobile banking /
  bank / cash). Stripe/subscription code is left dormant (harmless without keys).
- **F1 — one-time gifts**: public `/give` page (env-configurable bKash/Nagad/Rocket/bank
  details + a claim form) → `submitDonationClaim` creates a **PENDING** donation (doesn't
  count) → admin `/donations-pending` **confirms** (→ SUCCEEDED, counts, receipt) or
  **declines** (reason required). Guest→account match by verified email. All audited.
  (`lib/services/donation-claims.ts`, `npm run verify:donation-claims`.)
- **F2 — monthly pledges (manual)**: a pledge = a `Subscription` with no Stripe id
  (`lib/services/pledges.ts`). Admin `/pledges` creates pledges, **logs each payment** as
  it arrives (→ SUCCEEDED recurring Donation + receipt, counts), sees a **"due"** badge for
  unpaid periods, and cancels. (`npm run verify:pledges`.)
- Marketing homepage "Sponsor a Student" now points at the free `/give` flow.

### Gap fixes (2026-07-04)

- Added the missing `/donate/thank-you` page (Stripe `success_url` target) — shows the
  real `getGiftContext` gift, or a graceful "processing" message if the webhook hasn't
  landed yet.
- Mentors can now **register a student** from `/my-students` (→ admin approval queue), as
  the build prompt required.
- Added `GET /api/health` (DB readiness → 503 if down). Removed the dead
  `signupStudentAction` (students go through `/apply`).

### File upload + email delivery (2026-07-04)

- Provider-agnostic file storage (`lib/storage.ts`): local disk (`uploads/`, gitignored)
  keyed + type/size-validated (JPEG/PNG/WebP/PDF, ≤5 MB), swappable to object storage
  at handoff. The apply form now takes real **result-sheet + photo uploads** (server
  action, 8 MB body limit).
- Uploaded documents are minors' PII → served ONLY through an **authenticated** route
  `GET /api/files/[...key]`: admin, the owner, or a mentor with an ACTIVE assignment may
  view; everyone else (incl. unauthenticated) is denied. Admin review page links the files.
- Email now goes through one transport (`lib/email.ts`): console in dev, SMTP once
  `EMAIL_SERVER` is set. Wired receipts to it (marks `Receipt.status = SENT`); application
  verification codes already used it.
- Verified (`npm run verify:uploads`): storage round-trip, bad-file rejection, and the
  admin/owner/assigned-mentor-only authorization (unassigned mentor cut off).

### Student application flow — S3: admin backend record (2026-07-04)

- `StudentSession` gains `institutionName` / `formerRoll` / `totalStudent` (migration
  `studentsession_education`) for the per-session education table.
- Admin record service (`lib/services/student-record.ts`): edit the backend fields
  (registration id [unique], purpose/career, professions/incomes, guardian/tutor,
  and the funding plan: paymentType/requireAmount/minDonateAmount/perInstallment/
  targetType/targetPeriod); per-session education upsert; verified/active flags; and
  `deactivateAllStudents` (the "Dec 30 auto-deactivate" — callable now, cron at handoff).
  All audited.
- Admin UI: `/roster` (list + year-end deactivation) and `/roster/[id]` (edit record +
  funding, education table, contacts, verified/active toggles, real donor list).
- Verified (`npm run verify:student-record`): field edits + registration-id uniqueness,
  education upsert (idempotent per session), flags, and year-end deactivation (test
  restores pre-existing active students so live data is untouched). Made the projection
  test delta-based so it's robust to persistent data.

### Student application flow — S2: student portal (2026-07-03)

- After login, students land on `/student` (home redirects STUDENT → portal). Shows
  their profile (school, district, career goal, sponsored status) + support received
  (net total, distinct sponsor count) + a list of their sponsors' gifts.
- Donor identities are ANONYMIZED (`lib/services/student-portal.ts`): a donor who
  chose `isAnonymous` shows as "Anonymous"; only SUCCEEDED donations directed at THIS
  student are included — general/other-student/voided gifts never leak in.
- Verified (`npm run verify:student-portal`): only-own-directed-gifts, anonymization
  (real name never leaked), net totals, distinct sponsor count, active-sponsorship flag.

### Student application flow — S1: apply → verify → approve (2026-07-03)

- Schema: new `StudentApplication` model (the bilingual scholarship form + email-
  verification state + file URLs), `Student` extensions (registration id, orphan,
  professions/incomes, address, guardian/tutor, purpose/career, and a funding block:
  paymentType/requireAmount/minDonateAmount/perInstallment/targetType/targetPeriod,
  verified/active), and enums `ApplicationStatus`/`PaymentType`/`TargetType`. Migration
  `student_applications` applied.
- Flow (`lib/services/applications.ts` + `application-review.ts`): applicant account
  (STUDENT, PENDING) + DRAFT → save → submit (validates required fields + agreement,
  emails a 6-digit code, stored hashed w/ 15-min expiry) → verify → EMAIL_VERIFIED lands
  in the admin queue → approve creates an ACTIVE `Student` (slug, mapped fields) and
  activates the account → reject requires a reason. All decisions audited. A PENDING
  applicant still cannot hold a real session (the gate holds); the /apply flow uses a
  lightweight signed applicant cookie instead.
- UI: `/apply` (account → form → `/apply/verify` → `/apply/done`) and admin
  `/applications` (queue + full-detail review with approve/reject). Email code prints to
  the server console in dev.
- Verified (`npm run verify:applications`): gated submit, wrong-code refusal, verify →
  queue, approve activates the student + account, reject needs a reason, all audited.
- Still to come: S2 student portal (anonymized donations), S3 admin backend record +
  funding, S4 marketing "Apply to be a student" link, plus real file upload + email.

### Phase G — Computed numbers & public projection (2026-07-02)

- `lib/public/projection.ts` is the ONE code path that reads PII tables for public
  output. Whitelist, not blacklist — only the exported `*_KEYS` fields cross. Consent
  gates (`lib/public/consent.ts`, mirroring canShowPortrait/canShowSuccessStory) are
  evaluated server-side; a failed gate OMITS the field (no existence leak).
- Read-only endpoints per PUBLIC_PROJECTION.md, rate-limited + CDN-cached
  (`lib/public/http.ts`, `Cache-Control: s-maxage=300, swr=600`): `GET /api/public/students`,
  `/students/:slug`, `/projects`, `/projects/:slug`, `/stats`, `/donor-wall`.
- Computed (never stored): project `fundingRaised` (Σ amount−refunded, SUCCEEDED, any
  source; refunds/voids excluded), `totalRaised`, `donorCount` (distinct donors w/ a
  SUCCEEDED gift), `studentCount`/`schoolCount`; `sponsorshipStatus` (active subscription
  OR directed SUCCEEDED donation in the current session); grade from the current
  StudentSession. Donor wall anonymizes (`isAnonymous → "Anonymous"`), never leaks
  name/email/amount.
- Snapshot/whitelist test (`npm run verify:projection`): asserts every serialized
  object's keys ⊆ the whitelist, that no PII VALUE (fullName/fatherName/dob/anon name)
  ever appears, that consent gates omit fields, that only ACTIVE students list, and that
  the computed numbers (incl. LEGACY) are correct.

### Phase F — Offline & legacy entry (2026-07-02)

- Manual offline gifts (`lib/services/offline-donations.ts`): CASH/CHECK/BANK/LEGACY/OTHER
  against a donor + designation, admin-supplied amount + date, audited. Non-historical rows
  get a receipt; `isHistorical` backfill rows get **none** (guard from Phase D) but still
  count toward computed totals.
- Corrections done right: offline rows are **editable**; **Stripe rows are refused**
  (`StripeRowImmutableError`) — the path is **void-with-reason** (required reason, any row) or
  a **negative adjustment row** (`correctionOfId`), never a silent edit. Non-financial note
  edits are allowed on any row.
- `sumSucceededDonations` (computed, all sources incl. LEGACY/adjustments) — used to prove
  legacy rows count; Phase G formalizes the public numbers.
- CSV importer (`lib/services/legacy-import.ts`): parse → validate → **dry-run preview (no
  writes)** → **commit** (valid rows as historical LEGACY donations; invalid rows reported &
  skipped, never blocking the good ones). Admin UI: `/offline-donations` (first-class manual
  entry) and `/legacy-import` (dry-run/commit).
- Verified (`npm run verify:offline`): create/edit/audit, isHistorical no-receipt-but-counts,
  Stripe immutability refused, void-with-reason, negative adjustment reduces totals, CSV
  dry-run writes nothing while commit imports valid + skips invalid.

### Phase E — Recurring sponsorships (2026-07-01)

- Subscriptions persisted from mode=subscription Checkout (`lib/services/subscriptions.ts`),
  idempotent on `stripeSubscriptionId`. Crucially, subscription checkout creates **no
  donation** — the first cycle's donation comes from the first `invoice.payment_succeeded`,
  so the first charge is **never double-counted** (verified).
- Each paid cycle → exactly ONE linked Donation via `invoice.payment_succeeded`, same
  two-level idempotency (StripeEvent.eventId + Donation `@unique` on `idempotencyKey`=invoice.id
  and `stripePaymentIntentId`). A retried invoice webhook is a no-op. Each cycle carries the
  subscription's designation and the **current AcademicSession** for attribution.
- Fee/net enrichment (decision from Phase D) via the `charge.succeeded` balance transaction,
  routed through the same StripeEvent idempotency; value-idempotent; `netAmount` stays null
  when the fee is genuinely unknown (no synthesizing).
- Lifecycle mapping (`customer.subscription.updated/deleted`) → SubscriptionStatus
  (active/trialing→ACTIVE, past_due→PAST_DUE, canceled→CANCELED, unpaid→UNPAID, else INCOMPLETE).
  Cancel reflected; canceled subs drop out of active-sponsorship attribution.
- Donor dashboard `/dashboard` (giving history + subscriptions + cancel) and admin
  `/sponsorships` (active recurring). Cancel requests Stripe; the webhook is the source of truth.
- Verified (`npm run verify:subs`): no first-cycle double-count, retried-invoice no-op,
  monthly cycle attributed to the current session, idempotent fee enrichment,
  past_due→PAST_DUE, cancel→CANCELED with no further donations.

### Phase D — One-time Stripe donations (2026-07-01)

- Webhook endpoint `POST /api/webhooks/stripe` → `lib/webhooks/stripe-handler.ts`:
  signature-verified (`constructEvent`), **two-level idempotent** — `StripeEvent.eventId`
  (event-level) + Donation `@unique` keys (row-level). A duplicate delivery is a no-op.
- `source=STRIPE` donations are **webhook-only** (`lib/services/donations.ts`). Amount &
  currency come from **Stripe**, never the browser; USD enforced. Financial fields are
  written once and immutable thereafter — refund/dispute only touch `refundedAmount`/
  `status`/void fields. Guest→account match is by **verified email only**.
- Refunds: partial → `refundedAmount` set, status stays SUCCEEDED; full → REFUNDED. Lost
  dispute → VOIDED (no dedicated DISPUTED enum value; a possible future addition).
- Receipt generation (`lib/services/receipts.ts`) with the **isHistorical guard in place
  now** (never fires for backfilled rows). `getGiftContext` returns REAL gift data,
  replacing the marketing site's URL-param placeholder. Checkout initiation
  (`lib/services/checkout.ts`, `/donate`) — needs a real STRIPE_SECRET_KEY to run.
- Verified offline with SDK-signed fixtures (`npm run verify:stripe`, no live keys):
  exactly-one-donation with Stripe's amount, duplicate event no-op, row-level guard,
  unsigned/bad-signature rejection, verified-email match, partial/full refund and lost
  dispute transitions, real getGiftContext. Stripe CLI (`stripe listen`) is the path for
  live local forwarding at handoff.

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
