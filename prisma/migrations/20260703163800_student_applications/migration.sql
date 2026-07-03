-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'EMAIL_VERIFIED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ONE_TIME', 'INSTALLMENT');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('MONTH', 'YEAR');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "addrDistrict" TEXT,
ADD COLUMN     "addrVillage" TEXT,
ADD COLUMN     "careerGoal" TEXT,
ADD COLUMN     "ethnicity" TEXT,
ADD COLUMN     "familyIncome" TEXT,
ADD COLUMN     "fatherProfession" TEXT,
ADD COLUMN     "guardianAddress" TEXT,
ADD COLUMN     "guardianMobile" TEXT,
ADD COLUMN     "guardianName" TEXT,
ADD COLUMN     "isOrphan" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minDonateAmount" INTEGER,
ADD COLUMN     "motherProfession" TEXT,
ADD COLUMN     "paymentType" "PaymentType",
ADD COLUMN     "perInstallment" INTEGER,
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "registrationId" TEXT,
ADD COLUMN     "requireAmount" INTEGER,
ADD COLUMN     "targetPeriod" TEXT,
ADD COLUMN     "targetType" "TargetType",
ADD COLUMN     "tutorName" TEXT,
ADD COLUMN     "tutorPhone" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StudentApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentId" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "emailCodeHash" TEXT,
    "emailCodeExpiresAt" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "nameBn" TEXT,
    "nameEn" TEXT,
    "fatherNameBn" TEXT,
    "fatherNameEn" TEXT,
    "motherNameBn" TEXT,
    "motherNameEn" TEXT,
    "familyMobile" TEXT,
    "gender" TEXT,
    "isOrphan" BOOLEAN NOT NULL DEFAULT false,
    "ethnicity" TEXT,
    "schoolName" TEXT,
    "classNeeded" TEXT,
    "currentClass" TEXT,
    "roll" TEXT,
    "totalStudents" TEXT,
    "favoriteSubject" TEXT,
    "favoriteSubjectMarks" TEXT,
    "mathMarks" TEXT,
    "englishMarks" TEXT,
    "otherResults" JSONB,
    "recentGovtExam" TEXT,
    "govtExamGrades" JSONB,
    "careerGoal" TEXT,
    "hobbies" TEXT,
    "existingScholarship" JSONB,
    "scholarshipNeedFor" JSONB,
    "addrVillage" TEXT,
    "addrPara" TEXT,
    "addrPostOffice" TEXT,
    "addrThana" TEXT,
    "addrDistrict" TEXT,
    "localGuardianName" TEXT,
    "localGuardianPhone" TEXT,
    "tutorName" TEXT,
    "tutorPhone" TEXT,
    "familyMembersMale" INTEGER,
    "familyMembersFemale" INTEGER,
    "studyingChildren" TEXT,
    "monthlyFamilyIncome" TEXT,
    "fatherProfession" TEXT,
    "fatherIncome" TEXT,
    "motherProfession" TEXT,
    "motherIncome" TEXT,
    "localKnownName" TEXT,
    "localKnownPhone" TEXT,
    "agreedTerms" BOOLEAN NOT NULL DEFAULT false,
    "resultSheetUrl" TEXT,
    "photoUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentApplication_userId_idx" ON "StudentApplication"("userId");

-- CreateIndex
CREATE INDEX "StudentApplication_status_idx" ON "StudentApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Student_registrationId_key" ON "Student"("registrationId");

-- AddForeignKey
ALTER TABLE "StudentApplication" ADD CONSTRAINT "StudentApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentApplication" ADD CONSTRAINT "StudentApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

