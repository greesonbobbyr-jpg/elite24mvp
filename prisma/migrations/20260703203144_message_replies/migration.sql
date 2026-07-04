-- Replace flat MessageComment thread with Messenger-style reply-quotes:
-- add a self-referential TeamMessage.replyToId (a reply points at the message it
-- answers; SET NULL on parent delete) and drop the MessageComment table.

-- DropIndex
DROP INDEX "MessageComment_messageId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MessageComment";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TeamMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teamId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'REGULAR',
    "gifId" TEXT,
    "replyToId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "TeamMessage_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "TeamMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TeamMessage" ("authorId", "body", "createdAt", "deletedAt", "gifId", "id", "teamId", "type") SELECT "authorId", "body", "createdAt", "deletedAt", "gifId", "id", "teamId", "type" FROM "TeamMessage";
DROP TABLE "TeamMessage";
ALTER TABLE "new_TeamMessage" RENAME TO "TeamMessage";
CREATE INDEX "TeamMessage_teamId_idx" ON "TeamMessage"("teamId");
CREATE INDEX "TeamMessage_replyToId_idx" ON "TeamMessage"("replyToId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
