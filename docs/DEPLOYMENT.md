# Deployment — Bridging Generations (production launch)

Two apps ship together:

| App | Repo | Suggested subdomain |
|-----|------|---------------------|
| Ops / admin backend (`bridging-ops`) | `Wasif-Karim03/Project02-New-BG` | `admin.<your-domain>` |
| Public marketing site (`bridging-generations-web`) | `Wasif-Karim03/bridging-generations-web` | `www.<your-domain>` + apex |

Everything below is **free tier, no credit card** except **Cloudflare R2** (free 10 GB, but Cloudflare requires a card on file) and your **domain** (~$12/yr, which you already own).

Do the ops app first — the marketing site reads from it.

---

## 0. Accounts to create (all free)

1. **Vercel** — https://vercel.com (sign in with GitHub). Hosts both apps.
2. **Neon** — https://neon.tech. Managed Postgres.
3. **Cloudflare** — https://dash.cloudflare.com. For R2 file storage (add a card to enable R2; you stay in the free tier).
4. **Resend** — https://resend.com. Transactional email.

You (not this repo) create these and paste the resulting keys into Vercel env vars.

---

## 1. Database — Neon

1. Create a project → a database. Region: pick the closest to your users.
2. In the Neon dashboard, copy **two** connection strings:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`
   - **Direct** (no `-pooler`) → `DIRECT_URL`
   Append `?sslmode=require` if not already present.
3. Keep both — you'll paste them into the ops Vercel project (step 5).

Migrations run automatically on every deploy (the ops `vercel-build` script runs
`prisma migrate deploy` before building).

---

## 2. File storage — Cloudflare R2

1. Cloudflare dashboard → **R2** → enable it (add a card; free tier is 10 GB).
2. **Create bucket**, e.g. `bridging-uploads`. Keep it **private** (default).
3. **Manage R2 API Tokens → Create API token** → *Object Read & Write* on that
   bucket. Copy the **Access Key ID** and **Secret Access Key** (shown once).
4. Copy your **Account ID** (R2 overview page).

You'll set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

> Files are served through the ops app's authorized `/api/files` route, so the
> bucket stays private. Consent-gated student portraits and donor-published
> tribute photos are the only ones served publicly, and that check runs live on
> every request — revoking consent stops public serving within ~5 minutes.

---

## 3. Email — Resend

1. Resend → **Add domain** → enter your domain → add the shown DNS records
   (SPF/DKIM) at your registrar. Wait for "Verified".
2. **API Keys → Create** → copy the key → `RESEND_API_KEY`.
3. Choose a From address on the verified domain, e.g.
   `no-reply@<your-domain>` → `EMAIL_FROM`.

Until the domain verifies you can test with Resend's sandbox sender, but real
verification codes/receipts to real users need the verified domain.

---

## 4. Ops app on Vercel

1. Vercel → **Add New → Project → Import** `Project02-New-BG`.
2. Framework preset: **Next.js** (auto). Leave build/install commands default —
   the `vercel-build` script handles Prisma generate + migrate + build.
3. **Environment Variables** (Production):

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Neon **pooled** URL |
   | `DIRECT_URL` | Neon **direct** URL |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `AUTH_URL` | `https://admin.<your-domain>` |
   | `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | from step 2 |
   | `EMAIL_FROM` | `no-reply@<your-domain>` |
   | `RESEND_API_KEY` | from step 3 |
   | `NEXT_PUBLIC_MARKETING_URL` | `https://www.<your-domain>` |
   | `NEXT_PUBLIC_PAY_*` | your bKash/Nagad/Rocket/bank numbers (optional) |

4. **Deploy.** First deploy runs the migrations against Neon automatically.
5. **Domains** → add `admin.<your-domain>` → set the CNAME it shows at your registrar.

### 4a. Seed the first admin (run once)

From your machine, pointing at the **production** database:

```bash
cd bridging-ops
DATABASE_URL='<neon-pooled-url>' DIRECT_URL='<neon-direct-url>' \
SEED_ADMIN_EMAIL='admin@<your-domain>' \
SEED_ADMIN_PASSWORD='<a-strong-12+char-password>' \
npx tsx prisma/seed.ts
```

This creates the ADMIN (+ academic sessions + schools). No demo data. The
password is taken from the env var and never printed. Sign in at
`https://admin.<your-domain>/login`.

---

## 5. Marketing app on Vercel

See `bridging-generations-web/docs/DEPLOYMENT.md`. In short: import the repo,
set `OPS_API_BASE=https://admin.<your-domain>`, `NEXT_PUBLIC_SITE_URL` +
`NEXT_PUBLIC_OPS_APP_URL`, wire the Keystatic GitHub App, add the apex + `www`
domains.

---

## 6. Post-launch checks

- `https://admin.<your-domain>/api/health` → `{"status":"ok","db":"up"}`
- Sign in as admin; approve a test student/mentor/donor end to end.
- Upload a photo in an application → confirm it persists (R2) and that a
  consent-gated portrait renders on the public site.
- Trigger a verification email → confirm it arrives (Resend dashboard shows sends).
- Point a free **UptimeRobot** monitor at `/api/health`.
- (Optional) add **Sentry** (free tier) for error tracking and **Vercel
  Analytics** (free) for traffic.

## Not included yet

- **Stripe** — intentionally deferred. The free donation flow (offline/bKash/
  Nagad + admin confirmation) works today; card payments turn on once you add
  `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`.
