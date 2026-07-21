-- Phase 7 follow-up — capture story-display consent on the application. Additive:
-- one new nullable-defaulted boolean, so existing rows default to false (no story
-- consent) and nothing else changes. Gated to storyConsent=GRANTED at approval,
-- mirroring photoConsent. OPTIONAL — never required to submit.
ALTER TABLE "StudentApplication" ADD COLUMN "storyConsent" BOOLEAN NOT NULL DEFAULT false;
