-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('CEO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PlatformGrant" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PlatformGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" SERIAL NOT NULL,
    "actorProfileId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "organizationId" INTEGER,
    "teamId" INTEGER,
    "targetProfileId" INTEGER,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformGrant_profileId_revokedAt_idx" ON "PlatformGrant"("profileId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorProfileId_createdAt_idx" ON "AuditEvent"("actorProfileId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlatformGrant" ADD CONSTRAINT "PlatformGrant_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
