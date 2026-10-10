-- Phase 6, step 2 of 2 — run AFTER the Phase 6 code is live.
--
-- Drops the layers nothing reads any more: Program / Division (replaced by
-- the group tree), the legacy columns on the login (User.role, User.teamId,
-- the staff photo columns) and Team.parentId, the PlayerProfile table (every
-- field lives on Profile), and the retired COACH role value.
--
-- One transaction: all of it or none of it. It refuses to run if anything
-- would be lost. (scripts/phase6-preflight.ts is the full field-by-field
-- check; run it BEFORE the Phase 6 code goes live — after that PlayerProfile
-- stops being updated, by design.)
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" u LEFT JOIN "Profile" p ON p."userId" = u.id WHERE p.id IS NULL) THEN
    RAISE EXCEPTION 'Phase 6 drop refused: a login has no Profile';
  END IF;
  IF EXISTS (SELECT 1 FROM "PlayerProfile" pp LEFT JOIN "Profile" p ON p."userId" = pp."userId" WHERE p.id IS NULL) THEN
    RAISE EXCEPTION 'Phase 6 drop refused: a PlayerProfile row has no Profile';
  END IF;
  IF EXISTS (SELECT 1 FROM "PlayerProfile" pp JOIN "Profile" p ON p."userId" = pp."userId" WHERE p."dream" IS NULL) THEN
    RAISE EXCEPTION 'Phase 6 drop refused: a Dream is missing from a Profile';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Team" t
    JOIN "Division" d ON d.id = t."divisionId"
    JOIN "Program" p ON p.id = d."programId"
    WHERE t."groupId" IS NULL
      AND ((SELECT count(*) FROM "Program" p2 WHERE p2."organizationId" = p."organizationId") > 1
        OR (SELECT count(*) FROM "Division" d2 WHERE d2."programId" = p.id) > 1)
  ) THEN
    RAISE EXCEPTION 'Phase 6 drop refused: a team sits in a real Program/Division with no group';
  END IF;
END $$;

-- The login: role, team anchor and staff photo columns.
ALTER TABLE "User" DROP CONSTRAINT "User_teamId_fkey";
ALTER TABLE "User" DROP COLUMN "photoCutoutUrl",
DROP COLUMN "photoMeta",
DROP COLUMN "photoUrl",
DROP COLUMN "role",
DROP COLUMN "teamId";

-- Team: the Division link and the unused parent link.
ALTER TABLE "Team" DROP CONSTRAINT "Team_divisionId_fkey";
ALTER TABLE "Team" DROP CONSTRAINT "Team_parentId_fkey";
DROP INDEX "Team_divisionId_idx";
ALTER TABLE "Team" DROP COLUMN "divisionId",
DROP COLUMN "parentId";

-- Group: where a backfilled group came from.
DROP INDEX "Group_legacyDivisionId_key";
DROP INDEX "Group_legacyProgramId_key";
ALTER TABLE "Group" DROP COLUMN "legacyDivisionId",
DROP COLUMN "legacyProgramId";

-- The old tables.
ALTER TABLE "Division" DROP CONSTRAINT "Division_programId_fkey";
ALTER TABLE "Program" DROP CONSTRAINT "Program_organizationId_fkey";
ALTER TABLE "PlayerProfile" DROP CONSTRAINT "PlayerProfile_userId_fkey";
DROP TABLE "Division";
DROP TABLE "Program";
DROP TABLE "PlayerProfile";

-- Retire the COACH role value (after User.role, its last user, is gone).
-- The casts fail — and the whole migration rolls back — if any row still
-- holds it.
CREATE TYPE "Role_new" AS ENUM ('PLAYER', 'ORG_ADMIN', 'GROUP_ADMIN', 'HEAD_COACH', 'ASSISTANT_COACH', 'GENERAL_MANAGER');
ALTER TABLE "Membership" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TABLE "RoleAssignment" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TABLE "Invite" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TABLE "Notification" ALTER COLUMN "authorRole" TYPE "Role_new" USING ("authorRole"::text::"Role_new");
ALTER TABLE "TeamMessage" ALTER COLUMN "authorRole" TYPE "Role_new" USING ("authorRole"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";

COMMIT;
