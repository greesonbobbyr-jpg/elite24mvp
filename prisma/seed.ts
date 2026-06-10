/**
 * Elite24MVP — database seed.
 *
 * Creates two teams of fake users so the owner can test multi-user UX with the
 * dev user switcher (CLAUDE.md section 7):
 *   - Team A: 1 coach + 8 players
 *   - Team B: 1 coach + 3 players (proves the multi-team data model works)
 *
 * Most players are fully onboarded. Two Team A players (Andre Washington and
 * Brandon Lee) are left NOT onboarded — they have no PlayerProfile yet — so the
 * forced onboarding flow can be tested end to end.
 *
 * Safe to re-run: it wipes and recreates the seeded data each time.
 * Run with: npm run seed   (or it runs automatically on `prisma migrate reset`)
 */
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

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
  points: number;
  // Defaults to true. When false, the player is created without a profile so
  // they must complete onboarding in the app.
  onboarded?: boolean;
};

const teamAPlayers: PlayerSeed[] = [
  { name: "Jordan Carter", email: "jordan.carter@example.com", dream: "Play Division I basketball and earn a full scholarship.", heightInches: 70, position: "Point Guard", jerseyNumber: 3, ppg: 14.2, rpg: 3.1, apg: 5.4, favoritePlayer: "Stephen Curry", favoriteTeam: "Golden State Warriors", points: 320 },
  { name: "Malik Johnson", email: "malik.johnson@example.com", dream: "Earn a spot in my varsity team's starting five this season.", heightInches: 74, position: "Forward", jerseyNumber: 21, ppg: 11.5, rpg: 7.8, apg: 1.9, favoritePlayer: "LeBron James", favoriteTeam: "Los Angeles Lakers", points: 280 },
  { name: "Tyler Nguyen", email: "tyler.nguyen@example.com", dream: "Become the best on-ball defender on my team.", heightInches: 71, position: "Shooting Guard", jerseyNumber: 5, ppg: 8.3, rpg: 2.4, apg: 4.1, favoritePlayer: "Jrue Holiday", favoriteTeam: "Boston Celtics", points: 245 },
  { name: "Andre Washington", email: "andre.washington@example.com", dream: "Dunk in a real game by the end of the year.", heightInches: 76, position: "Center", jerseyNumber: 34, ppg: 9.9, rpg: 9.2, apg: 1.2, favoritePlayer: "Giannis Antetokounmpo", favoriteTeam: "Milwaukee Bucks", points: 300, onboarded: false },
  { name: "Diego Ramirez", email: "diego.ramirez@example.com", dream: "Lead my team in assists and run the offense.", heightInches: 69, position: "Point Guard", jerseyNumber: 11, ppg: 7.1, rpg: 2.0, apg: 6.0, favoritePlayer: "Chris Paul", favoriteTeam: "Phoenix Suns", points: 210 },
  { name: "Chris Thompson", email: "chris.thompson@example.com", dream: "Raise my free-throw percentage above 85%.", heightInches: 72, position: "Guard/Forward", jerseyNumber: 8, ppg: 10.0, rpg: 4.5, apg: 2.8, favoritePlayer: "Devin Booker", favoriteTeam: "Phoenix Suns", points: 260 },
  { name: "Sam Okafor", email: "sam.okafor@example.com", dream: "Get recruited to play college basketball.", heightInches: 78, position: "Center", jerseyNumber: 50, ppg: 12.4, rpg: 10.1, apg: 0.9, favoritePlayer: "Joel Embiid", favoriteTeam: "Philadelphia 76ers", points: 290 },
  { name: "Brandon Lee", email: "brandon.lee@example.com", dream: "Be a leader my teammates can always count on.", heightInches: 73, position: "Forward", jerseyNumber: 14, ppg: 9.2, rpg: 6.0, apg: 3.3, favoritePlayer: "Jayson Tatum", favoriteTeam: "Boston Celtics", points: 230, onboarded: false },
];

const teamBPlayers: PlayerSeed[] = [
  { name: "Marcus Green", email: "marcus.green@example.com", dream: "Make the all-conference team this year.", heightInches: 72, position: "Point Guard", jerseyNumber: 7, ppg: 13.0, rpg: 3.5, apg: 4.8, favoritePlayer: "Ja Morant", favoriteTeam: "Memphis Grizzlies", points: 270 },
  { name: "Isaiah Brooks", email: "isaiah.brooks@example.com", dream: "Add a reliable three-point shot to my game.", heightInches: 70, position: "Shooting Guard", jerseyNumber: 9, ppg: 8.8, rpg: 2.6, apg: 3.2, favoritePlayer: "Damian Lillard", favoriteTeam: "Milwaukee Bucks", points: 200 },
  { name: "Noah Patel", email: "noah.patel@example.com", dream: "Start every game and stay healthy all season.", heightInches: 75, position: "Forward", jerseyNumber: 23, ppg: 10.5, rpg: 7.0, apg: 2.1, favoritePlayer: "Kevin Durant", favoriteTeam: "Phoenix Suns", points: 240 },
];

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
        // onboarding in the app (CLAUDE.md section 2).
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
                  points: p.points,
                  onboardedAt: new Date(),
                },
              },
            }
          : {}),
      },
    });
  }
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
  await prisma.playerProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();

  const teamA = await prisma.team.create({ data: { name: "Team A" } });
  const teamB = await prisma.team.create({ data: { name: "Team B" } });

  await prisma.user.create({
    data: {
      name: "Coach Marcus Bell",
      email: "coach.a@example.com",
      role: Role.COACH,
      teamId: teamA.id,
    },
  });
  await prisma.user.create({
    data: {
      name: "Coach Tasha Reed",
      email: "coach.b@example.com",
      role: Role.COACH,
      teamId: teamB.id,
    },
  });

  await createPlayers(teamA.id, teamAPlayers);
  await createPlayers(teamB.id, teamBPlayers);

  const [coachCount, playerCount, onboardedCount] = await Promise.all([
    prisma.user.count({ where: { role: Role.COACH } }),
    prisma.user.count({ where: { role: Role.PLAYER } }),
    prisma.playerProfile.count(),
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
  console.log("");
  console.log(
    'Run `npm run dev`, then use the bottom-left "Dev: switch user" menu. Switch to a',
  );
  console.log(
    "not-onboarded player to test the forced onboarding flow.",
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
