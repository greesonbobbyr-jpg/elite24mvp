-- Credential auth: add a bcrypt password hash + an (unused-for-now) unique
-- username to User for Auth.js credentials login. email stays unique; Int PK and
-- all relations are unchanged.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
