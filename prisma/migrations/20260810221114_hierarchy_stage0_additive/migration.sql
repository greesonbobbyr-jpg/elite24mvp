-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'ORG_ADMIN';
ALTER TYPE "Role" ADD VALUE 'HEAD_COACH';
ALTER TYPE "Role" ADD VALUE 'ASSISTANT_COACH';
ALTER TYPE "Role" ADD VALUE 'GENERAL_MANAGER';

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "organizationId" INTEGER;

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "profileId" INTEGER;

-- AlterTable
ALTER TABLE "DailyReview" ADD COLUMN     "profileId" INTEGER;

-- AlterTable
ALTER TABLE "MindsetTakeaway" ADD COLUMN     "membershipId" INTEGER,
ADD COLUMN     "profileId" INTEGER;

-- AlterTable
ALTER TABLE "PointsLedger" ADD COLUMN     "membershipId" INTEGER,
ADD COLUMN     "profileId" INTEGER;

-- AlterTable
ALTER TABLE "Quest" ADD COLUMN     "organizationId" INTEGER;

-- AlterTable
ALTER TABLE "QuestLog" ADD COLUMN     "membershipId" INTEGER,
ADD COLUMN     "profileId" INTEGER;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "authorProfileId" INTEGER,
ADD COLUMN     "authorRole" "Role";

-- AlterTable
ALTER TABLE "NotificationRead" ADD COLUMN     "profileId" INTEGER;

-- AlterTable
ALTER TABLE "TeamMessage" ADD COLUMN     "authorProfileId" INTEGER,
ADD COLUMN     "authorRole" "Role";

-- AlterTable
ALTER TABLE "MessageReaction" ADD COLUMN     "profileId" INTEGER;

-- CreateTable
CREATE TABLE "Organization" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "jerseyNumber" INTEGER,
    "position" TEXT,
    "gradYear" INTEGER,
    "bio" TEXT,
    "heightInches" INTEGER,
    "dream" TEXT,
    "favoritePlayer" TEXT,
    "favoriteTeam" TEXT,
    "highlightUrl" TEXT,
    "pointsPerGame" DOUBLE PRECISION,
    "reboundsPerGame" DOUBLE PRECISION,
    "assistsPerGame" DOUBLE PRECISION,
    "careerPoints" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastCheckInDay" TEXT,
    "streakGraceUsed" BOOLEAN NOT NULL DEFAULT false,
    "setupCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileContact" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "dob" TIMESTAMP(3),
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "guardianName" TEXT,
    "guardianRelation" TEXT,
    "guardianPhone" TEXT,
    "guardianEmail" TEXT,
    "emergencyName" TEXT,
    "emergencyRelation" TEXT,
    "emergencyPhone" TEXT,
    "updatedByProfileId" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "role" "Role" NOT NULL,
    "jerseyNumber" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedByProfileId" INTEGER,
    "points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "role" "Role" NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "teamId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Season_organizationId_isCurrent_idx" ON "Season"("organizationId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileContact_profileId_key" ON "ProfileContact"("profileId");

-- CreateIndex
CREATE INDEX "Membership_teamId_seasonId_endedAt_idx" ON "Membership"("teamId", "seasonId", "endedAt");

-- CreateIndex
CREATE INDEX "Membership_profileId_endedAt_idx" ON "Membership"("profileId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_profileId_teamId_seasonId_key" ON "Membership"("profileId", "teamId", "seasonId");

-- CreateIndex
CREATE INDEX "RoleAssignment_profileId_revokedAt_idx" ON "RoleAssignment"("profileId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoleAssignment_profileId_role_organizationId_teamId_key" ON "RoleAssignment"("profileId", "role", "organizationId", "teamId");

-- CreateIndex
CREATE INDEX "JournalEntry_profileId_idx" ON "JournalEntry"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_profileId_day_key" ON "JournalEntry"("profileId", "day");

-- CreateIndex
CREATE INDEX "DailyReview_profileId_idx" ON "DailyReview"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReview_profileId_day_key" ON "DailyReview"("profileId", "day");

-- CreateIndex
CREATE INDEX "MindsetTakeaway_membershipId_idx" ON "MindsetTakeaway"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "MindsetTakeaway_profileId_day_key" ON "MindsetTakeaway"("profileId", "day");

-- CreateIndex
CREATE INDEX "PointsLedger_profileId_idx" ON "PointsLedger"("profileId");

-- CreateIndex
CREATE INDEX "PointsLedger_membershipId_createdAt_idx" ON "PointsLedger"("membershipId", "createdAt");

-- CreateIndex
CREATE INDEX "Quest_organizationId_active_idx" ON "Quest"("organizationId", "active");

-- CreateIndex
CREATE INDEX "QuestLog_membershipId_day_idx" ON "QuestLog"("membershipId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "QuestLog_profileId_questId_day_key" ON "QuestLog"("profileId", "questId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRead_notificationId_profileId_key" ON "NotificationRead"("notificationId", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_profileId_key" ON "MessageReaction"("messageId", "profileId");

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileContact" ADD CONSTRAINT "ProfileContact_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReview" ADD CONSTRAINT "DailyReview_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MindsetTakeaway" ADD CONSTRAINT "MindsetTakeaway_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MindsetTakeaway" ADD CONSTRAINT "MindsetTakeaway_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsLedger" ADD CONSTRAINT "PointsLedger_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsLedger" ADD CONSTRAINT "PointsLedger_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestLog" ADD CONSTRAINT "QuestLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestLog" ADD CONSTRAINT "QuestLog_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_authorProfileId_fkey" FOREIGN KEY ("authorProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_authorProfileId_fkey" FOREIGN KEY ("authorProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

