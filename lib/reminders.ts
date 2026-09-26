import { prisma } from "./prisma";
import { checkInTimesForUsers } from "./data/reflections";

// Who gets a team's daily check-in reminder today: players on the team's
// ACTIVE roster (current season, membership not ended) who opted in to push
// and haven't checked in yet. A removed player stops getting pinged (their
// legacy User.teamId still points at the team), and a two-team athlete is
// reached through each team. A team with no memberships at all falls back to
// the legacy user roster (pre-backfill — dies at Stage 6).
export async function reminderRecipientIds(teamId: number, today: string): Promise<number[]> {
  const migrated = (await prisma.membership.count({ where: { teamId } })) > 0;
  const onRoster = migrated
    ? {
        profileRecord: {
          memberships: {
            some: {
              teamId,
              role: "PLAYER" as const,
              endedAt: null,
              season: { isCurrent: true },
            },
          },
        },
      }
    : { teamId };
  const optedIn = await prisma.user.findMany({
    where: { ...onRoster, role: "PLAYER", pushSubscriptions: { some: {} } },
    select: { id: true },
  });
  const ids = optedIn.map((p) => p.id);
  // Content-free check-in status, through the reflections boundary.
  const checkedIn = new Set((await checkInTimesForUsers(ids, today)).map((e) => e.userId));
  return ids.filter((id) => !checkedIn.has(id));
}
