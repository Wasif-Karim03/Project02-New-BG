-- CreateEnum
CREATE TYPE "SixPointRating" AS ENUM ('EXCELLENT', 'VERY_GOOD', 'GOOD', 'FAIR', 'POOR', 'VERY_POOR');

-- CreateEnum
CREATE TYPE "ProgressGrade" AS ENUM ('A', 'B', 'C', 'D');

-- CreateTable
CREATE TABLE "MentorEvaluation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT,
    "mentorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentName" TEXT,
    "mentorName" TEXT,
    "privateTeacher" TEXT,
    "classGrade" TEXT,
    "currentRoll" TEXT,
    "formerRoll" TEXT,
    "institution" TEXT,
    "studyHabits" JSONB,
    "participation" "SixPointRating",
    "parentCommunication" "SixPointRating",
    "progressGrade" "ProgressGrade",
    "subjectNotes" JSONB,
    "overallEvaluation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MentorEvaluation_studentId_idx" ON "MentorEvaluation"("studentId");

-- CreateIndex
CREATE INDEX "MentorEvaluation_mentorId_idx" ON "MentorEvaluation"("mentorId");

-- AddForeignKey
ALTER TABLE "MentorEvaluation" ADD CONSTRAINT "MentorEvaluation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorEvaluation" ADD CONSTRAINT "MentorEvaluation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorEvaluation" ADD CONSTRAINT "MentorEvaluation_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Mentor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

