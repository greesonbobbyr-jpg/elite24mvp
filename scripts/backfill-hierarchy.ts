/**
 * HIERARCHY STAGE 1 — backfill (idempotent, additive data only).
 *
 * Creates the new-world rows for everything that exists in the old world and
 * stamps every legacy row's new dimension columns. Never deletes or mutates
 * legacy data beyond filling the new NULL columns. See HIERARCHY_PLAN.md §6.
 *
 *   npx tsx scripts/backfill-hierarchy.ts             → DRY RUN (read-only report)
 *   BACKFILL_CONFIRM=<db host> ... --execute          → run (single transaction)
 *   npx tsx scripts/backfill-hierarchy.ts --verify    → invariants report
 *
 * Idempotent: every create is find-first-else-create keyed on stable identity
 * (Team.organizationId, Profile.userId, Membership[profile,team,season], clone
 * by [org,title]); every stamp is `updateMany where <newcol> IS NULL`. A second
 * --execute run creates and stamps nothing.
 */
import { PrismaClient, Role, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const MODE = process.argv.includes("--execute")
  ? "execute"
  : process.argv.includes("--verify")
    ? "verify"
    : "dry-run";

const SEASON_NAME = String(new Date().getFullYear());

// Legacy login-role → new membership/author role.
const roleOf = (userRole: Role): Role =>
  userRole === Role.COACH ? Role.HEAD_COACH : Role.PLAYER;

function hostOf(url: string | undefined): string {
  try {
    return new URL(url ?? "").hostname;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------- dry run ---

async function dryRun() {
  const [teams, users, quests] = await Promise.all([
    prisma.team.findMany({ include: { organization: true } }),
    prisma.user.findMany({ include: { profileRecord: true, profile: true } }),
    prisma.quest.findMany(),
  ]);
  const coaches = users.filter((u) => u.role === Role.COACH);
  const globalQuests = quests.filter((q) => q.organizationId == null);
  const orgs = await prisma.organization.count();

  const nullCounts = await stampGaps();

  console.log(`DRY RUN against ${hostOf(process.env.DATABASE_URL)}\n`);
  console.log("WOULD CREATE (skipping anything that already exists):");
  console.log(
    `  Organizations: ${teams.filter((t) => !t.organizationId).length} (teams: ${teams.length}, existing orgs: ${orgs})`,
  );
  console.log(`  Seasons ("${SEASON_NAME}"): one per new org`);
  console.log(
    `  Profiles: ${users.filter((u) => !u.profileRecord).length} (users: ${users.length})`,
  );
  console.log(`  Memberships: one per user (coach→HEAD_COACH, player→PLAYER)`);
  console.log(`  ORG_ADMIN grants: ${coaches.length} (one per coach)`);
  console.log(
    `  Quest clones: ${globalQuests.length} global quests × new orgs (logs re-pointed)`,
  );
  console.log("\nLEGACY ROWS AWAITING STAMPS (new column still NULL):");
  for (const [k, v] of Object.entries(nullCounts)) console.log(`  ${k}: ${v}`);
  console.log("\nNo writes performed. Run with --execute to apply.");
}

async function stampGaps() {
  const [
    journal, review, takeP, takeM, qlogP, qlogM, ledgerP, reads, reacts, msgs, notifs, qlogGlobal,
  ] = await Promise.all([
    prisma.journalEntry.count({ where: { profileId: null } }),
    prisma.dailyReview.count({ where: { profileId: null } }),
    prisma.mindsetTakeaway.count({ where: { profileId: null } }),
    prisma.mindsetTakeaway.count({ where: { membershipId: null } }),
    prisma.questLog.count({ where: { profileId: null } }),
    prisma.questLog.count({ where: { membershipId: null } }),
    prisma.pointsLedger.count({ where: { profileId: null } }),
    prisma.notificationRead.count({ where: { profileId: null } }),
    prisma.messageReaction.count({ where: { profileId: null } }),
    prisma.teamMessage.count({ where: { authorProfileId: null } }),
    prisma.notification.count({ where: { authorProfileId: null } }),
    prisma.questLog.count({ where: { quest: { organizationId: null } } }),
  ]);
  return {
    "JournalEntry.profileId": journal,
    "DailyReview.profileId": review,
    "MindsetTakeaway.profileId": takeP,
    "MindsetTakeaway.membershipId": takeM,
    "QuestLog.profileId": qlogP,
    "QuestLog.membershipId": qlogM,
    "PointsLedger.profileId (and membershipId)": ledgerP,
    "NotificationRead.profileId": reads,
    "MessageReaction.profileId": reacts,
    "TeamMessage.authorProfileId": msgs,
    "Notification.authorProfileId": notifs,
    "QuestLog → still pointing at GLOBAL quests": qlogGlobal,
  };
}

// ---------------------------------------------------------------- execute ---

async function execute() {
  const host = hostOf(process.env.DATABASE_URL);
  if (process.env.BACKFILL_CONFIRM !== host) {
    console.error(
      `Refusing to execute. This WRITES to:\n\n    ${host}\n\nIf that is intended, run with:\n\n    BACKFILL_CONFIRM=${host} npx tsx scripts/backfill-hierarchy.ts --execute\n`,
    );
    process.exit(1);
  }

  const created = {
    orgs: 0, seasons: 0, profiles: 0, memberships: 0, grants: 0, clones: 0,
  };
  const stamped: Record<string, number> = {};
  const bump = (k: string, n: number) => (stamped[k] = (stamped[k] ?? 0) + n);

  await prisma.$transaction(
    async (tx) => {
      // 1. Org + current season per team.
      const teams = await tx.team.findMany();
      const seasonByOrg = new Map<number, number>();
      const orgByTeam = new Map<number, number>();
      for (const team of teams) {
        let orgId = team.organizationId;
        if (orgId == null) {
          const org = await tx.organization.create({ data: { name: team.name } });
          created.orgs++;
          orgId = org.id;
          await tx.team.update({ where: { id: team.id }, data: { organizationId: orgId } });
        }
        orgByTeam.set(team.id, orgId);
        let season = await tx.season.findFirst({ where: { organizationId: orgId, isCurrent: true } });
        if (!season) {
          season = await tx.season.create({
            data: { organizationId: orgId, name: SEASON_NAME, isCurrent: true },
          });
          created.seasons++;
        }
        seasonByOrg.set(orgId, season.id);
      }

      // 2. Quest clones per org (global quest → org copy, keyed by [org, title]).
      const globalQuests = await tx.quest.findMany({ where: { organizationId: null } });
      // cloneId lookup: `${orgId}:${globalQuestId}`
      const cloneOf = new Map<string, number>();
      for (const orgId of new Set(orgByTeam.values())) {
        for (const gq of globalQuests) {
          let clone = await tx.quest.findFirst({
            where: { organizationId: orgId, title: gq.title },
          });
          if (!clone) {
            clone = await tx.quest.create({
              data: {
                organizationId: orgId,
                title: gq.title,
                description: gq.description,
                points: gq.points,
                targetCount: gq.targetCount,
                active: gq.active,
                sortOrder: gq.sortOrder,
              },
            });
            created.clones++;
          }
          cloneOf.set(`${orgId}:${gq.id}`, clone.id);
        }
      }

      // 3. Per user: Profile, Membership, coach ORG_ADMIN grant, then stamps.
      const users = await tx.user.findMany({ include: { profile: true } });
      for (const user of users) {
        const pp = user.profile; // legacy PlayerProfile (null for coaches / not-onboarded)
        const orgId = orgByTeam.get(user.teamId)!;
        const seasonId = seasonByOrg.get(orgId)!;

        let profile = await tx.profile.findUnique({ where: { userId: user.id } });
        if (!profile) {
          profile = await tx.profile.create({
            data: {
              userId: user.id,
              name: user.name,
              photoUrl: user.photoUrl ?? pp?.photoUrl ?? null,
              jerseyNumber: pp?.jerseyNumber ?? null,
              position: pp?.position ?? null,
              heightInches: pp?.heightInches ?? null,
              dream: pp?.dream ?? null,
              favoritePlayer: pp?.favoritePlayer ?? null,
              favoriteTeam: pp?.favoriteTeam ?? null,
              highlightUrl: pp?.highlightUrl ?? null,
              pointsPerGame: pp?.pointsPerGame ?? null,
              reboundsPerGame: pp?.reboundsPerGame ?? null,
              assistsPerGame: pp?.assistsPerGame ?? null,
              careerPoints: pp?.points ?? 0,
              currentStreak: pp?.currentStreak ?? 0,
              bestStreak: pp?.bestStreak ?? 0,
              lastCheckInDay: pp?.lastCheckInDay ?? null,
              streakGraceUsed: pp?.streakGraceUsed ?? false,
              // Players: onboarded-at carries over (null = still must onboard).
              // Staff: setup is considered complete (they have no Dream step).
              setupCompletedAt:
                user.role === Role.COACH ? (pp?.onboardedAt ?? user.createdAt) : (pp?.onboardedAt ?? null),
              createdAt: user.createdAt,
            },
          });
          created.profiles++;
        }

        let membership = await tx.membership.findFirst({
          where: { profileId: profile.id, teamId: user.teamId, seasonId },
        });
        if (!membership) {
          membership = await tx.membership.create({
            data: {
              profileId: profile.id,
              teamId: user.teamId,
              seasonId,
              role: roleOf(user.role),
              startedAt: user.createdAt,
              points: pp?.points ?? 0,
            },
          });
          created.memberships++;
        }

        if (user.role === Role.COACH) {
          const grant = await tx.roleAssignment.findFirst({
            where: { profileId: profile.id, role: Role.ORG_ADMIN, organizationId: orgId },
          });
          if (!grant) {
            await tx.roleAssignment.create({
              data: { profileId: profile.id, role: Role.ORG_ADMIN, organizationId: orgId },
            });
            created.grants++;
          }
        }

        const pid = profile.id;
        const mid = membership.id;
        const authorRole = roleOf(user.role);

        bump("JournalEntry", (await tx.journalEntry.updateMany({
          where: { userId: user.id, profileId: null }, data: { profileId: pid },
        })).count);
        bump("DailyReview", (await tx.dailyReview.updateMany({
          where: { userId: user.id, profileId: null }, data: { profileId: pid },
        })).count);
        bump("MindsetTakeaway", (await tx.mindsetTakeaway.updateMany({
          where: { userId: user.id, profileId: null },
          data: { profileId: pid, membershipId: mid },
        })).count);
        // Quest logs: stamp + RE-POINT to the org's clone in one update per quest.
        for (const gq of globalQuests) {
          bump("QuestLog (stamped + re-pointed)", (await tx.questLog.updateMany({
            where: { userId: user.id, questId: gq.id, profileId: null },
            data: {
              profileId: pid,
              membershipId: mid,
              questId: cloneOf.get(`${orgId}:${gq.id}`)!,
            },
          })).count);
        }
        bump("PointsLedger", (await tx.pointsLedger.updateMany({
          where: { userId: user.id, profileId: null },
          data: { profileId: pid, membershipId: mid },
        })).count);
        bump("NotificationRead", (await tx.notificationRead.updateMany({
          where: { userId: user.id, profileId: null }, data: { profileId: pid },
        })).count);
        bump("MessageReaction", (await tx.messageReaction.updateMany({
          where: { userId: user.id, profileId: null }, data: { profileId: pid },
        })).count);
        bump("TeamMessage authors", (await tx.teamMessage.updateMany({
          where: { authorId: user.id, authorProfileId: null },
          data: { authorProfileId: pid, authorRole },
        })).count);
        bump("Notification authors", (await tx.notification.updateMany({
          where: { authorId: user.id, authorProfileId: null },
          data: { authorProfileId: pid, authorRole },
        })).count);
      }
    },
    { maxWait: 20_000, timeout: 300_000 },
  );

  console.log(`EXECUTED against ${host}\n`);
  console.log("CREATED:");
  console.log(`  Organizations:   ${created.orgs}`);
  console.log(`  Seasons:         ${created.seasons}`);
  console.log(`  Profiles:        ${created.profiles}`);
  console.log(`  Memberships:     ${created.memberships}`);
  console.log(`  ORG_ADMIN grants:${created.grants}`);
  console.log(`  Quest clones:    ${created.clones}`);
  console.log("STAMPED (legacy rows given their new columns):");
  for (const [k, v] of Object.entries(stamped)) console.log(`  ${k}: ${v}`);
  if (Object.values(created).every((n) => n === 0) &&
      Object.values(stamped).every((n) => n === 0)) {
    console.log("\nNothing to do — backfill already complete (idempotent re-run).");
  }
}

// ----------------------------------------------------------------- verify ---

async function verify() {
  let failures = 0;
  const ok = (cond: boolean, label: string, detail = "") => {
    console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    if (!cond) failures++;
  };

  const [teamCount, orgCount, seasonCount, userCount, profileCount, memberCount, grantCount, coachCount] =
    await Promise.all([
      prisma.team.count(),
      prisma.organization.count(),
      prisma.season.count({ where: { isCurrent: true } }),
      prisma.user.count(),
      prisma.profile.count(),
      prisma.membership.count(),
      prisma.roleAssignment.count({ where: { role: Role.ORG_ADMIN, revokedAt: null } }),
      prisma.user.count({ where: { role: Role.COACH } }),
    ]);
  console.log(`COUNTS  teams=${teamCount} users=${userCount} coaches=${coachCount}`);
  ok(orgCount === teamCount, `Organizations == teams`, `${orgCount} vs ${teamCount}`);
  ok(seasonCount === orgCount, `One current season per org`, `${seasonCount} vs ${orgCount}`);
  ok(profileCount === userCount, `Profiles == users`, `${profileCount} vs ${userCount}`);
  ok(memberCount === userCount, `Memberships == users`, `${memberCount} vs ${userCount}`);
  ok(grantCount === coachCount, `ORG_ADMIN grants == coaches`, `${grantCount} vs ${coachCount}`);

  const teamsNoOrg = await prisma.team.count({ where: { organizationId: null } });
  ok(teamsNoOrg === 0, "Every team has organizationId");

  // Stamp coverage — every legacy row filled.
  const gaps = await stampGaps();
  for (const [k, v] of Object.entries(gaps)) {
    if (k.startsWith("QuestLog → still")) continue; // reported below
    ok(v === 0, `Stamped: ${k}`, v ? `${v} NULL rows remain` : "");
  }

  // Quest cloning.
  const globalQuestCount = await prisma.quest.count({ where: { organizationId: null } });
  const cloneCount = await prisma.quest.count({ where: { organizationId: { not: null } } });
  const logsOnGlobal = gaps["QuestLog → still pointing at GLOBAL quests"];
  ok(cloneCount === globalQuestCount * orgCount,
    `Quest clones == ${globalQuestCount} global × ${orgCount} orgs`, `${cloneCount}`);
  ok(logsOnGlobal === 0, "No QuestLog points at a global quest", `${logsOnGlobal}`);

  // Sum invariants.
  const profiles = await prisma.profile.findMany({ select: { id: true, name: true, careerPoints: true } });
  const byProfile = await prisma.pointsLedger.groupBy({ by: ["profileId"], _sum: { amount: true } });
  const sumP = new Map(byProfile.map((r) => [r.profileId, r._sum.amount ?? 0]));
  const badP = profiles.filter((p) => (sumP.get(p.id) ?? 0) !== p.careerPoints);
  ok(badP.length === 0, "careerPoints == Σ ledger by profile (every profile)",
    badP.length ? badP.map((p) => `${p.name}: cache ${p.careerPoints} vs Σ ${sumP.get(p.id) ?? 0}`).join("; ") : `${profiles.length} profiles checked`);

  const memberships = await prisma.membership.findMany({ select: { id: true, points: true, profile: { select: { name: true } } } });
  const byMember = await prisma.pointsLedger.groupBy({ by: ["membershipId"], _sum: { amount: true } });
  const sumM = new Map(byMember.map((r) => [r.membershipId, r._sum.amount ?? 0]));
  const badM = memberships.filter((m) => (sumM.get(m.id) ?? 0) !== m.points);
  ok(badM.length === 0, "membership.points == Σ ledger by membership (every membership)",
    badM.length ? badM.map((m) => `${m.profile.name}: cache ${m.points} vs Σ ${sumM.get(m.id) ?? 0}`).join("; ") : `${memberships.length} memberships checked`);

  console.log(failures === 0 ? "\nALL INVARIANTS PASS" : `\n${failures} FAILURES`);
  if (failures > 0) process.exitCode = 1;
}

// -------------------------------------------------------------------- run ---

(MODE === "execute" ? execute() : MODE === "verify" ? verify() : dryRun())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
