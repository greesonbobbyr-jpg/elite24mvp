-- CreateTable
CREATE TABLE "MindsetTakeaway" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MindsetTakeaway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MindsetTakeaway_userId_idx" ON "MindsetTakeaway"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MindsetTakeaway_userId_day_key" ON "MindsetTakeaway"("userId", "day");
