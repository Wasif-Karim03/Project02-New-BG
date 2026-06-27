# Bridging Generations — Operational App (`bridging-ops`)

The **operational backend + admin portal** for the Bridging Generations nonprofit:
accounts & approvals, Stripe donations (one-time + recurring), mentor evaluations,
and a one-way, consent-gated **public projection** that feeds the existing public
marketing site.

This is a **separate application** from the marketing site (`../bridging-generations-main`,
Next.js + Keystatic). It owns FACTS, MONEY, and PII in its own Postgres database. The
marketing site never gets operational DB credentials — it consumes only the read-only
public API defined in the projection contract.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Prisma 6** + **PostgreSQL** (pinned to Prisma 6 for the stable `prisma-client-js` generator)
- **Auth.js v5 (NextAuth)** with the Prisma adapter — email + password (primary),
  magic-link (fallback/dev). `role` + `status` on the JWT/session.
- **Stripe** (Checkout + Billing) — webhook-driven, added from Phase D.
- **Zod** for boundary validation. Tailwind v4 for the admin UI.

Everything is **provider-agnostic**: the only database config is a plain `DATABASE_URL`.
No cloud-vendor SDKs. The app drops into the client's own cloud account at handoff
(Phase H) with no code changes.

## Contract (read before changing the data model)

- `prisma/schema.prisma` — the canonical operational data model.
- `PUBLIC_PROJECTION.md` (`../bridging-generations-main/docs/files/`) — the whitelisted,
  consent-gated fields that may cross to the public site. A **security boundary for
  minors' data**: whitelist only, consent gates evaluated server-side before projection.

## Local development

Requires Node ≥ 20 and a local Postgres.

```bash
# 1. Start a disposable local Postgres (either works — same DATABASE_URL):
docker compose up -d                 # Docker, OR
#  …use an existing local Postgres (Homebrew/native) on :5432

# 2. Configure env
cp .env.example .env                 # then fill in AUTH_SECRET etc.

# 3. Install + set up the database
npm install
npm run db:migrate                   # apply migrations
npm run db:seed                      # admin + academic sessions + schools

# 4. Run
npm run dev                          # http://localhost:3000
```

### Seeded admin (dev only)

The seed creates `admin@bridginggenerations.org` (role `ADMIN`, status `ACTIVE`) with a
**dev-only** password printed by the seed. Rotate it after first sign-in; never use it in
a deployed environment.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next dev server on `:3000` |
| `npm run build` | Production build |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | Seed admin + sessions + schools (idempotent) |
| `npm run db:reset` | Drop, re-migrate, re-seed (destructive — dev only) |
| `npm run verify:auth` | Browser-free check of sign-in, role/status, and PENDING/SUSPENDED refusal |
| `npm run structure` | Repo structure & hygiene guard |
| `npm run lint` | ESLint |

## Environment variables

See `.env.example`. Summary:

| Variable | Scope | Purpose |
|---|---|---|
| `DATABASE_URL` | server | Postgres connection (the ONLY db config; swapped per environment) |
| `AUTH_SECRET` | server | Auth.js JWT/cookie signing (`openssl rand -base64 32`) |
| `AUTH_URL` | server | Base URL for auth callbacks |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | server | Stripe (Phase D onward) |
| `EMAIL_FROM` / `EMAIL_SERVER` | server | Magic-link transport; empty `EMAIL_SERVER` ⇒ links printed to console (dev) |

## Build phases

See `docs/ARCHITECTURE.md`. Currently complete: **Phase A — Foundation** (scaffold,
schema + first migration, Auth.js with role/status, seed). Next: Phase B — accounts &
approval workflow.
