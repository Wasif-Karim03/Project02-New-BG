-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "tributeImageUrl" TEXT,
ADD COLUMN     "tributeMessage" TEXT,
ADD COLUMN     "tributeName" TEXT,
ADD COLUMN     "tributePublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tributeType" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "emailCodeHash" TEXT;

