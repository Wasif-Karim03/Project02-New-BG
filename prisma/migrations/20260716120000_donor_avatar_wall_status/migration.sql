-- Donor profile picture + public-wall listing approval.
-- Named donors who opt in to the public Donors page are PENDING until an admin
-- approves them; this gates ONLY public visibility, never account/donation use.
CREATE TYPE "WallStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Donor" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "Donor" ADD COLUMN "wallStatus" "WallStatus" NOT NULL DEFAULT 'NONE';
