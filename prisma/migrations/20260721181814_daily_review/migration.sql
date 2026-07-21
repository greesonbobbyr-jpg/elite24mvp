-- AlterEnum
ALTER TYPE "PointsSource" ADD VALUE 'REVIEW';

-- CreateEnum
CREATE TYPE "ReviewOutcome" AS ENUM ('YES', 'PARTIAL', 'NO');

-- CreateTable
CREATE TABLE "DailyReview" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "outcome" "ReviewOutcome" NOT NULL,
    "learned" TEXT NOT NULL,
    "noteToTomorrow" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyReview_userId_idx" ON "DailyReview"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReview_userId_day_key" ON "DailyReview"("userId", "day");

-- AddForeignKey
ALTER TABLE "DailyReview" ADD CONSTRAINT "DailyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
