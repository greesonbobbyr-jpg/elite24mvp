-- CreateEnum
CREATE TYPE "InviteKind" AS ENUM ('ORG_CREATE', 'STAFF');

-- CreateTable
CREATE TABLE "Invite" (
    "id" SERIAL NOT NULL,
    "kind" "InviteKind" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "codeHint" TEXT NOT NULL,
    "role" "Role",
    "organizationId" INTEGER,
    "teamId" INTEGER,
    "label" TEXT,
    "createdByProfileId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByProfileId" INTEGER,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_codeHash_key" ON "Invite"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE INDEX "Invite_organizationId_createdAt_idx" ON "Invite"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Invite_kind_createdAt_idx" ON "Invite"("kind", "createdAt");

