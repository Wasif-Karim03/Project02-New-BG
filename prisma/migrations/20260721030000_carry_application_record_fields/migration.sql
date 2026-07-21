-- Phase 7 follow-up — carry required/operational application fields onto the Student
-- record. ALL additive: seven new nullable columns only (Bangla names, primary family
-- mobile, detailed address parts). Existing rows are unaffected; the money model and
-- public projection (explicit whitelist) are untouched. scholarshipNeedFor → purpose is
-- a code-only mapping (purpose column already exists).

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "addrPara" TEXT,
ADD COLUMN     "addrPostOffice" TEXT,
ADD COLUMN     "addrThana" TEXT,
ADD COLUMN     "familyMobile" TEXT,
ADD COLUMN     "fatherNameBn" TEXT,
ADD COLUMN     "fullNameBn" TEXT,
ADD COLUMN     "motherNameBn" TEXT;
