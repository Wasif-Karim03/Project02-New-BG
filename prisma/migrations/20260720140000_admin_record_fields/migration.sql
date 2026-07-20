-- Phase 4 — complete the admin student record. All additive: new nullable columns
-- only (no drops/renames), so existing rows are unaffected.

-- Student: per-parent phones, income source, admin-only selection note.
ALTER TABLE "Student" ADD COLUMN "fatherPhone" TEXT;
ALTER TABLE "Student" ADD COLUMN "motherPhone" TEXT;
ALTER TABLE "Student" ADD COLUMN "incomeSource" TEXT;
ALTER TABLE "Student" ADD COLUMN "selectionNote" TEXT;

-- StudentApplication: date of birth, so it can round-trip through approval to the
-- (previously orphaned) Student.dob column.
ALTER TABLE "StudentApplication" ADD COLUMN "dob" TIMESTAMP(3);

-- StudentSession: optional BA/MA degree level + a per-session result sheet.
ALTER TABLE "StudentSession" ADD COLUMN "degreeLevel" TEXT;
ALTER TABLE "StudentSession" ADD COLUMN "resultSheetUrl" TEXT;
