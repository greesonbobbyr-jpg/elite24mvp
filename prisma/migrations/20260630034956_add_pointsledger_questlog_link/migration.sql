-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PointsLedger" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "questLogId" INTEGER,
    CONSTRAINT "PointsLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PointsLedger_questLogId_fkey" FOREIGN KEY ("questLogId") REFERENCES "QuestLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PointsLedger" ("amount", "createdAt", "id", "reason", "source", "userId") SELECT "amount", "createdAt", "id", "reason", "source", "userId" FROM "PointsLedger";
DROP TABLE "PointsLedger";
ALTER TABLE "new_PointsLedger" RENAME TO "PointsLedger";
CREATE UNIQUE INDEX "PointsLedger_questLogId_key" ON "PointsLedger"("questLogId");
CREATE INDEX "PointsLedger_userId_idx" ON "PointsLedger"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
