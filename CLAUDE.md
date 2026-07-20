@AGENTS.md

# BriGen audited build — non-negotiable rules

You are completing an audited build (Bridging Generations / BriGen scholarship
platform). You are making changes under strict rules.

## NON-NEGOTIABLE RULES

1. Work on a branch named `fix/<phase-name>`. Never commit to main. One phase per branch.
2. NEVER run destructive operations: no `prisma migrate reset`, no dropping/renaming columns or
   tables, no editing/deleting existing migrations. Migrations are ADDITIVE ONLY (new nullable
   columns / new tables). If a change seems to need a destructive migration, STOP and ask.
3. FROZEN systems — read for reference, DO NOT modify their logic: the donation money model
   (integer cents / USD boundary), the mentor row-level authorization (lib/auth/mentor-access.ts +
   lib/services/mentor.ts scoping), the registration-ID generator (application-review.ts BG-<year>-
   0001 + @unique), and the guest-donation path (give/checkout, donor.create userId:null).
4. Before editing any file, re-open it and confirm the audit's description still matches current
   code. If reality differs, report the difference and pause.
5. After EVERY phase you MUST run STEP V (the Post-Phase Verification Protocol) in full. You may not
   report a phase "done" until STEP V is entirely green. A green unit-test run alone is NOT done.
6. Add or update tests for every new rule or field. A behavior change with no test is incomplete.
7. Minimal diff — do not restyle or refactor unrelated code.
8. Never hardcode or print secrets. Read them from env. If a required env var/secret is missing so a
   check can't run, report it as a BLOCKER — do not skip the check silently.
9. If a decision is product-level and not in DECISIONS ON RECORD, ask instead of guessing.
