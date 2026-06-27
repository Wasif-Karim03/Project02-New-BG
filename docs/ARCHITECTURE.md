# Architecture — bridging-ops

## What this is

The operational system of record for Bridging Generations: identity, approvals,
donations (Stripe + offline/legacy), mentor evaluations, receipts, audit. It is a
**separate app and database** from the public marketing site.

```
┌─────────────────────────────┐         read-only, whitelisted,        ┌────────────────────────────┐
│  bridging-ops (THIS app)    │         consent-gated projection        │  marketing site            │
│  Next.js + Prisma + Postgres│  ──────────────────────────────────▶   │  (Next.js + Keystatic)     │
│  FACTS · MONEY · PII        │   GET /api/public/* (Phase G/H)         │  narrative content         │
└─────────────────────────────┘                                         └────────────────────────────┘
        ▲                                                                         │
        │ Stripe webhooks (Phase D+)                                              │ no DB credentials, ever
   Stripe (source of truth for online money)                                     ▼ one-way only
```

## Hard invariants (enforced, not aspirational)

- **One-way public projection.** The marketing site never reads/queries/writes this
  DB. It calls read-only `GET /api/public/*` (Phase G) returning only whitelisted,
  consent-gated fields. Whitelist, not blacklist. See `PUBLIC_PROJECTION.md`.
- **Identity is split.** `User` = login; `Donor`/`Mentor`/`Student` are profiles that
  can exist without a login (guest donor; admin/mentor-created student).
- **Money = integer minor units + ISO currency, never floats.** v1 is USD-only,
  rejected at the Zod boundary. Derived totals (funding raised, donor counts) are
  **computed**, never stored.
- **Stripe is the source of truth for online donations.** `source = STRIPE` rows are
  webhook-written, idempotent (event-level via `StripeEvent` + row-level unique keys),
  and their financial fields are immutable in the service layer. Corrections are
  void-with-reason or adjustment rows — never silent edits.
- **Approval gates accounts/records, never donations.** A gift clears with no human in
  the loop; account/record creation lands in an admin queue.
- **Mentor access is row-scoped** via active `MentorAssignment`, enforced in a central
  data-access layer (Phase C). Sensitive reads → `AuditLog`.

## Auth (Phase A)

- Auth.js v5 + Prisma adapter. **Email + password is primary** (older/one-time donors
  shouldn't need a magic-link round-trip); magic-link is the fallback / dev transport
  (links print to the server console when `EMAIL_SERVER` is empty).
- Credentials forces **JWT sessions**, so `role` + `status` ride on the JWT and are
  mirrored onto `session.user`. The `Session` table stays for any future DB-session
  provider but is dormant under credentials login.
- Only `ACTIVE` accounts may sign in (gate in `authorize()` and the `signIn` callback).
  Passwords are scrypt-hashed (`lib/password.ts`, Node `crypto`, no native deps).

## Phase plan

| Phase | Scope | Status |
|---|---|---|
| A | Foundation: scaffold, schema + first migration, Auth.js (role/status), seed | **done** |
| B | Accounts & approval workflow (signup → PENDING → admin queue → AuditLog) | next |
| C | Mentor scoping (`assertMentorCanAccess`) + evaluations | |
| D | One-time Stripe donations (webhook-created, idempotent, receipts) | |
| E | Recurring sponsorships (Stripe Subscriptions → per-cycle Donation) | |
| F | Offline & legacy entry (CASH/CHECK/BANK/LEGACY, `isHistorical`, CSV import) | |
| G | Computed numbers + read-only `GET /api/public/*` (whitelist + consent) | |
| H | Marketing-site integration (replace hand-typed numbers / donate placeholders) | |

## Key directories

```
prisma/            schema.prisma (canonical model) · migrations · seed.ts
auth.ts            NextAuth v5 config (providers, callbacks)
lib/prisma.ts      PrismaClient singleton
lib/password.ts    scrypt hash/verify
lib/auth/          credentials verification + sign-in policy
types/             Auth.js type augmentation (role/status on user/jwt/session)
scripts/           verify-auth.ts · check-structure.sh
app/api/auth/      NextAuth route handler
```
