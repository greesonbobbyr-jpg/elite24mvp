-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinCode" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "parentId" INTEGER,
    CONSTRAINT "Team_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- Carry the old single `accentColor` into the new `primaryColor` (this is a
-- rename + add; `secondaryColor` starts null). migrate diff can't see the rename,
-- so the copy is done explicitly here.
INSERT INTO "new_Team" ("createdAt", "id", "joinCode", "logoUrl", "name", "parentId", "primaryColor") SELECT "createdAt", "id", "joinCode", "logoUrl", "name", "parentId", "accentColor" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_joinCode_key" ON "Team"("joinCode");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passwordHash" TEXT,
    "username" TEXT,
    "teamId" INTEGER NOT NULL,
    CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "passwordHash", "role", "teamId", "username") SELECT "createdAt", "email", "id", "name", "passwordHash", "role", "teamId", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
