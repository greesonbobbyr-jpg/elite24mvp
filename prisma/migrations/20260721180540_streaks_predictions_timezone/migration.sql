-- AlterTable
ALTER TABLE "Team" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Chicago';

-- AlterTable
ALTER TABLE "PlayerProfile" ADD COLUMN "currentStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "bestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastCheckInDay" TEXT,
ADD COLUMN "streakGraceUsed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Quest" ADD COLUMN "targetCount" INTEGER;

-- AlterTable
ALTER TABLE "QuestLog" ADD COLUMN "predicted" INTEGER,
ADD COLUMN "actual" INTEGER;
