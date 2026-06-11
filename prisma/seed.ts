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

const prisma = new PrismaClient();

// Mirrors lib/points.ts; duplicated here so the seed stays standalone.
const POINTS_PER_CHECKIN = 10;

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
  // Defaults to true. When false, the player is created without a profile so
  // they must complete onboarding in the app.
  onboarded?: boolean;
};

const teamAPlayers: PlayerSeed[] = [
  { name: "Jordan Carter", email: "jordan.carter@example.com", dream: "Play Division I basketball and earn a full scholarship.", heightInches: 70, position: "Point Guard", jerseyNumber: 3, ppg: 14.2, rpg: 3.1, apg: 5.4, favoritePlayer: "Stephen Curry", favoriteTeam: "Golden State Warriors" },
  { name: "Malik Johnson", email: "malik.johnson@example.com", dream: "Earn a spot in my varsity team's starting five this season.", heightInches: 74, position: "Forward", jerseyNumber: 21, ppg: 11.5, rpg: 7.8, apg: 1.9, favoritePlayer: "LeBron James", favoriteTeam: "Los Angeles Lakers" },
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

async function createPlayers(teamId: number, players: PlayerSeed[]) {
  for (const p of players) {
    const onboarded = p.onboarded !== false; // default true
    await prisma.user.create({
      data: {
        name: p.name,
        email: p.email,
        role: Role.PLAYER,
        teamId,
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
  await prisma.questLog.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.playerProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.quest.deleteMany();
  await prisma.team.deleteMany();

  const teamA = await prisma.team.create({ data: { name: "Team A" } });
  const teamB = await prisma.team.create({ data: { name: "Team B" } });

  await prisma.user.create({
    data: { name: "Coach Marcus Bell", email: "coach.a@example.com", role: Role.COACH, teamId: teamA.id },
  });
  await prisma.user.create({
    data: { name: "Coach Tasha Reed", email: "coach.b@example.com", role: Role.COACH, teamId: teamB.id },
  });

  await createPlayers(teamA.id, teamAPlayers);
  await createPlayers(teamB.id, teamBPlayers);

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
  console.log("");
  console.log(
    'Run `npm run dev`, then use the bottom-left "Dev: switch user" menu. Switch to',
  );
  console.log(
    "Jordan Carter for a populated journal/points/quests, or visit /leaderboard.",
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
