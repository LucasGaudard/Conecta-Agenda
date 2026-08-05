-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PROFESSIONAL', 'SUPER_ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'PROFESSIONAL';

-- AlterTable
ALTER TABLE "Business"
  ADD COLUMN "isManuallyBlocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "blockReason" TEXT,
  ADD COLUMN "blockedAt" TIMESTAMP(3),
  ADD COLUMN "blockedByUserId" TEXT,
  ADD COLUMN "accessOverrideUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Business_blockedByUserId_idx" ON "Business"("blockedByUserId");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_blockedByUserId_fkey"
  FOREIGN KEY ("blockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
