# Changelog

All notable changes to the operational app. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Dates are ISO-8601.

## [Unreleased]

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
