-- CreateEnum
CREATE TYPE "GroupKind" AS ENUM ('PROGRAM', 'GENDER', 'AGE_GROUP', 'LEVEL', 'SCHOOL', 'DIVISION', 'CUSTOM');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'GROUP_ADMIN';

-- DropIndex
DROP INDEX "RoleAssignment_profileId_role_organizationId_teamId_key";

-- AlterTable
ALTER TABLE "RoleAssignment" ADD COLUMN     "groupId" INTEGER;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "groupId" INTEGER;

-- CreateTable
CREATE TABLE "Group" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "name" TEXT NOT NULL,
    "kind" "GroupKind" NOT NULL DEFAULT 'CUSTOM',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "depth" INTEGER NOT NULL DEFAULT 1,
    "legacyProgramId" INTEGER,
    "legacyDivisionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Group_legacyProgramId_key" ON "Group"("legacyProgramId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_legacyDivisionId_key" ON "Group"("legacyDivisionId");

-- CreateIndex
CREATE INDEX "Group_organizationId_parentId_sortOrder_idx" ON "Group"("organizationId", "parentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RoleAssignment_profileId_role_organizationId_teamId_groupId_key" ON "RoleAssignment"("profileId", "role", "organizationId", "teamId", "groupId");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

