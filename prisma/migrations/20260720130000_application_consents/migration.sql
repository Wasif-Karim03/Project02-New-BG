-- Discrete, individually-recorded application consents (Phase 3), plus an optional
-- free-text "special reason". Additive: new boolean columns default false (matching
-- the existing photoConsent/agreedTerms pattern) and specialReason is nullable, so
-- existing rows are backfilled safely with no rewrite.
ALTER TABLE "StudentApplication" ADD COLUMN "consentVerificationCalls" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StudentApplication" ADD COLUMN "consentMonthlyPayment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StudentApplication" ADD COLUMN "consentMentorCheckins" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StudentApplication" ADD COLUMN "consentCancelPolicy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StudentApplication" ADD COLUMN "specialReason" TEXT;
