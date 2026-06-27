-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MENTOR', 'DONOR', 'STUDENT');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('DRAFT', 'PENDING', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'GRANTED', 'DENIED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ConsentScope" AS ENUM ('WEBSITE', 'PRINT', 'SOCIAL');

-- CreateEnum
CREATE TYPE "DonationSource" AS ENUM ('STRIPE', 'CASH', 'CHECK', 'BANK', 'LEGACY', 'OTHER');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "DesignationType" AS ENUM ('STUDENT', 'PROJECT', 'GENERAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'UNPAID');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'FUNDED', 'PAUSED');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('MOBILE', 'EMAIL', 'WHATSAPP', 'IN_PERSON', 'OTHER');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'DONOR',
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Donor" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "wallMessage" TEXT,
    "wallTier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mentor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mentor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "establishedYear" INTEGER,
    "heroImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "slug" TEXT,
    "firstName" TEXT NOT NULL,
    "fullName" TEXT,
    "fatherName" TEXT,
    "motherName" TEXT,
    "dob" TIMESTAMP(3),
    "community" TEXT,
    "gender" TEXT,
    "schoolId" TEXT,
    "bio" TEXT,
    "quote" TEXT,
    "portraitUrl" TEXT,
    "portraitConsent" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "storyConsent" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "consentScopes" "ConsentScope"[],
    "consentSignedAt" TIMESTAMP(3),
    "releaseFormId" TEXT,
    "consentRevokable" BOOLEAN NOT NULL DEFAULT true,
    "consentRevokedAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3),
    "isHistorical" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicSession" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "schoolId" TEXT,
    "grade" TEXT,
    "roll" TEXT,
    "amountNeeded" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorAssignment" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MentorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentEvaluation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT,
    "mentorId" TEXT NOT NULL,
    "evaluationType" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactPerson" TEXT,
    "contactBy" "ContactMethod",
    "remarks" TEXT,
    "fileUrl" TEXT,
    "publishConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT,
    "fundingGoal" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "boardOwnerName" TEXT,
    "displayOrder" INTEGER,
    "heroImageUrl" TEXT,
    "lastUpdated" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "designationType" "DesignationType" NOT NULL,
    "studentId" TEXT,
    "projectId" TEXT,
    "sessionId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "feeAmount" INTEGER,
    "netAmount" INTEGER,
    "source" "DonationSource" NOT NULL,
    "status" "DonationStatus" NOT NULL DEFAULT 'PENDING',
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "idempotencyKey" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionId" TEXT,
    "isHistorical" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "voidedById" TEXT,
    "voidedReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "correctionOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "designationType" "DesignationType" NOT NULL,
    "studentId" TEXT,
    "projectId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "interval" TEXT NOT NULL DEFAULT 'month',
    "currentPeriodEnd" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "donorName" TEXT,
    "donorEmail" TEXT,
    "pdfUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "status" "ReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Donor_userId_key" ON "Donor"("userId");

-- CreateIndex
CREATE INDEX "Donor_email_idx" ON "Donor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Mentor_userId_key" ON "Mentor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_slug_key" ON "Student"("slug");

-- CreateIndex
CREATE INDEX "Student_status_idx" ON "Student"("status");

-- CreateIndex
CREATE INDEX "Student_schoolId_idx" ON "Student"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicSession_label_key" ON "AcademicSession"("label");

-- CreateIndex
CREATE INDEX "StudentSession_sessionId_idx" ON "StudentSession"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSession_studentId_sessionId_key" ON "StudentSession"("studentId", "sessionId");

-- CreateIndex
CREATE INDEX "MentorAssignment_studentId_active_idx" ON "MentorAssignment"("studentId", "active");

-- CreateIndex
CREATE INDEX "MentorAssignment_mentorId_active_idx" ON "MentorAssignment"("mentorId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "MentorAssignment_mentorId_studentId_sessionId_key" ON "MentorAssignment"("mentorId", "studentId", "sessionId");

-- CreateIndex
CREATE INDEX "StudentEvaluation_studentId_idx" ON "StudentEvaluation"("studentId");

-- CreateIndex
CREATE INDEX "StudentEvaluation_mentorId_idx" ON "StudentEvaluation"("mentorId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_stripePaymentIntentId_key" ON "Donation"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_idempotencyKey_key" ON "Donation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Donation_donorId_idx" ON "Donation"("donorId");

-- CreateIndex
CREATE INDEX "Donation_studentId_idx" ON "Donation"("studentId");

-- CreateIndex
CREATE INDEX "Donation_projectId_idx" ON "Donation"("projectId");

-- CreateIndex
CREATE INDEX "Donation_status_idx" ON "Donation"("status");

-- CreateIndex
CREATE INDEX "Donation_source_idx" ON "Donation"("source");

-- CreateIndex
CREATE INDEX "Donation_occurredAt_idx" ON "Donation"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_donorId_idx" ON "Subscription"("donorId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_donationId_key" ON "Receipt"("donationId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StripeEvent_eventId_key" ON "StripeEvent"("eventId");

-- CreateIndex
CREATE INDEX "StripeEvent_type_idx" ON "StripeEvent"("type");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donor" ADD CONSTRAINT "Donor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mentor" ADD CONSTRAINT "Mentor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSession" ADD CONSTRAINT "StudentSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSession" ADD CONSTRAINT "StudentSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSession" ADD CONSTRAINT "StudentSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorAssignment" ADD CONSTRAINT "MentorAssignment_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Mentor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorAssignment" ADD CONSTRAINT "MentorAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorAssignment" ADD CONSTRAINT "MentorAssignment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Mentor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Hand-authored invariants Prisma cannot express in the schema language.
-- (Mirrored by Zod/service-layer validation; these are the database backstop.)
-- ─────────────────────────────────────────────────────────────────────────────

-- G: at most one AcademicSession may have isCurrent = true.
-- Partial unique index over a constant-true predicate => at most one matching row.
CREATE UNIQUE INDEX "academic_session_one_current"
  ON "AcademicSession" ("isCurrent")
  WHERE "isCurrent" = true;

-- H: a Donation's designationType must agree with which target FK is set.
ALTER TABLE "Donation" ADD CONSTRAINT "donation_designation_target_chk" CHECK (
  ("designationType" = 'STUDENT' AND "studentId" IS NOT NULL AND "projectId" IS NULL) OR
  ("designationType" = 'PROJECT' AND "projectId" IS NOT NULL AND "studentId" IS NULL) OR
  ("designationType" = 'GENERAL' AND "studentId" IS NULL     AND "projectId" IS NULL)
);

-- H: same invariant for Subscription.
ALTER TABLE "Subscription" ADD CONSTRAINT "subscription_designation_target_chk" CHECK (
  ("designationType" = 'STUDENT' AND "studentId" IS NOT NULL AND "projectId" IS NULL) OR
  ("designationType" = 'PROJECT' AND "projectId" IS NOT NULL AND "studentId" IS NULL) OR
  ("designationType" = 'GENERAL' AND "studentId" IS NULL     AND "projectId" IS NULL)
);
