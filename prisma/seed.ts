/**
 * Elite24MVP — database seed (live-demo build).
 *
 * Two BRANDED teams so every screen looks alive and the team-color system is
 * obvious (CLAUDE.md section 7):
 *   - Mustang Broncos: 1 coach (Gary) + 8 players — real red branding + logo.
 *   - OKC Thunder: 1 coach (Riley) + 4 players — blue/orange, initials-chip logo.
 *
 * Players log in by USERNAME (first name), coaches by EMAIL; one shared demo
 * password. Fixed, sayable join codes (MUSTNG / THUNDR) for the join-flow demo.
 *
 * Two Mustang players (Andre Washington, Brandon Lee) are left NOT onboarded so
 * the forced onboarding flow can be demoed. Onboarded players on both teams get
 * back-dated check-ins + quest completions (with matching points-ledger rows), so
 * journals, points history, and leaderboards look real and totals match the ledger.
 *
 * Safe to re-run: it wipes and recreates the seeded data each time. Portable
 * across SQLite (dev) and the upcoming Postgres — no file:-URL / SQLite tricks.
 * Run with: npm run seed   (or it runs automatically on `prisma migrate reset`)
 */
import {
  PrismaClient,
  Role,
  PointsSource,
  MessageType,
  ReactionType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { todayKey as tzDayKey } from "../lib/daykey";

const prisma = new PrismaClient();

// Mirrors lib/points.ts; duplicated here so the seed stays standalone.
const POINTS_PER_CHECKIN = 10;

// Shared demo password for every seeded user. Never hardcoded: pass
// SEED_PASSWORD to choose one, else a fresh random one is generated and printed
// ONCE in the summary.
const DEV_PASSWORD =
  process.env.SEED_PASSWORD || `e24-${randomBytes(4).toString("hex")}`;

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
  { name: "Jordan Carter", email: "jordan.carter@example.com", dream: "Play Division I basketball and earn a full scholarship.", heightInches: 70, position: "Point Guard", jerseyNumber: 24, ppg: 14.2, rpg: 3.1, apg: 5.4, favoritePlayer: "Stephen Curry", favoriteTeam: "Golden State Warriors", highlightUrl: "https://www.youtube.com/watch?v=3qH2bQF4yGo" },
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
  { name: "Tyrese Walker", email: "tyrese.walker@example.com", dream: "Make varsity and lock down the other team's best scorer.", heightInches: 73, position: "Shooting Guard", jerseyNumber: 4, ppg: 9.4, rpg: 3.0, apg: 2.7, favoritePlayer: "Shai Gilgeous-Alexander", favoriteTeam: "Oklahoma City Thunder" },
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

// Timezone-aware day keys (same helper the app uses), so seeded entries land on
// the same calendar days the app will compute at read time.
function dayKeyOf(date: Date): string {
  return tzDayKey(date);
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

// Notifications with a spread of reads so the coach's "Read by X of Y" view looks
// real. `readers` lists the player emails who confirmed reading each. One set per
// team (Mustang rich, OKC light).
type SeedNotification = {
  title: string;
  body: string;
  daysAgo: number;
  isTimeout: boolean;
  readers: string[];
};

const MUSTANG_NOTIFICATIONS: SeedNotification[] = [
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

// OKC Thunder — a light touch so the alerts screen also renders in blue/orange.
const OKC_NOTIFICATIONS: SeedNotification[] = [
  {
    title: "Team lift Wednesday 4 PM",
    body: "Thunder — team lift moves to Wednesday at 4:00 PM. Bring your logbook and be ready to work.",
    daysAgo: 2,
    isTimeout: false,
    readers: ["marcus.green@example.com", "isaiah.brooks@example.com"],
  },
];

async function seedNotifications(
  coachEmail: string,
  notifications: SeedNotification[],
) {
  const coach = await prisma.user.findUnique({ where: { email: coachEmail } });
  if (!coach) return 0;

  for (const n of notifications) {
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
  return notifications.length;
}

// Demo board messages, back-dated so the order looks real. `key` marks a message
// that gets replied to; `replyToKey` makes an entry a Messenger-style reply to
// that earlier message (→ replyToId). Ordered oldest-first so a reply follows its
// parent. One set per team.
type SeedReaction = { email: string; type: ReactionType };
type SeedMessage = {
  email: string;
  type: MessageType;
  hoursAgo: number;
  body: string;
  key?: string;
  replyToKey?: string;
  reactions: SeedReaction[];
};

const TEAM_A_MESSAGES: SeedMessage[] = [
  {
    email: "gary@elite24.demo", type: "REGULAR", hoursAgo: 46,
    body: "Great energy at practice today 🔥 Same time tomorrow — be early.",
    reactions: [{ email: "jordan.carter@example.com", type: "THUMBS_UP" }, { email: "tyler.nguyen@example.com", type: "PRAY" }],
  },
  {
    key: "goat",
    email: "gary@elite24.demo", type: "DISCUSSION", hoursAgo: 40,
    body: "Discussion of the Day: Who's the GOAT — Jordan or LeBron? 🐐 Drop your take.",
    reactions: [{ email: "jordan.carter@example.com", type: "THUMBS_UP" }, { email: "malik.johnson@example.com", type: "LAUGH" }, { email: "tyler.nguyen@example.com", type: "HEART" }, { email: "diego.ramirez@example.com", type: "WOW" }],
  },
  {
    replyToKey: "goat",
    email: "jordan.carter@example.com", type: "REGULAR", hoursAgo: 39.9,
    body: "MJ all day. 6-0 in the Finals, never lost. 🐐",
    reactions: [{ email: "gary@elite24.demo", type: "THUMBS_UP" }],
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
    email: "gary@elite24.demo", type: "CHALLENGE", hoursAgo: 30,
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
    reactions: [{ email: "gary@elite24.demo", type: "PRAY" }, { email: "jordan.carter@example.com", type: "WOW" }],
  },
  {
    key: "spotlight",
    email: "gary@elite24.demo", type: "SPOTLIGHT", hoursAgo: 20,
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
    reactions: [{ email: "tyler.nguyen@example.com", type: "LAUGH" }, { email: "gary@elite24.demo", type: "PRAY" }],
  },
];

// OKC Thunder board — a few messages so the board renders in blue/orange too.
const TEAM_B_MESSAGES: SeedMessage[] = [
  {
    email: "riley@elite24.demo", type: "REGULAR", hoursAgo: 30,
    body: "Welcome to the Thunder 💙⚡ Let's build something special this year.",
    reactions: [{ email: "marcus.green@example.com", type: "THUMBS_UP" }, { email: "isaiah.brooks@example.com", type: "PRAY" }],
  },
  {
    key: "okc-challenge",
    email: "riley@elite24.demo", type: "CHALLENGE", hoursAgo: 22,
    body: "Challenge of the Week: 3 workouts logged by Friday. ⚡ Who's in?",
    reactions: [{ email: "marcus.green@example.com", type: "HEART" }, { email: "noah.patel@example.com", type: "THUMBS_UP" }, { email: "tyrese.walker@example.com", type: "PRAY" }],
  },
  {
    replyToKey: "okc-challenge",
    email: "marcus.green@example.com", type: "REGULAR", hoursAgo: 20,
    body: "On it, Coach. 2 down already 💪",
    reactions: [{ email: "riley@elite24.demo", type: "THUMBS_UP" }],
  },
  {
    email: "isaiah.brooks@example.com", type: "REGULAR", hoursAgo: 5,
    body: "Let's go Thunder ⚡🧡",
    reactions: [{ email: "riley@elite24.demo", type: "PRAY" }],
  },
];

function hoursAgo(n: number): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() - n);
  return d;
}

async function seedTeamMessages(messages: SeedMessage[]) {
  let messageCount = 0;
  let reactionCount = 0;
  let replyCount = 0;
  const keyToId = new Map<string, number>();
  for (const m of messages) {
    const author = await prisma.user.findUnique({ where: { email: m.email } });
    if (!author) continue;

    const replyToId = m.replyToKey ? keyToId.get(m.replyToKey) ?? null : null;

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
    if (m.replyToKey) replyCount++;
    if (m.key) keyToId.set(m.key, created.id);

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
  for (const email of [
    "jordan.carter@example.com",
    "tyler.nguyen@example.com",
    "marcus.green@example.com",
  ]) {
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
  // Safety (CLAUDE.md section 7): seeding WIPES the target database, and local
  // dev may point at the live Supabase DB. NODE_ENV alone can't catch that (a
  // local run against prod is NODE_ENV=development), so an explicit confirmation
  // naming the exact DB host is required. No confirmation → no wipe, ever.
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

  // Team 1 — Mustang Broncos: real red branding + logo (public/mustang-logo.png).
  const teamA = await prisma.team.create({
    data: {
      name: "Mustang Broncos",
      joinCode: "MUSTNG",
      logoUrl: "/mustang-logo.png",
      primaryColor: "#c8102e",
      secondaryColor: "#ffffff",
    },
  });
  // Team 2 — OKC Thunder: blue/orange, no logo file (team-initial "OT" chip).
  const teamB = await prisma.team.create({
    data: {
      name: "OKC Thunder",
      joinCode: "THUNDR",
      primaryColor: "#007ac1",
      secondaryColor: "#ef3b24",
    },
  });

  // One shared bcrypt hash for the dev password across all seeded users.
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  await prisma.user.create({
    data: { name: "Coach Gary", email: "gary@elite24.demo", role: Role.COACH, teamId: teamA.id, passwordHash },
  });
  await prisma.user.create({
    data: { name: "Coach Riley", email: "riley@elite24.demo", role: Role.COACH, teamId: teamB.id, passwordHash },
  });

  await createPlayers(teamA.id, teamAPlayers, passwordHash);
  await createPlayers(teamB.id, teamBPlayers, passwordHash);

  // Placeholder quest definitions.
  const quests = [];
  for (const q of QUESTS) {
    quests.push(await prisma.quest.create({ data: q }));
  }

  // Back-dated check-ins and quest logs for onboarded players on BOTH teams.
  // Different counts give each team's leaderboard a realistic spread.
  let totalCheckIns = 0;
  let totalQuestLogs = 0;
  const activity = [
    // Mustang Broncos
    { email: "jordan.carter@example.com", checkIns: 12, quests: 13 },
    { email: "malik.johnson@example.com", checkIns: 9, quests: 8 },
    { email: "tyler.nguyen@example.com", checkIns: 7, quests: 4 },
    // OKC Thunder
    { email: "marcus.green@example.com", checkIns: 8, quests: 6 },
    { email: "isaiah.brooks@example.com", checkIns: 5, quests: 4 },
    { email: "noah.patel@example.com", checkIns: 3, quests: 2 },
    { email: "tyrese.walker@example.com", checkIns: 2, quests: 1 },
  ];
  for (const a of activity) {
    totalCheckIns += await seedCheckIns(a.email, a.checkIns);
    totalQuestLogs += await seedQuestLogs(a.email, quests, a.quests);
  }
  // Live "today" activity so the coach dashboard shows real checked-in state.
  const today = await seedTodayActivity(quests);
  totalCheckIns += today.checkIns;
  totalQuestLogs += today.questLogs;

  const totalNotifications =
    (await seedNotifications("gary@elite24.demo", MUSTANG_NOTIFICATIONS)) +
    (await seedNotifications("riley@elite24.demo", OKC_NOTIFICATIONS));
  const boardA = await seedTeamMessages(TEAM_A_MESSAGES);
  const boardB = await seedTeamMessages(TEAM_B_MESSAGES);
  const board = {
    messageCount: boardA.messageCount + boardB.messageCount,
    replyCount: boardA.replyCount + boardB.replyCount,
    reactionCount: boardA.reactionCount + boardB.reactionCount,
  };

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
  // Per-team credential summary, built from the DB so it's always accurate.
  const teams = await prisma.team.findMany({
    orderBy: { id: "asc" },
    select: {
      name: true,
      joinCode: true,
      users: {
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: {
          role: true,
          email: true,
          username: true,
          profile: { select: { id: true } },
        },
      },
    },
  });

  console.log("Seed complete:");
  console.log(
    `  ${teams.length} teams · ${coachCount} coaches + ${playerCount} players · ${onboardedCount} onboarded · ${questCount} quests`,
  );
  console.log(
    `  Back-dated: ${totalCheckIns} check-ins + ${totalQuestLogs} quest logs · ${totalNotifications} notifications · ${board.messageCount} board messages`,
  );
  console.log("");
  console.log(`=== DEMO LOGINS · password: "${DEV_PASSWORD}" ===`);
  for (const t of teams) {
    const coach = t.users.find((u) => u.role === Role.COACH);
    const playersOfTeam = t.users.filter((u) => u.role === Role.PLAYER);
    const onboarded = playersOfTeam
      .filter((p) => p.profile)
      .map((p) => p.username)
      .filter(Boolean);
    const pending = playersOfTeam
      .filter((p) => !p.profile)
      .map((p) => p.username)
      .filter(Boolean);
    console.log("");
    console.log(`${t.name.toUpperCase()}   (join code ${t.joinCode})`);
    console.log(`  Coach:   ${coach?.email ?? "—"}  (email login)`);
    console.log(`  Players: ${onboarded.join(", ")}   (username login)`);
    if (pending.length) {
      console.log(
        `  Onboarding demo (log in → onboarding flow): ${pending.join(", ")}`,
      );
    }
  }
  console.log("");
  console.log(
    'Run `npm run dev`. The dev switcher (bottom-left) also jumps between any seeded user.',
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
