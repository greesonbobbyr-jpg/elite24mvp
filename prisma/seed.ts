/**
 * Elite24MVP — database seed v2 (hierarchy rebuild Stage 5).
 *
 * NEW-WORLD-FIRST: builds Organization → Season → Team → Profile → Membership
 * (+ RoleAssignment) with the legacy columns dual-written, exactly the state
 * the app runs on mid-migration. Exercises the WHOLE permission matrix and
 * the acting-membership switcher:
 *
 *   ORG "Mustang Broncos" — TWO teams (Varsity + JV), so org-wide staff
 *     access is real, not theoretical:
 *     - Coach Gary       HEAD_COACH (Varsity) + ORG_ADMIN
 *     - Coach Dana       ASSISTANT_COACH (Varsity)  — view-only roster
 *     - Morgan Reyes     GENERAL_MANAGER (Varsity)  — can end memberships
 *     - Coach Jamie      HEAD_COACH (JV)
 *     - Alex Vaughn      ORG_ADMIN with NO membership (org authority only)
 *     - Casey Rivers     TWO-TEAM ATHLETE (Varsity + JV memberships)
 *     - Devon Price      ENDED membership (removed from Varsity; history kept)
 *   ORG "OKC Thunder" — one team, 1:1 with the legacy shape (Coach Riley).
 *
 * DailyReview rows are seeded (the long-standing gap), quests exist as the 6
 * ACTIVE globals + INACTIVE org clones (the production pre-converge state):
 * back-dated quest logs point at the org clones, today's at the globals.
 * Every ledger row is stamped (profileId + membershipId) and all three point
 * caches equal their ledger sums.
 *
 * Players log in by USERNAME, staff by EMAIL; one shared demo password.
 * Safe to re-run (wipe + reseed, SEED_CONFIRM-guarded).
 * Run with: npm run seed
 */
import {
  PrismaClient,
  Role,
  PointsSource,
  MessageType,
  ReactionType,
  ReviewOutcome,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join as pathJoin } from "node:path";
import { todayKey as tzDayKey } from "../lib/daykey";
import { advanceStreak, type StreakState } from "../lib/streaks";

const prisma = new PrismaClient();

// Mirrors lib/points.ts; duplicated here so the seed stays standalone.
const POINTS_PER_CHECKIN = 10;
const POINTS_PER_REVIEW = 5;

const DEV_PASSWORD =
  process.env.SEED_PASSWORD || `e24-${randomBytes(4).toString("hex")}`;

// ---------------------------------------------------------------- fixtures ---

type PlayerSeed = {
  name: string;
  email: string;
  dream: string;
  heightInches: number;
  position: string;
  jerseyNumber: number;
  ppg: number;
  rpg: number;
  apg: number;
  favoritePlayer: string;
  favoriteTeam: string;
  highlightUrl?: string;
  onboarded?: boolean; // default true; false = must complete setup in-app
};

const VARSITY_PLAYERS: PlayerSeed[] = [
  { name: "Jordan Carter", email: "jordan.carter@example.com", dream: "Play Division I basketball and earn a full scholarship.", heightInches: 70, position: "Point Guard", jerseyNumber: 24, ppg: 14.2, rpg: 3.1, apg: 5.4, favoritePlayer: "Stephen Curry", favoriteTeam: "Golden State Warriors", highlightUrl: "https://www.youtube.com/watch?v=3qH2bQF4yGo" },
  { name: "Malik Johnson", email: "malik.johnson@example.com", dream: "Earn a spot in my varsity team's starting five this season.", heightInches: 74, position: "Forward", jerseyNumber: 21, ppg: 11.5, rpg: 7.8, apg: 1.9, favoritePlayer: "LeBron James", favoriteTeam: "Los Angeles Lakers", highlightUrl: "https://youtu.be/H4iY3hVjnoc" },
  { name: "Tyler Nguyen", email: "tyler.nguyen@example.com", dream: "Become the best on-ball defender on my team.", heightInches: 71, position: "Shooting Guard", jerseyNumber: 5, ppg: 8.3, rpg: 2.4, apg: 4.1, favoritePlayer: "Jrue Holiday", favoriteTeam: "Boston Celtics" },
  { name: "Andre Washington", email: "andre.washington@example.com", dream: "Dunk in a real game by the end of the year.", heightInches: 76, position: "Center", jerseyNumber: 34, ppg: 9.9, rpg: 9.2, apg: 1.2, favoritePlayer: "Giannis Antetokounmpo", favoriteTeam: "Milwaukee Bucks", onboarded: false },
  { name: "Sam Okafor", email: "sam.okafor@example.com", dream: "Get recruited to play college basketball.", heightInches: 78, position: "Center", jerseyNumber: 50, ppg: 12.4, rpg: 10.1, apg: 0.9, favoritePlayer: "Joel Embiid", favoriteTeam: "Philadelphia 76ers" },
  { name: "Brandon Lee", email: "brandon.lee@example.com", dream: "Be a leader my teammates can always count on.", heightInches: 73, position: "Forward", jerseyNumber: 14, ppg: 9.2, rpg: 6.0, apg: 3.3, favoritePlayer: "Jayson Tatum", favoriteTeam: "Boston Celtics", onboarded: false },
];

const JV_PLAYERS: PlayerSeed[] = [
  { name: "Diego Ramirez", email: "diego.ramirez@example.com", dream: "Lead my team in assists and run the offense.", heightInches: 69, position: "Point Guard", jerseyNumber: 11, ppg: 7.1, rpg: 2.0, apg: 6.0, favoritePlayer: "Chris Paul", favoriteTeam: "Phoenix Suns" },
  { name: "Chris Thompson", email: "chris.thompson@example.com", dream: "Raise my free-throw percentage above 85%.", heightInches: 72, position: "Guard/Forward", jerseyNumber: 8, ppg: 10.0, rpg: 4.5, apg: 2.8, favoritePlayer: "Devin Booker", favoriteTeam: "Phoenix Suns" },
];

const THUNDER_PLAYERS: PlayerSeed[] = [
  { name: "Marcus Green", email: "marcus.green@example.com", dream: "Make the all-conference team this year.", heightInches: 72, position: "Point Guard", jerseyNumber: 7, ppg: 13.0, rpg: 3.5, apg: 4.8, favoritePlayer: "Ja Morant", favoriteTeam: "Memphis Grizzlies" },
  { name: "Isaiah Brooks", email: "isaiah.brooks@example.com", dream: "Add a reliable three-point shot to my game.", heightInches: 70, position: "Shooting Guard", jerseyNumber: 9, ppg: 8.8, rpg: 2.6, apg: 3.2, favoritePlayer: "Damian Lillard", favoriteTeam: "Milwaukee Bucks" },
  { name: "Noah Patel", email: "noah.patel@example.com", dream: "Start every game and stay healthy all season.", heightInches: 75, position: "Forward", jerseyNumber: 23, ppg: 10.5, rpg: 7.0, apg: 2.1, favoritePlayer: "Kevin Durant", favoriteTeam: "Phoenix Suns" },
  { name: "Tyrese Walker", email: "tyrese.walker@example.com", dream: "Make varsity and lock down the other team's best scorer.", heightInches: 73, position: "Shooting Guard", jerseyNumber: 4, ppg: 9.4, rpg: 3.0, apg: 2.7, favoritePlayer: "Shai Gilgeous-Alexander", favoriteTeam: "Oklahoma City Thunder" },
];

// The matrix/switcher special cases (Mustang org).
const CASEY: PlayerSeed = { name: "Casey Rivers", email: "casey.rivers@example.com", dream: "Play up a level and earn varsity minutes this year.", heightInches: 71, position: "Combo Guard", jerseyNumber: 3, ppg: 9.0, rpg: 3.2, apg: 4.0, favoritePlayer: "Tyrese Haliburton", favoriteTeam: "Indiana Pacers" };
const DEVON: PlayerSeed = { name: "Devon Price", email: "devon.price@example.com", dream: "Get back on the roster and prove I belong.", heightInches: 74, position: "Forward", jerseyNumber: 32, ppg: 8.1, rpg: 5.5, apg: 1.6, favoritePlayer: "Paolo Banchero", favoriteTeam: "Orlando Magic" };

// PLACEHOLDER quests — Gary to replace (deliberately not E24P-cycle-specific).
const QUESTS = [
  { title: "Shooting reps", description: "Get up 100 shots — game spots, both sides.", points: 15, sortOrder: 1, targetCount: 100 },
  { title: "Ball-handling", description: "10 minutes of two-ball dribbling drills.", points: 10, sortOrder: 2 },
  { title: "Free throws", description: "Shoot 50 free throws and track your makes.", points: 10, sortOrder: 3, targetCount: 50 },
  { title: "Conditioning", description: "Run sprints or a timed mile.", points: 15, sortOrder: 4 },
  { title: "Strength & core", description: "15 minutes of bodyweight strength and core work.", points: 10, sortOrder: 5 },
  { title: "Film study", description: "Watch 10 minutes of film and note one thing to improve.", points: 10, sortOrder: 6 },
];

const REFLECTIONS = [
  "100 free throws after practice. Made 84.",
  "Worked on my left-hand layups for 30 minutes.",
  "Ball-handling drills — two balls, 15 minutes.",
  "Defensive slides and closeouts with Coach.",
  "Watched film of my last game and took notes.",
  "Conditioning: suicides and a timed mile.",
  "Form shooting, close range, both hands.",
  "Practiced my floater and runners in the lane.",
  "Box-out drills and rebounding positioning.",
  "Worked on pull-up jumpers off the dribble.",
  "Stretching and mobility — taking care of my body.",
  "Studied pick-and-roll reads with the coaches.",
];

const REVIEW_LEARNED = [
  "My shot falls when my feet are set — rushing kills it.",
  "I defend better when I talk on every switch.",
  "Short rest between drills beats one long grind.",
  "Film first, then reps — I fix things faster that way.",
  "My left hand is coming along — trust it in games.",
];

const CHECKIN_OFFSETS = [1, 2, 4, 5, 7, 9, 11, 14, 17, 20, 24, 28, 33, 39];
const QUEST_OFFSETS = [1, 2, 3, 5, 6, 8, 10, 12, 15, 18, 22, 26, 31, 38];

function dayKeyOf(date: Date): string {
  return tzDayKey(date);
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}
function hoursAgo(n: number): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() - n);
  return d;
}

const usedUsernames = new Set<string>();
function makeUsername(name: string): string {
  const base = (name.split(/\s+/)[0] || "player")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  let candidate = base || "player";
  let n = 1;
  while (usedUsernames.has(candidate)) {
    n += 1;
    candidate = `${base}${n}`;
  }
  usedUsernames.add(candidate);
  return candidate;
}

// Identity registry: everything downstream stamps rows via this.
type Person = {
  userId: number;
  profileId: number;
  membershipId: number | null; // primary/acting membership
  teamId: number;
  orgId: number;
};
const people = new Map<string, Person>(); // by email
const personOf = (email: string) => {
  const p = people.get(email);
  if (!p) throw new Error(`seed: unknown person ${email}`);
  return p;
};

// ------------------------------------------------------------- create people --

async function createStaff(opts: {
  name: string;
  email: string;
  teamId: number;
  orgId: number;
  seasonId: number;
  passwordHash: string;
  membershipRole: Role | null; // null = no membership (org-admin only)
  orgAdmin: boolean;
}) {
  const user = await prisma.user.create({
    data: {
      name: opts.name,
      email: opts.email,
      role: Role.COACH, // legacy login role for ALL staff (dies at Stage 6)
      teamId: opts.teamId,
      passwordHash: opts.passwordHash,
    },
  });
  const profile = await prisma.profile.create({
    data: { userId: user.id, name: opts.name, setupCompletedAt: new Date() },
  });
  let membershipId: number | null = null;
  if (opts.membershipRole) {
    const m = await prisma.membership.create({
      data: {
        profileId: profile.id,
        teamId: opts.teamId,
        seasonId: opts.seasonId,
        role: opts.membershipRole,
      },
    });
    membershipId = m.id;
  }
  if (opts.orgAdmin) {
    await prisma.roleAssignment.create({
      data: { profileId: profile.id, role: Role.ORG_ADMIN, organizationId: opts.orgId },
    });
  }
  people.set(opts.email, {
    userId: user.id,
    profileId: profile.id,
    membershipId,
    teamId: opts.teamId,
    orgId: opts.orgId,
  });
}

async function createPlayer(
  p: PlayerSeed,
  teamId: number,
  orgId: number,
  seasonId: number,
  passwordHash: string,
) {
  const onboarded = p.onboarded !== false;
  const user = await prisma.user.create({
    data: {
      name: p.name,
      email: p.email,
      username: makeUsername(p.name),
      role: Role.PLAYER,
      teamId,
      passwordHash,
      // Legacy PlayerProfile only once onboarded (legacy gate parity).
      ...(onboarded
        ? {
            profile: {
              create: {
                dream: p.dream,
                heightInches: p.heightInches,
                position: p.position,
                jerseyNumber: p.jerseyNumber,
                pointsPerGame: p.ppg,
                reboundsPerGame: p.rpg,
                assistsPerGame: p.apg,
                favoritePlayer: p.favoritePlayer,
                favoriteTeam: p.favoriteTeam,
                highlightUrl: p.highlightUrl ?? null,
                onboardedAt: new Date(),
              },
            },
          }
        : {}),
    },
  });
  // Everyone gets a permanent Profile (locked decision #6); setup completes
  // when the Dream is written.
  const profile = await prisma.profile.create({
    data: {
      userId: user.id,
      name: p.name,
      ...(onboarded
        ? {
            dream: p.dream,
            heightInches: p.heightInches,
            position: p.position,
            jerseyNumber: p.jerseyNumber,
            pointsPerGame: p.ppg,
            reboundsPerGame: p.rpg,
            assistsPerGame: p.apg,
            favoritePlayer: p.favoritePlayer,
            favoriteTeam: p.favoriteTeam,
            highlightUrl: p.highlightUrl ?? null,
            setupCompletedAt: new Date(),
          }
        : {}),
    },
  });
  const membership = await prisma.membership.create({
    data: { profileId: profile.id, teamId, seasonId, role: Role.PLAYER },
  });
  people.set(p.email, {
    userId: user.id,
    profileId: profile.id,
    membershipId: membership.id,
    teamId,
    orgId,
  });
  return { user, profile, membership };
}

// ---------------------------------------------------- sample portraits ------

// DEV-ONLY sample portraits (card redesign §49/§55): if the owner has dropped
// the Cason Wallace sample into design/reference/, every seeded person gets it
// so cards/leaderboard/roster/chat evaluate with a real portrait. Preferred:
// sample-athlete-cutout.png (background already removed, real alpha); else
// sample-athlete.* is used for BOTH original and cutout (un-cut placeholder).
// The seed only ever runs against local/dev DBs (SEED_CONFIRM guard) — this
// sample is never production data.
async function seedSamplePortraits(): Promise<number> {
  const refDir = pathJoin(process.cwd(), "design", "reference");
  const read = (name: string): string | null => {
    for (const ext of ["png", "webp", "jpg", "jpeg"]) {
      const p = pathJoin(refDir, `${name}.${ext}`);
      if (existsSync(p)) {
        const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
        return `data:${mime};base64,${readFileSync(p).toString("base64")}`;
      }
    }
    return null;
  };
  const original = read("sample-athlete");
  const cutout = read("sample-athlete-cutout") ?? original;
  if (!cutout) return 0;
  const photoMeta = { version: 1, seeded: true };
  const photoFields = {
    photoUrl: original ?? cutout,
    photoCutoutUrl: cutout,
    photoMeta,
  };
  const [players, users, profiles] = await Promise.all([
    prisma.playerProfile.updateMany({ data: photoFields }),
    prisma.user.updateMany({ data: photoFields }),
    prisma.profile.updateMany({ data: photoFields }),
  ]);
  void users;
  void profiles;
  return players.count;
}

// ------------------------------------------------------------- activity ------

// Back-dated check-ins (+ Pro Reviews on ~half the days) — fully stamped.
async function seedCheckIns(email: string, count: number) {
  const p = personOf(email);
  const offsets = CHECKIN_OFFSETS.slice(0, count);
  let reviews = 0;
  for (let i = 0; i < offsets.length; i++) {
    const date = daysAgo(offsets[i]);
    const day = dayKeyOf(date);
    await prisma.journalEntry.create({
      data: { userId: p.userId, profileId: p.profileId, reflection: REFLECTIONS[i % REFLECTIONS.length], day, createdAt: date },
    });
    await prisma.pointsLedger.create({
      data: { userId: p.userId, profileId: p.profileId, membershipId: p.membershipId, amount: POINTS_PER_CHECKIN, reason: "Daily check-in", source: PointsSource.DAILY_CHECK_IN, createdAt: date },
    });
    // Every other day closes the loop with an evening Pro Review (the seeded-
    // DailyReview gap, finally filled).
    if (i % 2 === 0) {
      const outcome = [ReviewOutcome.YES, ReviewOutcome.PARTIAL, ReviewOutcome.NO][i % 3];
      await prisma.dailyReview.create({
        data: {
          userId: p.userId,
          profileId: p.profileId,
          day,
          outcome,
          learned: REVIEW_LEARNED[i % REVIEW_LEARNED.length],
          noteToTomorrow: i % 4 === 0 ? "Start with free throws before anything else." : null,
          createdAt: new Date(date.getTime() + 8 * 3600_000), // that evening
        },
      });
      await prisma.pointsLedger.create({
        data: { userId: p.userId, profileId: p.profileId, membershipId: p.membershipId, amount: POINTS_PER_REVIEW, reason: "Pro Review", source: PointsSource.REVIEW, createdAt: new Date(date.getTime() + 8 * 3600_000) },
      });
      reviews++;
    }
  }
  return { checkIns: offsets.length, reviews };
}

// Back-dated quest completions — pointed at the player's ORG CLONE (the
// post-backfill state), stamped, with matching ledger rows.
async function seedQuestLogs(
  email: string,
  cloneQuestsByOrg: Map<number, { id: number; title: string; points: number }[]>,
  count: number,
  membershipOverride?: { membershipId: number; teamId: number; shift: number },
) {
  const p = personOf(email);
  const membershipId = membershipOverride?.membershipId ?? p.membershipId;
  const clones = cloneQuestsByOrg.get(p.orgId)!;
  // `shift` staggers a second batch for the same person (the two-team
  // athlete) so days/quests never collide with their first batch's unique key.
  const shift = membershipOverride?.shift ?? 0;
  const offsets = QUEST_OFFSETS.slice(shift, shift + count);
  for (let i = 0; i < offsets.length; i++) {
    const date = daysAgo(offsets[i]);
    const quest = clones[(i + shift) % clones.length];
    await prisma.questLog.create({
      data: { userId: p.userId, profileId: p.profileId, membershipId, questId: quest.id, day: dayKeyOf(date), createdAt: date },
    });
    await prisma.pointsLedger.create({
      data: { userId: p.userId, profileId: p.profileId, membershipId, amount: quest.points, reason: quest.title, source: PointsSource.QUEST, createdAt: date },
    });
  }
  return offsets.length;
}

// Today's live activity — logs point at the GLOBAL quests (pre-converge
// production state), stamped like the dual-write path writes them.
async function seedTodayActivity(
  globalQuests: { id: number; title: string; points: number }[],
) {
  const date = daysAgo(0);
  const day = dayKeyOf(date);
  let checkIns = 0;
  let questLogs = 0;
  for (const email of [
    "jordan.carter@example.com",
    "tyler.nguyen@example.com",
    "marcus.green@example.com",
  ]) {
    const p = personOf(email);
    await prisma.mindsetTakeaway.create({
      data: { userId: p.userId, profileId: p.profileId, membershipId: p.membershipId, day, text: "Show up before anyone else is awake.", createdAt: date },
    });
    await prisma.journalEntry.create({
      data: { userId: p.userId, profileId: p.profileId, reflection: "Locked in for today.", day, createdAt: date },
    });
    await prisma.pointsLedger.create({
      data: { userId: p.userId, profileId: p.profileId, membershipId: p.membershipId, amount: POINTS_PER_CHECKIN, reason: "Daily check-in", source: PointsSource.DAILY_CHECK_IN, createdAt: date },
    });
    checkIns++;
  }
  const jordan = personOf("jordan.carter@example.com");
  for (const quest of globalQuests.slice(0, 2)) {
    await prisma.questLog.create({
      data: { userId: jordan.userId, profileId: jordan.profileId, membershipId: jordan.membershipId, questId: quest.id, day, createdAt: date },
    });
    await prisma.pointsLedger.create({
      data: { userId: jordan.userId, profileId: jordan.profileId, membershipId: jordan.membershipId, amount: quest.points, reason: quest.title, source: PointsSource.QUEST, createdAt: date },
    });
    questLogs++;
  }
  return { checkIns, questLogs };
}

// ------------------------------------------------------- comms (stamped) -----

type SeedNotification = {
  title: string;
  body: string;
  daysAgo: number;
  isTimeout: boolean;
  readers: string[];
};

const VARSITY_NOTIFICATIONS: SeedNotification[] = [
  { title: "Practice moved to 5 PM Thursday", body: "Hey team — this week's Thursday practice moves to 5:00 PM at the main gym. Be on time and ready to work.", daysAgo: 6, isTimeout: false, readers: ["jordan.carter@example.com", "malik.johnson@example.com", "tyler.nguyen@example.com"] },
  { title: "Bring a water bottle every session", body: "Reminder: bring a full water bottle to every practice and workout. Hydration is part of the work.", daysAgo: 3, isTimeout: false, readers: ["jordan.carter@example.com", "malik.johnson@example.com"] },
  { title: "Great hustle on Saturday", body: "Proud of the effort in the scrimmage. Let's carry that energy into this week's quests and check-ins.", daysAgo: 1, isTimeout: false, readers: ["jordan.carter@example.com"] },
  { title: "Practice moved to 5 PM TODAY", body: "Heads up — today's practice is moved up to 5:00 PM at the main gym. Eat early, be on time. Acknowledge so I know you saw this.", daysAgo: 0, isTimeout: true, readers: ["tyler.nguyen@example.com"] },
];

const JV_NOTIFICATIONS: SeedNotification[] = [
  { title: "JV film session Friday", body: "JV — film room Friday right after school. Bring a notebook.", daysAgo: 2, isTimeout: false, readers: ["diego.ramirez@example.com"] },
];

const OKC_NOTIFICATIONS: SeedNotification[] = [
  { title: "Team lift Wednesday 4 PM", body: "Thunder — team lift moves to Wednesday at 4:00 PM. Bring your logbook and be ready to work.", daysAgo: 2, isTimeout: false, readers: ["marcus.green@example.com", "isaiah.brooks@example.com"] },
];

async function seedNotifications(
  authorEmail: string,
  teamId: number,
  authorRole: Role,
  notifications: SeedNotification[],
) {
  const author = personOf(authorEmail);
  for (const n of notifications) {
    const notification = await prisma.notification.create({
      data: {
        teamId,
        authorId: author.userId,
        authorProfileId: author.profileId,
        authorRole,
        title: n.title,
        body: n.body,
        isTimeout: n.isTimeout,
        createdAt: daysAgo(n.daysAgo),
      },
    });
    for (const email of n.readers) {
      const reader = personOf(email);
      await prisma.notificationRead.create({
        data: { notificationId: notification.id, userId: reader.userId, profileId: reader.profileId },
      });
    }
  }
  return notifications.length;
}

type SeedReaction = { email: string; type: ReactionType };
type SeedMessage = {
  email: string;
  authorRole: Role;
  type: MessageType;
  hoursAgo: number;
  body: string;
  key?: string;
  replyToKey?: string;
  reactions: SeedReaction[];
};

const VARSITY_MESSAGES: SeedMessage[] = [
  { email: "gary@elite24.demo", authorRole: Role.HEAD_COACH, type: "REGULAR", hoursAgo: 46, body: "Great energy at practice today 🔥 Same time tomorrow — be early.", reactions: [{ email: "jordan.carter@example.com", type: "THUMBS_UP" }, { email: "tyler.nguyen@example.com", type: "PRAY" }] },
  { key: "goat", email: "gary@elite24.demo", authorRole: Role.HEAD_COACH, type: "DISCUSSION", hoursAgo: 40, body: "Discussion of the Day: Who's the GOAT — Jordan or LeBron? 🐐 Drop your take.", reactions: [{ email: "jordan.carter@example.com", type: "THUMBS_UP" }, { email: "malik.johnson@example.com", type: "LAUGH" }, { email: "tyler.nguyen@example.com", type: "HEART" }] },
  { replyToKey: "goat", email: "jordan.carter@example.com", authorRole: Role.PLAYER, type: "REGULAR", hoursAgo: 39.9, body: "MJ all day. 6-0 in the Finals, never lost. 🐐", reactions: [{ email: "gary@elite24.demo", type: "THUMBS_UP" }] },
  { replyToKey: "goat", email: "malik.johnson@example.com", authorRole: Role.PLAYER, type: "REGULAR", hoursAgo: 39.7, body: "Bron — longevity and makes everyone better. 🔥", reactions: [{ email: "tyler.nguyen@example.com", type: "HEART" }] },
  // The assistant coach posts too — a REGULAR message (special types are
  // HC/ORG_ADMIN only, exactly what the matrix enforces).
  { email: "dana@elite24.demo", authorRole: Role.ASSISTANT_COACH, type: "REGULAR", hoursAgo: 32, body: "Film clips from Saturday are up — check the shared drive before Thursday.", reactions: [{ email: "jordan.carter@example.com", type: "THUMBS_UP" }] },
  { key: "challenge", email: "gary@elite24.demo", authorRole: Role.HEAD_COACH, type: "CHALLENGE", hoursAgo: 30, body: "Challenge of the Week: 500 made free throws by Sunday. Track 'em. 🎯", reactions: [{ email: "jordan.carter@example.com", type: "PRAY" }, { email: "malik.johnson@example.com", type: "HEART" }] },
  { replyToKey: "challenge", email: "malik.johnson@example.com", authorRole: Role.PLAYER, type: "REGULAR", hoursAgo: 29, body: "Already at 200 makes 🎯", reactions: [] },
  { key: "spotlight", email: "gary@elite24.demo", authorRole: Role.HEAD_COACH, type: "SPOTLIGHT", hoursAgo: 20, body: "Coach's Spotlight: Tyler locked up on defense all week 💪🔥 Keep leading.", reactions: [{ email: "jordan.carter@example.com", type: "HEART" }, { email: "malik.johnson@example.com", type: "PRAY" }] },
  { replyToKey: "spotlight", email: "jordan.carter@example.com", authorRole: Role.PLAYER, type: "REGULAR", hoursAgo: 19, body: "Well deserved, Tyler 🔒💪", reactions: [{ email: "tyler.nguyen@example.com", type: "PRAY" }] },
  { email: "casey.rivers@example.com", authorRole: Role.PLAYER, type: "REGULAR", hoursAgo: 4, body: "Let's get after it. LFG team 💯🏀", reactions: [{ email: "tyler.nguyen@example.com", type: "LAUGH" }, { email: "gary@elite24.demo", type: "PRAY" }] },
];

const JV_MESSAGES: SeedMessage[] = [
  { email: "jamie@elite24.demo", authorRole: Role.HEAD_COACH, type: "REGULAR", hoursAgo: 26, body: "JV — proud of the improvement this month. Keep stacking days. 🧱", reactions: [{ email: "diego.ramirez@example.com", type: "THUMBS_UP" }] },
  { email: "diego.ramirez@example.com", authorRole: Role.PLAYER, type: "REGULAR", hoursAgo: 6, body: "Extra ball-handling tonight, who's in? 🏀", reactions: [{ email: "chris.thompson@example.com", type: "PRAY" }] },
];

const OKC_MESSAGES: SeedMessage[] = [
  { email: "riley@elite24.demo", authorRole: Role.HEAD_COACH, type: "REGULAR", hoursAgo: 30, body: "Welcome to the Thunder 💙⚡ Let's build something special this year.", reactions: [{ email: "marcus.green@example.com", type: "THUMBS_UP" }, { email: "isaiah.brooks@example.com", type: "PRAY" }] },
  { key: "okc-challenge", email: "riley@elite24.demo", authorRole: Role.HEAD_COACH, type: "CHALLENGE", hoursAgo: 22, body: "Challenge of the Week: 3 workouts logged by Friday. ⚡ Who's in?", reactions: [{ email: "marcus.green@example.com", type: "HEART" }, { email: "noah.patel@example.com", type: "THUMBS_UP" }] },
  { replyToKey: "okc-challenge", email: "marcus.green@example.com", authorRole: Role.PLAYER, type: "REGULAR", hoursAgo: 20, body: "On it, Coach. 2 down already 💪", reactions: [{ email: "riley@elite24.demo", type: "THUMBS_UP" }] },
  { email: "isaiah.brooks@example.com", authorRole: Role.PLAYER, type: "REGULAR", hoursAgo: 5, body: "Let's go Thunder ⚡🧡", reactions: [{ email: "riley@elite24.demo", type: "PRAY" }] },
];

async function seedTeamMessages(teamId: number, messages: SeedMessage[]) {
  let messageCount = 0;
  const keyToId = new Map<string, number>();
  for (const m of messages) {
    const author = personOf(m.email);
    const replyToId = m.replyToKey ? keyToId.get(m.replyToKey) ?? null : null;
    const created = await prisma.teamMessage.create({
      data: {
        teamId,
        authorId: author.userId,
        authorProfileId: author.profileId,
        authorRole: m.authorRole,
        body: m.body,
        type: m.type,
        replyToId,
        createdAt: hoursAgo(m.hoursAgo),
      },
    });
    messageCount++;
    if (m.key) keyToId.set(m.key, created.id);
    for (const r of m.reactions) {
      const reactor = personOf(r.email);
      await prisma.messageReaction.create({
        data: { messageId: created.id, userId: reactor.userId, profileId: reactor.profileId, reactionType: r.type },
      });
    }
  }
  return messageCount;
}

// ------------------------------------------------------------------- main ----

async function main() {
  // Safety (CLAUDE.md §7): seeding WIPES the target database. Explicit
  // confirmation naming the exact DB host required. No confirmation → no wipe.
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed: NODE_ENV is production.");
    process.exit(1);
  }
  let dbHost = "";
  try {
    dbHost = new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    /* fall through to the refusal below */
  }
  if (!dbHost || process.env.SEED_CONFIRM !== dbHost) {
    console.error(
      `Refusing to seed. This WIPES AND RESEEDS the database at:\n\n    ${dbHost || "(unparseable DATABASE_URL)"}\n\nIf that is really what you want, run:\n\n    SEED_CONFIRM=${dbHost} npm run seed\n`,
    );
    process.exit(1);
  }

  // Reset (safe to re-run): children before parents, both worlds.
  await prisma.pointsLedger.deleteMany();
  await prisma.mindsetTakeaway.deleteMany();
  await prisma.questLog.deleteMany();
  await prisma.notificationRead.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.messageReaction.deleteMany();
  await prisma.teamMessage.updateMany({ data: { replyToId: null } });
  await prisma.teamMessage.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.dailyReview.deleteMany();
  await prisma.playerProfile.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.roleAssignment.deleteMany();
  await prisma.profileContact.deleteMany();
  await prisma.user.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.quest.deleteMany();
  await prisma.team.deleteMany();
  await prisma.season.deleteMany();
  await prisma.organization.deleteMany();

  // ---- The new world: orgs, seasons, teams -------------------------------
  const seasonName = String(new Date().getFullYear());
  const mustangOrg = await prisma.organization.create({ data: { name: "Mustang Broncos" } });
  const mustangSeason = await prisma.season.create({
    data: { organizationId: mustangOrg.id, name: seasonName, isCurrent: true },
  });
  const varsity = await prisma.team.create({
    data: { name: "Mustang Broncos", joinCode: "MUSTNG", logoUrl: "/mustang-logo.png", primaryColor: "#c8102e", secondaryColor: "#ffffff", organizationId: mustangOrg.id },
  });
  const jv = await prisma.team.create({
    data: { name: "Mustang JV", joinCode: "MUSTJV", logoUrl: "/mustang-logo.png", primaryColor: "#c8102e", secondaryColor: "#d9d9d9", organizationId: mustangOrg.id },
  });
  const thunderOrg = await prisma.organization.create({ data: { name: "OKC Thunder" } });
  const thunderSeason = await prisma.season.create({
    data: { organizationId: thunderOrg.id, name: seasonName, isCurrent: true },
  });
  const thunder = await prisma.team.create({
    data: { name: "OKC Thunder", joinCode: "THUNDR", primaryColor: "#007ac1", secondaryColor: "#ef3b24", organizationId: thunderOrg.id },
  });

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  // ---- Staff: the whole matrix -------------------------------------------
  const staffCommon = { passwordHash, orgId: mustangOrg.id, seasonId: mustangSeason.id };
  await createStaff({ name: "Coach Gary", email: "gary@elite24.demo", teamId: varsity.id, membershipRole: Role.HEAD_COACH, orgAdmin: true, ...staffCommon });
  await createStaff({ name: "Coach Dana", email: "dana@elite24.demo", teamId: varsity.id, membershipRole: Role.ASSISTANT_COACH, orgAdmin: false, ...staffCommon });
  await createStaff({ name: "Morgan Reyes", email: "morgan@elite24.demo", teamId: varsity.id, membershipRole: Role.GENERAL_MANAGER, orgAdmin: false, ...staffCommon });
  await createStaff({ name: "Coach Jamie", email: "jamie@elite24.demo", teamId: jv.id, membershipRole: Role.HEAD_COACH, orgAdmin: false, ...staffCommon });
  // Org authority WITHOUT a roster spot.
  await createStaff({ name: "Alex Vaughn", email: "alex@elite24.demo", teamId: varsity.id, membershipRole: null, orgAdmin: true, ...staffCommon });
  await createStaff({ name: "Coach Riley", email: "riley@elite24.demo", teamId: thunder.id, membershipRole: Role.HEAD_COACH, orgAdmin: true, passwordHash, orgId: thunderOrg.id, seasonId: thunderSeason.id });

  // ---- Players ------------------------------------------------------------
  for (const p of VARSITY_PLAYERS) await createPlayer(p, varsity.id, mustangOrg.id, mustangSeason.id, passwordHash);
  for (const p of JV_PLAYERS) await createPlayer(p, jv.id, mustangOrg.id, mustangSeason.id, passwordHash);
  for (const p of THUNDER_PLAYERS) await createPlayer(p, thunder.id, thunderOrg.id, thunderSeason.id, passwordHash);

  // TWO-TEAM ATHLETE: Casey — Varsity (primary/acting) + JV memberships. The
  // JV membership is back-dated so the cookie-less default (most recent)
  // resolves to Varsity, matching the legacy teamId anchor.
  const casey = await createPlayer(CASEY, varsity.id, mustangOrg.id, mustangSeason.id, passwordHash);
  const caseyJv = await prisma.membership.create({
    data: { profileId: casey.profile.id, teamId: jv.id, seasonId: mustangSeason.id, role: Role.PLAYER, startedAt: daysAgo(30) },
  });

  // ENDED MEMBERSHIP: Devon — removed from Varsity by Gary; history kept.
  const devon = await createPlayer(DEVON, varsity.id, mustangOrg.id, mustangSeason.id, passwordHash);

  // ---- Quests: 6 ACTIVE globals + INACTIVE clones per org (pre-converge) --
  const globalQuests = [];
  for (const q of QUESTS) globalQuests.push(await prisma.quest.create({ data: q }));
  const cloneQuestsByOrg = new Map<number, { id: number; title: string; points: number }[]>();
  for (const orgId of [mustangOrg.id, thunderOrg.id]) {
    const clones = [];
    for (const q of QUESTS) {
      clones.push(
        await prisma.quest.create({
          data: { ...q, organizationId: orgId, active: false },
        }),
      );
    }
    cloneQuestsByOrg.set(orgId, clones);
  }

  // ---- Back-dated activity (stamped; reviews close the loop) --------------
  let totalCheckIns = 0;
  let totalReviews = 0;
  let totalQuestLogs = 0;
  const activity = [
    { email: "jordan.carter@example.com", checkIns: 12, quests: 13 },
    { email: "malik.johnson@example.com", checkIns: 9, quests: 8 },
    { email: "tyler.nguyen@example.com", checkIns: 7, quests: 4 },
    { email: "diego.ramirez@example.com", checkIns: 6, quests: 5 },
    { email: "chris.thompson@example.com", checkIns: 4, quests: 3 },
    { email: "casey.rivers@example.com", checkIns: 8, quests: 5 }, // varsity side
    { email: "devon.price@example.com", checkIns: 5, quests: 4 }, // before removal
    { email: "marcus.green@example.com", checkIns: 8, quests: 6 },
    { email: "isaiah.brooks@example.com", checkIns: 5, quests: 4 },
    { email: "noah.patel@example.com", checkIns: 3, quests: 2 },
    { email: "tyrese.walker@example.com", checkIns: 2, quests: 1 },
  ];
  for (const a of activity) {
    const r = await seedCheckIns(a.email, a.checkIns);
    totalCheckIns += r.checkIns;
    totalReviews += r.reviews;
    totalQuestLogs += await seedQuestLogs(a.email, cloneQuestsByOrg, a.quests);
  }
  // Casey's JV side: a few quest logs credited to the JV membership, so both
  // of the athlete's boards have real numbers to switch between.
  totalQuestLogs += await seedQuestLogs(
    "casey.rivers@example.com",
    cloneQuestsByOrg,
    3,
    { membershipId: caseyJv.id, teamId: jv.id, shift: 8 },
  );

  const today = await seedTodayActivity(globalQuests);
  totalCheckIns += today.checkIns;
  totalQuestLogs += today.questLogs;

  // Devon's removal — AFTER their history exists (endMembership semantics:
  // only the membership ends; everything else stays).
  await prisma.membership.update({
    where: { id: devon.membership.id },
    data: { endedAt: daysAgo(2), endedByProfileId: personOf("gary@elite24.demo").profileId },
  });

  // ---- Comms (author snapshots + stamped reads/reactions) -----------------
  const totalNotifications =
    (await seedNotifications("gary@elite24.demo", varsity.id, Role.HEAD_COACH, VARSITY_NOTIFICATIONS)) +
    (await seedNotifications("jamie@elite24.demo", jv.id, Role.HEAD_COACH, JV_NOTIFICATIONS)) +
    (await seedNotifications("riley@elite24.demo", thunder.id, Role.HEAD_COACH, OKC_NOTIFICATIONS));
  const totalMessages =
    (await seedTeamMessages(varsity.id, VARSITY_MESSAGES)) +
    (await seedTeamMessages(jv.id, JV_MESSAGES)) +
    (await seedTeamMessages(thunder.id, OKC_MESSAGES));

  // ---- Recompute ALL THREE point caches + streaks from the ledger ---------
  for (const [, p] of people) {
    const byUser = await prisma.pointsLedger.aggregate({ where: { userId: p.userId }, _sum: { amount: true } });
    const byProfile = await prisma.pointsLedger.aggregate({ where: { profileId: p.profileId }, _sum: { amount: true } });
    const entryDays = await prisma.journalEntry.findMany({
      where: { userId: p.userId },
      select: { day: true },
      orderBy: { day: "asc" },
    });
    let streak: StreakState = { currentStreak: 0, bestStreak: 0, lastCheckInDay: null, streakGraceUsed: false };
    for (const e of entryDays) streak = advanceStreak(streak, e.day);
    await prisma.playerProfile.updateMany({
      where: { userId: p.userId },
      data: { points: byUser._sum.amount ?? 0, ...streak },
    });
    await prisma.profile.update({
      where: { id: p.profileId },
      data: { careerPoints: byProfile._sum.amount ?? 0, ...streak },
    });
  }
  const memberships = await prisma.membership.findMany({ select: { id: true } });
  for (const m of memberships) {
    const sum = await prisma.pointsLedger.aggregate({ where: { membershipId: m.id }, _sum: { amount: true } });
    await prisma.membership.update({ where: { id: m.id }, data: { points: sum._sum.amount ?? 0 } });
  }

  const sampledPortraits = await seedSamplePortraits();

  // ---- Summary ------------------------------------------------------------
  const [orgCount, teamCount, profileCount, membershipCount, reviewCount] = await Promise.all([
    prisma.organization.count(),
    prisma.team.count(),
    prisma.profile.count(),
    prisma.membership.count(),
    prisma.dailyReview.count(),
  ]);
  console.log("Seed v2 complete:");
  if (sampledPortraits > 0) {
    console.log(`  Sample portraits applied to ${sampledPortraits} players (design/reference).`);
  } else {
    console.log("  No sample portrait found (design/reference/sample-athlete.*) — cards show initials.");
  }
  console.log(
    `  ${orgCount} orgs · ${teamCount} teams · ${profileCount} profiles · ${membershipCount} memberships (1 ended, 1 two-team) · ${reviewCount} reviews`,
  );
  console.log(
    `  Back-dated: ${totalCheckIns} check-ins + ${totalReviews} Pro Reviews + ${totalQuestLogs} quest logs · ${totalNotifications} notifications · ${totalMessages} board messages`,
  );
  console.log("");
  console.log(`=== DEMO LOGINS · password: "${DEV_PASSWORD}" ===`);
  console.log("");
  console.log("MUSTANG BRONCOS ORG");
  console.log("  Varsity (join code MUSTNG)");
  console.log("    Head coach:       gary@elite24.demo   (+ org admin)");
  console.log("    Assistant coach:  dana@elite24.demo   (view-only roster)");
  console.log("    General manager:  morgan@elite24.demo (can remove, can't adjust points)");
  console.log("    Players:          jordan, malik, tyler, sam, casey   (username login)");
  console.log("    Onboarding demo:  andre, brandon (log in → setup flow)");
  console.log("  JV (join code MUSTJV)");
  console.log("    Head coach:       jamie@elite24.demo");
  console.log("    Players:          diego, chris, casey (two-team!)");
  console.log("  Org admin (no team): alex@elite24.demo — org authority without a roster spot");
  console.log("  Two-team athlete:    casey — switch teams via the header switcher / dev tool");
  console.log("  Removed player:      devon — logs in to the 'join a team' card (code MUSTNG restores)");
  console.log("");
  console.log("OKC THUNDER   (join code THUNDR)");
  console.log("  Head coach: riley@elite24.demo");
  console.log("  Players:    marcus, isaiah, noah, tyrese   (username login)");
  console.log("");
  console.log(
    'Run `npm run dev`. The dev switcher (bottom-left) jumps into any org → team → member context.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
