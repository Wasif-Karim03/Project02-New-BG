-- CreateTable
CREATE TABLE "OrgSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgSetting_pkey" PRIMARY KEY ("key")
);

