-- Team join code: players join a team by this short unique code (generated at
-- team creation; coach-regenerable). Null only for pre-existing rows.

-- AlterTable
ALTER TABLE "Team" ADD COLUMN "joinCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Team_joinCode_key" ON "Team"("joinCode");
