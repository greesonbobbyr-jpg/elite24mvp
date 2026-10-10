/**
 * PHASE 6 PRE-CHECK — read-only, COUNTS ONLY (no names, emails or text).
 *
 * Phase 6 deletes the old layers for good: Program / Division, the legacy
 * User.role / User.teamId / User photo columns, and PlayerProfile. This
 * proves nothing unique lives there before any of it is dropped — every
 * line must read 0 for the step it gates. It also counts the accounts that
 * still have no email (they'd be locked out if username login ended).
 *
 *   npx tsx scripts/phase6-preflight.ts
 *
 * Exit code 1 if anything that gates a deletion is not 0.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const count = async (sql: string): Promise<number> => {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::bigint AS n FROM (${sql}) q`);
  return Number(rows[0].n);
};

// PlayerProfile field → the Profile field that replaced it.
const PLAYER_FIELDS: [string, string][] = [
  ["dream", "dream"],
  ["heightInches", "heightInches"],
  ["position", "position"],
  ["jerseyNumber", "jerseyNumber"],
  ["pointsPerGame", "pointsPerGame"],
  ["reboundsPerGame", "reboundsPerGame"],
  ["assistsPerGame", "assistsPerGame"],
  ["favoritePlayer", "favoritePlayer"],
  ["favoriteTeam", "favoriteTeam"],
  ["highlightUrl", "highlightUrl"],
  ["photoUrl", "photoUrl"],
  ["photoCutoutUrl", "photoCutoutUrl"],
  ["currentStreak", "currentStreak"],
  ["bestStreak", "bestStreak"],
  ["lastCheckInDay", "lastCheckInDay"],
  ["streakGraceUsed", "streakGraceUsed"],
  ["points", "careerPoints"],
];

async function main() {
  let host = "";
  try {
    host = new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    /* printed as empty */
  }
  console.log(`PHASE 6 PRE-CHECK against ${host} — counts only\n`);
  let blockers = 0;
  const gate = (n: number, label: string) => {
    console.log(`${n === 0 ? "OK   " : "STOP "} ${String(n).padStart(5)}  ${label}`);
    if (n !== 0) blockers++;
  };
  const info = (n: number, label: string) => console.log(`info  ${String(n).padStart(5)}  ${label}`);

  console.log("— Sizes");
  info(await count(`SELECT 1 FROM "User"`), "logins");
  info(await count(`SELECT 1 FROM "Profile"`), "people (Profile)");
  info(await count(`SELECT 1 FROM "PlayerProfile"`), "PlayerProfile rows (to be dropped)");
  info(await count(`SELECT 1 FROM "Organization"`), "organizations");
  info(await count(`SELECT 1 FROM "Program"`), "Program rows (to be dropped)");
  info(await count(`SELECT 1 FROM "Division"`), "Division rows (to be dropped)");
  info(await count(`SELECT 1 FROM "Group"`), "groups");

  console.log("\n— Username login (ending it locks these accounts out)");
  gate(await count(`SELECT 1 FROM "User" WHERE email IS NULL`), "logins with NO email");

  console.log("\n— Program / Division → the group tree");
  // A team whose place is more than the org's lone default Program + Division
  // and that has no group: its place would be lost.
  gate(
    await count(`
      SELECT 1 FROM "Team" t
      JOIN "Division" d ON d.id = t."divisionId"
      JOIN "Program" p ON p.id = d."programId"
      WHERE t."groupId" IS NULL
        AND ((SELECT count(*) FROM "Program" p2 WHERE p2."organizationId" = p."organizationId") > 1
          OR (SELECT count(*) FROM "Division" d2 WHERE d2."programId" = p.id) > 1)`),
    "teams placed in a real Program/Division with no group",
  );

  console.log("\n— Everyone has a Profile, and it holds everything");
  gate(await count(`SELECT 1 FROM "User" u LEFT JOIN "Profile" p ON p."userId" = u.id WHERE p.id IS NULL`), "logins with no Profile");
  gate(
    await count(`SELECT 1 FROM "PlayerProfile" pp LEFT JOIN "Profile" p ON p."userId" = pp."userId" WHERE p.id IS NULL`),
    "PlayerProfile rows with no Profile",
  );
  for (const [legacy, current] of PLAYER_FIELDS) {
    gate(
      await count(
        `SELECT 1 FROM "PlayerProfile" pp JOIN "Profile" p ON p."userId" = pp."userId" WHERE pp."${legacy}" IS DISTINCT FROM p."${current}"`,
      ),
      `PlayerProfile.${legacy} ≠ Profile.${current}`,
    );
  }
  gate(
    await count(
      `SELECT 1 FROM "PlayerProfile" pp JOIN "Profile" p ON p."userId" = pp."userId" WHERE pp."photoMeta"::text IS DISTINCT FROM p."photoMeta"::text`,
    ),
    "PlayerProfile.photoMeta ≠ Profile.photoMeta",
  );
  gate(
    await count(
      `SELECT 1 FROM "PlayerProfile" pp JOIN "Profile" p ON p."userId" = pp."userId" WHERE (pp."onboardedAt" IS NULL) <> (p."setupCompletedAt" IS NULL)`,
    ),
    "onboarded (PlayerProfile) ≠ set up (Profile)",
  );
  // Staff photos lived on User; players' on PlayerProfile.
  for (const col of ["photoUrl", "photoCutoutUrl"]) {
    gate(
      await count(`
        SELECT 1 FROM "User" u JOIN "Profile" p ON p."userId" = u.id
        LEFT JOIN "PlayerProfile" pp ON pp."userId" = u.id
        WHERE pp.id IS NULL AND u."${col}" IS NOT NULL AND u."${col}" IS DISTINCT FROM p."${col}"`),
      `staff User.${col} not on their Profile`,
    );
  }

  console.log("\n— Nobody depends on the legacy role / team anchor");
  // Someone the old columns still put on a team, but with no membership there.
  gate(
    await count(`
      SELECT 1 FROM "Team" t
      WHERE EXISTS (SELECT 1 FROM "User" u WHERE u."teamId" = t.id)
        AND NOT EXISTS (SELECT 1 FROM "Membership" m WHERE m."teamId" = t.id)`),
    "teams with logins anchored to them but no memberships at all",
  );
  gate(await count(`SELECT 1 FROM "Team" WHERE "organizationId" IS NULL`), "teams with no organization");
  gate(await count(`SELECT 1 FROM "Team" WHERE "parentId" IS NOT NULL`), "teams using the old parentId");
  // Staff by the legacy role only: no staff membership and no admin grant.
  gate(
    await count(`
      SELECT 1 FROM "User" u JOIN "Profile" p ON p."userId" = u.id
      WHERE u.role = 'COACH'
        AND NOT EXISTS (SELECT 1 FROM "Membership" m WHERE m."profileId" = p.id AND m.role <> 'PLAYER')
        AND NOT EXISTS (SELECT 1 FROM "RoleAssignment" r WHERE r."profileId" = p.id)
        AND NOT EXISTS (SELECT 1 FROM "PlatformGrant" g WHERE g."profileId" = p.id)`),
    "staff by the legacy login role only (no staff spot, grant or CEO)",
  );
  for (const [table, col] of [
    ["Membership", "role"],
    ["RoleAssignment", "role"],
    ["Notification", "authorRole"],
    ["TeamMessage", "authorRole"],
  ]) {
    gate(await count(`SELECT 1 FROM "${table}" WHERE "${col}" = 'COACH'`), `${table}.${col} still the legacy COACH value`);
  }

  // Behaviour changes, not data loss: who notices the old team anchor going.
  info(
    await count(`
      SELECT 1 FROM "Profile" p JOIN "User" u ON u.id = p."userId"
      WHERE u."teamId" IS NOT NULL
        AND EXISTS (SELECT 1 FROM "RoleAssignment" r WHERE r."profileId" = p.id AND r."revokedAt" IS NULL)
        AND NOT EXISTS (SELECT 1 FROM "Membership" m JOIN "Season" s ON s.id = m."seasonId"
                        WHERE m."profileId" = p.id AND m."endedAt" IS NULL AND s."isCurrent")`),
    "admins with no roster spot who were shown a team (they'll land on Organization View)",
  );
  info(
    (await count(`SELECT 1 FROM "TeamMessage" WHERE "authorRole" IS NULL`)) +
      (await count(`SELECT 1 FROM "Notification" WHERE "authorRole" IS NULL`)),
    'posts with no role snapshot (shown without a staff badge / as "Coach")',
  );

  console.log("\n— Every row is stamped with its person");
  for (const table of ["JournalEntry", "DailyReview", "MindsetTakeaway", "PointsLedger", "QuestLog", "NotificationRead", "MessageReaction"]) {
    gate(await count(`SELECT 1 FROM "${table}" WHERE "profileId" IS NULL`), `${table} rows with no profileId`);
  }
  for (const table of ["Notification", "TeamMessage"]) {
    gate(await count(`SELECT 1 FROM "${table}" WHERE "authorProfileId" IS NULL`), `${table} rows with no authorProfileId`);
  }

  console.log("\n— Quests");
  gate(
    await count(`SELECT 1 FROM "Organization" o WHERE NOT EXISTS (SELECT 1 FROM "Quest" q WHERE q."organizationId" = o.id AND q.active)`),
    "organizations with no active quests (they'd fall back to the shared set)",
  );

  console.log(blockers === 0 ? "\nALL CLEAR — nothing unique lives in what Phase 6 deletes." : `\n${blockers} line(s) say STOP.`);
  if (blockers > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
