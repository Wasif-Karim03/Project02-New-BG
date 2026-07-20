-- Total household size, captured alongside the existing male/female counts.
-- Nullable and never auto-computed: applicants may leave any of the three blank.
ALTER TABLE "StudentApplication" ADD COLUMN "familyMembersTotal" INTEGER;
