/**
 * Elite24MVP — database seed.
 *
 * Creates two teams of fake users so the owner can test multi-user UX with the
 * dev user switcher (CLAUDE.md section 7):
 *   - Team A: 1 coach + 8 players
 *   - Team B: 1 coach + 3 players (proves the multi-team data model works)
 *
 * Two Team A players (Andre Washington, Brandon Lee) are left NOT onboarded so
 * the forced onboarding flow can be tested.
 *
 * A few already-onboarded Team A players get back-dated daily check-ins AND
 * back-dated quest completions across the past several weeks (each with matching
 * points-ledger rows), so the journal, points history, and leaderboard look real
 * and the totals match the ledger.
 *
 * Safe to re-run: it wipes and recreates the seeded data each time.
 * Run with: npm run seed   (or it runs automatically on `prisma migrate reset`)
 */
import { PrismaClient, Role, PointsSource } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

const prisma = new PrismaClient();

// Team join code — mirrors lib/joincode.ts (kept inline so the seed stays
// standalone). Unambiguous alphabet, 6 chars.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function seedJoinCode(): string {
  let c = "";
  for (let i = 0; i < 6; i++) c += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return c;
}

// Mirrors lib/points.ts; duplicated here so the seed stays standalone.
const POINTS_PER_CHECKIN = 10;

// Shared DEV password for every seeded user so login works locally. DEV ONLY —
// the seed refuses to run outside a local SQLite file (see main()).
const DEV_PASSWORD = "password123";

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
  highlightUrl?: string; // pasted video link (placeholder in the seed)
  // Defaults to true. When false, the player is created without a profile so
  // they must complete onboarding in the app.
  onboarded?: boolean;
};

const teamAPlayers: PlayerSeed[] = [
  { name: "Jordan Carter", email: "jordan.carter@example.com", dream: "Play Division I basketball and earn a full scholarship.", heightInches: 70, position: "Point Guard", jerseyNumber: 3, ppg: 14.2, rpg: 3.1, apg: 5.4, favoritePlayer: "Stephen Curry", favoriteTeam: "Golden State Warriors", highlightUrl: "https://www.youtube.com/watch?v=3qH2bQF4yGo" },
  { name: "Malik Johnson", email: "malik.johnson@example.com", dream: "Earn a spot in my varsity team's starting five this season.", heightInches: 74, position: "Forward", jerseyNumber: 21, ppg: 11.5, rpg: 7.8, apg: 1.9, favoritePlayer: "LeBron James", favoriteTeam: "Los Angeles Lakers", highlightUrl: "https://youtu.be/H4iY3hVjnoc" },
  { name: "Tyler Nguyen", email: "tyler.nguyen@example.com", dream: "Become the best on-ball defender on my team.", heightInches: 71, position: "Shooting Guard", jerseyNumber: 5, ppg: 8.3, rpg: 2.4, apg: 4.1, favoritePlayer: "Jrue Holiday", favoriteTeam: "Boston Celtics" },
  { name: "Andre Washington", email: "andre.washington@example.com", dream: "Dunk in a real game by the end of the year.", heightInches: 76, position: "Center", jerseyNumber: 34, ppg: 9.9, rpg: 9.2, apg: 1.2, favoritePlayer: "Giannis Antetokounmpo", favoriteTeam: "Milwaukee Bucks", onboarded: false },
  { name: "Diego Ramirez", email: "diego.ramirez@example.com", dream: "Lead my team in assists and run the offense.", heightInches: 69, position: "Point Guard", jerseyNumber: 11, ppg: 7.1, rpg: 2.0, apg: 6.0, favoritePlayer: "Chris Paul", favoriteTeam: "Phoenix Suns" },
  { name: "Chris Thompson", email: "chris.thompson@example.com", dream: "Raise my free-throw percentage above 85%.", heightInches: 72, position: "Guard/Forward", jerseyNumber: 8, ppg: 10.0, rpg: 4.5, apg: 2.8, favoritePlayer: "Devin Booker", favoriteTeam: "Phoenix Suns" },
  { name: "Sam Okafor", email: "sam.okafor@example.com", dream: "Get recruited to play college basketball.", heightInches: 78, position: "Center", jerseyNumber: 50, ppg: 12.4, rpg: 10.1, apg: 0.9, favoritePlayer: "Joel Embiid", favoriteTeam: "Philadelphia 76ers" },
  { name: "Brandon Lee", email: "brandon.lee@example.com", dream: "Be a leader my teammates can always count on.", heightInches: 73, position: "Forward", jerseyNumber: 14, ppg: 9.2, rpg: 6.0, apg: 3.3, favoritePlayer: "Jayson Tatum", favoriteTeam: "Boston Celtics", onboarded: false },
];

const teamBPlayers: PlayerSeed[] = [
  { name: "Marcus Green", email: "marcus.green@example.com", dream: "Make the all-conference team this year.", heightInches: 72, position: "Point Guard", jerseyNumber: 7, ppg: 13.0, rpg: 3.5, apg: 4.8, favoritePlayer: "Ja Morant", favoriteTeam: "Memphis Grizzlies" },
  { name: "Isaiah Brooks", email: "isaiah.brooks@example.com", dream: "Add a reliable three-point shot to my game.", heightInches: 70, position: "Shooting Guard", jerseyNumber: 9, ppg: 8.8, rpg: 2.6, apg: 3.2, favoritePlayer: "Damian Lillard", favoriteTeam: "Milwaukee Bucks" },
  { name: "Noah Patel", email: "noah.patel@example.com", dream: "Start every game and stay healthy all season.", heightInches: 75, position: "Forward", jerseyNumber: 23, ppg: 10.5, rpg: 7.0, apg: 2.1, favoritePlayer: "Kevin Durant", favoriteTeam: "Phoenix Suns" },
];

// PLACEHOLDER quests — Gary to replace. Generic basketball-development daily
// tasks; deliberately NOT tied to the E24P 4-part cycle (future design).
const QUESTS = [
  { title: "Shooting reps", description: "Get up 100 shots — game spots, both sides.", points: 15, sortOrder: 1 },
  { title: "Ball-handling", description: "10 minutes of two-ball dribbling drills.", points: 10, sortOrder: 2 },
  { title: "Free throws", description: "Shoot 50 free throws and track your makes.", points: 10, sortOrder: 3 },
  { title: "Conditioning", description: "Run sprints or a timed mile.", points: 15, sortOrder: 4 },
  { title: "Strength & core", description: "15 minutes of bodyweight strength and core work.", points: 10, sortOrder: 5 },
  { title: "Film study", description: "Watch 10 minutes of film and note one thing to improve.", points: 10, sortOrder: 6 },
];

// Realistic short reflections for the back-dated journal.
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

// Distinct "days ago" so each back-dated entry lands on its own calendar day.
const CHECKIN_OFFSETS = [1, 2, 4, 5, 7, 9, 11, 14, 17, 20, 24, 28, 33, 39];
const QUEST_OFFSETS = [1, 2, 3, 5, 6, 8, 10, 12, 15, 18, 22, 26, 31, 38];

function dayKeyOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

// Players log in by username (coaches by email). Derive a simple username from
// the first name, deduped across the whole run so it stays globally unique
// (matches the app's join-flow rule: 3–20 chars of [a-z0-9_]).
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

async function createPlayers(
  teamId: number,
  players: PlayerSeed[],
  passwordHash: string,
) {
  for (const p of players) {
    const onboarded = p.onboarded !== false; // default true
    await prisma.user.create({
      data: {
        name: p.name,
        email: p.email,
        username: makeUsername(p.name),
        role: Role.PLAYER,
        teamId,
        passwordHash,
        // A not-yet-onboarded player has no PlayerProfile until they finish
        // onboarding in the app. Points start at 0; they are earned via the
        // ledger and recomputed at the end of seeding.
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
  }
}

// Back-date `count` daily check-ins for a player: a JournalEntry + a matching
// PointsLedger row per day.
async function seedCheckIns(email: string, count: number) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return 0;
  const offsets = CHECKIN_OFFSETS.slice(0, count);
  for (let i = 0; i < offsets.length; i++) {
    const date = daysAgo(offsets[i]);
    await prisma.journalEntry.create({
      data: { userId: user.id, reflection: REFLECTIONS[i % REFLECTIONS.length], day: dayKeyOf(date), createdAt: date },
    });
    await prisma.pointsLedger.create({
      data: { userId: user.id, amount: POINTS_PER_CHECKIN, reason: "Daily check-in", source: PointsSource.DAILY_CHECK_IN, createdAt: date },
    });
  }
  return offsets.length;
}

// Back-date `count` quest completions for a player (one quest per past day): a
// QuestLog + a matching PointsLedger row (source QUEST) each.
async function seedQuestLogs(
  email: string,
  quests: { id: number; title: string; points: number }[],
  count: number,
) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return 0;
  const offsets = QUEST_OFFSETS.slice(0, count);
  for (let i = 0; i < offsets.length; i++) {
    const date = daysAgo(offsets[i]);
    const quest = quests[i % quests.length];
    await prisma.questLog.create({
      data: { userId: user.id, questId: quest.id, day: dayKeyOf(date), createdAt: date },
    });
    await prisma.pointsLedger.create({
      data: { userId: user.id, amount: quest.points, reason: quest.title, source: PointsSource.QUEST, createdAt: date },
    });
  }
  return offsets.length;
}

// Sample notifications from Coach Marcus Bell to Team A, with a spread of reads
// so the coach's "Read by X of Y" view looks real. `readers` lists the player
// emails who have confirmed reading each notification.
const NOTIFICATIONS = [
  {
    title: "Practice moved to 5 PM Thursday",
    body: "Hey team — this week's Thursday practice moves to 5:00 PM at the main gym. Be on time and ready to work.",
    daysAgo: 6,
    isTimeout: false,
    readers: ["jordan.carter@example.com", "malik.johnson@example.com", "tyler.nguyen@example.com", "diego.ramirez@example.com"],
  },
  {
    title: "Bring a water bottle every session",
    body: "Reminder: bring a full water bottle to every practice and workout. Hydration is part of the work.",
    daysAgo: 3,
    isTimeout: false,
    readers: ["jordan.carter@example.com", "malik.johnson@example.com"],
  },
  {
    title: "Great hustle on Saturday",
    body: "Proud of the effort in the scrimmage. Let's carry that energy into this week's quests and check-ins.",
    daysAgo: 1,
    isTimeout: false,
    readers: ["jordan.carter@example.com"],
  },
  {
    // Urgent TIME OUT takeover. Acknowledged by Tyler + Diego; left UNREAD by
    // Jordan + Malik so switching to them shows the full-screen takeover, and the
    // coach's "Read by X of Y" view shows a realistic mix.
    title: "Practice moved to 5 PM TODAY",
    body: "Heads up — today's practice is moved up to 5:00 PM at the main gym. Eat early, be on time. Acknowledge so I know you saw this.",
    daysAgo: 0,
    isTimeout: true,
    readers: ["tyler.nguyen@example.com", "diego.ramirez@example.com"],
  },
];

async function seedNotifications() {
  const coach = await prisma.user.findUnique({
    where: { email: "coach.a@example.com" },
  });
  if (!coach) return 0;

  for (const n of NOTIFICATIONS) {
    const notification = await prisma.notification.create({
      data: {
        teamId: coach.teamId,
        authorId: coach.id,
        title: n.title,
        body: n.body,
        isTimeout: n.isTimeout,
        createdAt: daysAgo(n.daysAgo),
      },
    });
    for (const email of n.readers) {
      const player = await prisma.user.findUnique({ where: { email } });
      if (player) {
        await prisma.notificationRead.create({
          data: { notificationId: notification.id, userId: player.id },
        });
      }
    }
  }
  return NOTIFICATIONS.length;
}

// Placeholder text messages on Team A's board, from the coach + a few players,
// back-dated so the order looks real. Clearly demo content. `key` marks a message
// that gets replied to; `replyToKey` makes an entry a Messenger-style reply to
// that earlier message (→ replyToId). Entries stay ordered oldest-first so a
// reply always follows its parent.
const TEAM_A_MESSAGES = [
  {
    email: "coach.a@example.com", type: "REGULAR", hoursAgo: 46,
    body: "Great energy at practice today 🔥 Same time tomorrow — be early.",
    reactions: [{ email: "jordan.carter@example.com", type: "THUMBS_UP" }, { email: "tyler.nguyen@example.com", type: "PRAY" }],
  },
  {
    key: "goat",
    email: "coach.a@example.com", type: "DISCUSSION", hoursAgo: 40,
    body: "Discussion of the Day: Who's the GOAT — Jordan or LeBron? 🐐 Drop your take.",
    reactions: [{ email: "jordan.carter@example.com", type: "THUMBS_UP" }, { email: "malik.johnson@example.com", type: "LAUGH" }, { email: "tyler.nguyen@example.com", type: "HEART" }, { email: "diego.ramirez@example.com", type: "WOW" }],
  },
  {
    replyToKey: "goat",
    email: "jordan.carter@example.com", type: "REGULAR", hoursAgo: 39.9,
    body: "MJ all day. 6-0 in the Finals, never lost. 🐐",
    reactions: [{ email: "coach.a@example.com", type: "THUMBS_UP" }],
  },
  {
    replyToKey: "goat",
    email: "malik.johnson@example.com", type: "REGULAR", hoursAgo: 39.7,
    body: "Bron — longevity and makes everyone better. 🔥",
    reactions: [{ email: "tyler.nguyen@example.com", type: "HEART" }],
  },
  {
    email: "jordan.carter@example.com", type: "REGULAR", hoursAgo: 39,
    body: "MJ. 6-0 in the Finals. 🏀🐐",
    reactions: [{ email: "malik.johnson@example.com", type: "PRAY" }, { email: "diego.ramirez@example.com", type: "HEART" }],
  },
  {
    email: "malik.johnson@example.com", type: "REGULAR", hoursAgo: 38,
    body: "LeBron — longevity and all-around game. 💪",
    reactions: [{ email: "tyler.nguyen@example.com", type: "SAD" }],
  },
  {
    key: "challenge",
    email: "coach.a@example.com", type: "CHALLENGE", hoursAgo: 30,
    body: "Challenge of the Week: 500 made free throws by Sunday. Track 'em. 🎯",
    reactions: [{ email: "jordan.carter@example.com", type: "PRAY" }, { email: "malik.johnson@example.com", type: "HEART" }, { email: "tyler.nguyen@example.com", type: "THUMBS_UP" }],
  },
  {
    replyToKey: "challenge",
    email: "malik.johnson@example.com", type: "REGULAR", hoursAgo: 29,
    body: "Already at 200 makes 🎯",
    reactions: [],
  },
  {
    email: "tyler.nguyen@example.com", type: "REGULAR", hoursAgo: 28,
    body: "I'm in. Already at 120 makes. 🙌",
    reactions: [{ email: "coach.a@example.com", type: "PRAY" }, { email: "jordan.carter@example.com", type: "WOW" }],
  },
  {
    key: "spotlight",
    email: "coach.a@example.com", type: "SPOTLIGHT", hoursAgo: 20,
    body: "Coach's Spotlight: Tyler locked up on defense all week 💪🔥 Keep leading.",
    reactions: [{ email: "jordan.carter@example.com", type: "HEART" }, { email: "malik.johnson@example.com", type: "PRAY" }, { email: "diego.ramirez@example.com", type: "LAUGH" }],
  },
  {
    replyToKey: "spotlight",
    email: "jordan.carter@example.com", type: "REGULAR", hoursAgo: 19,
    body: "Well deserved, Tyler 🔒💪",
    reactions: [{ email: "tyler.nguyen@example.com", type: "PRAY" }],
  },
  {
    email: "diego.ramirez@example.com", type: "REGULAR", hoursAgo: 4,
    body: "Let's get after it. LFG team 💯🏀",
    reactions: [{ email: "tyler.nguyen@example.com", type: "LAUGH" }, { email: "coach.a@example.com", type: "PRAY" }],
  },
] as const;

function hoursAgo(n: number): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() - n);
  return d;
}

async function seedTeamMessages() {
  let messageCount = 0;
  let reactionCount = 0;
  let replyCount = 0;
  const keyToId = new Map<string, number>();
  for (const m of TEAM_A_MESSAGES) {
    const author = await prisma.user.findUnique({ where: { email: m.email } });
    if (!author) continue;

    const replyToKey = "replyToKey" in m ? m.replyToKey : undefined;
    const key = "key" in m ? m.key : undefined;
    const replyToId = replyToKey ? keyToId.get(replyToKey) ?? null : null;

    const created = await prisma.teamMessage.create({
      data: {
        teamId: author.teamId,
        authorId: author.id,
        body: m.body,
        type: m.type,
        replyToId,
        createdAt: hoursAgo(m.hoursAgo),
      },
    });
    messageCount++;
    if (replyToKey) replyCount++;
    if (key) keyToId.set(key, created.id);

    for (const r of m.reactions) {
      const reactor = await prisma.user.findUnique({ where: { email: r.email } });
      if (!reactor) continue;
      await prisma.messageReaction.create({
        data: { messageId: created.id, userId: reactor.id, reactionType: r.type },
      });
      reactionCount++;
    }
  }
  return { messageCount, reactionCount, replyCount };
}

// A couple of TODAY check-ins + quest completions so the coach dashboard demos
// live counts — some players show green "checked in", the rest amber. Today is
// free of back-dated rows (offsets start at 1), so there's no unique-key clash.
async function seedTodayActivity(
  quests: { id: number; title: string; points: number }[],
) {
  const date = daysAgo(0); // today (noon local)
  const day = dayKeyOf(date);
  let checkIns = 0;
  let questLogs = 0;
  for (const email of ["jordan.carter@example.com", "tyler.nguyen@example.com"]) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) continue;
    // The Mindset takeaway is the precondition for the check-in — seed it too so
    // the data is coherent and the coach drill-in has something to show.
    await prisma.mindsetTakeaway.create({
      data: { userId: user.id, day, text: "Show up before anyone else is awake.", createdAt: date },
    });
    await prisma.journalEntry.create({
      data: { userId: user.id, reflection: "Locked in for today.", day, createdAt: date },
    });
    await prisma.pointsLedger.create({
      data: { userId: user.id, amount: POINTS_PER_CHECKIN, reason: "Daily check-in", source: PointsSource.DAILY_CHECK_IN, createdAt: date },
    });
    checkIns++;
  }
  const jordan = await prisma.user.findUnique({
    where: { email: "jordan.carter@example.com" },
  });
  if (jordan) {
    for (const quest of quests.slice(0, 2)) {
      await prisma.questLog.create({
        data: { userId: jordan.id, questId: quest.id, day, createdAt: date },
      });
      await prisma.pointsLedger.create({
        data: { userId: jordan.id, amount: quest.points, reason: quest.title, source: PointsSource.QUEST, createdAt: date },
      });
      questLogs++;
    }
  }
  return { checkIns, questLogs };
}

async function main() {
  // Safety: only ever seed a local SQLite (file:) dev database (section 7).
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.NODE_ENV === "production" || !url.startsWith("file:")) {
    console.error(
      "Refusing to seed: this script only runs against a local SQLite (file:) dev database.",
    );
    process.exit(1);
  }

  // Reset (safe to re-run): delete children before parents.
  await prisma.pointsLedger.deleteMany();
  await prisma.mindsetTakeaway.deleteMany();
  await prisma.questLog.deleteMany();
  await prisma.notificationRead.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.messageReaction.deleteMany();
  // Break reply self-references before deleting messages (FK-safe).
  await prisma.teamMessage.updateMany({ data: { replyToId: null } });
  await prisma.teamMessage.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.playerProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.quest.deleteMany();
  await prisma.team.deleteMany();

  const teamA = await prisma.team.create({ data: { name: "Team A", joinCode: seedJoinCode() } });
  const teamB = await prisma.team.create({ data: { name: "Team B", joinCode: seedJoinCode() } });

  // One shared bcrypt hash for the dev password across all seeded users.
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  await prisma.user.create({
    data: { name: "Coach Marcus Bell", email: "coach.a@example.com", role: Role.COACH, teamId: teamA.id, passwordHash },
  });
  await prisma.user.create({
    data: { name: "Coach Tasha Reed", email: "coach.b@example.com", role: Role.COACH, teamId: teamB.id, passwordHash },
  });

  await createPlayers(teamA.id, teamAPlayers, passwordHash);
  await createPlayers(teamB.id, teamBPlayers, passwordHash);

  // Placeholder quest definitions.
  const quests = [];
  for (const q of QUESTS) {
    quests.push(await prisma.quest.create({ data: q }));
  }

  // Back-dated check-ins and quest logs for a few already-onboarded Team A
  // players. Different counts give the leaderboard a realistic spread.
  let totalCheckIns = 0;
  let totalQuestLogs = 0;
  const activity = [
    { email: "jordan.carter@example.com", checkIns: 12, quests: 13 },
    { email: "malik.johnson@example.com", checkIns: 9, quests: 8 },
    { email: "tyler.nguyen@example.com", checkIns: 7, quests: 4 },
  ];
  for (const a of activity) {
    totalCheckIns += await seedCheckIns(a.email, a.checkIns);
    totalQuestLogs += await seedQuestLogs(a.email, quests, a.quests);
  }
  // Live "today" activity so the coach dashboard shows real checked-in state.
  const today = await seedTodayActivity(quests);
  totalCheckIns += today.checkIns;
  totalQuestLogs += today.questLogs;

  const totalNotifications = await seedNotifications();
  const board = await seedTeamMessages();

  // Recompute each player's cached points total = sum of their ledger, so the
  // cache exactly matches the source of truth (check-ins + quests).
  const players = await prisma.user.findMany({
    where: { role: Role.PLAYER },
    select: { id: true, profile: { select: { id: true } } },
  });
  for (const p of players) {
    if (!p.profile) continue;
    const agg = await prisma.pointsLedger.aggregate({
      where: { userId: p.id },
      _sum: { amount: true },
    });
    await prisma.playerProfile.update({
      where: { userId: p.id },
      data: { points: agg._sum.amount ?? 0 },
    });
  }

  const [coachCount, playerCount, onboardedCount, questCount] = await Promise.all([
    prisma.user.count({ where: { role: Role.COACH } }),
    prisma.user.count({ where: { role: Role.PLAYER } }),
    prisma.playerProfile.count(),
    prisma.quest.count(),
  ]);
  const notOnboardedNames = [...teamAPlayers, ...teamBPlayers]
    .filter((p) => p.onboarded === false)
    .map((p) => p.name);

  console.log("Seed complete:");
  console.log("  Teams:   2 (Team A, Team B)");
  console.log(
    `  Users:   ${coachCount + playerCount} (${coachCount} coaches + ${playerCount} players)`,
  );
  console.log(
    `  Players onboarded: ${onboardedCount} · not yet onboarded: ${playerCount - onboardedCount} (${notOnboardedNames.join(", ")})`,
  );
  console.log(`  Quests:  ${questCount} placeholder daily quests`);
  console.log(
    `  Back-dated: ${totalCheckIns} check-ins + ${totalQuestLogs} quest logs across Jordan Carter, Malik Johnson, Tyler Nguyen`,
  );
  console.log(
    `  Notifications: ${totalNotifications} from Coach Marcus Bell to Team A (with a spread of reads)`,
  );
  console.log(
    `  Team board: ${board.messageCount} messages (${board.replyCount} replies) + ${board.reactionCount} reactions on Team A`,
  );
  const samplePlayers = await prisma.user.findMany({
    where: { role: Role.PLAYER, username: { not: null } },
    select: { username: true },
    orderBy: { id: "asc" },
    take: 3,
  });
  const sampleUsernames = samplePlayers
    .map((p) => p.username)
    .filter(Boolean)
    .join(", ");

  console.log("");
  console.log(`  Login (dev): password "${DEV_PASSWORD}" for everyone.`);
  console.log("    Coach — by email, e.g. coach.a@example.com  (Coach Marcus Bell, Team A)");
  console.log(`    Player — by username, e.g. ${sampleUsernames}`);
  console.log("");
  console.log(
    'Run `npm run dev`. Log in as a coach, or use the bottom-left "Dev: switch',
  );
  console.log(
    'user" menu to impersonate any seeded coach/player (dev-only, real session).',
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
