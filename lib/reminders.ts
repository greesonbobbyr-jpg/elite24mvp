import { prisma } from "./prisma";
import { checkInTimesForUsers } from "./data/reflections";

// Who gets a team's daily check-in reminder today: players on the team's
// ACTIVE roster (current season, membership not ended) who opted in to push
// and haven't checked in yet. A removed player stops getting pinged, and a
// two-team athlete is reached through each team.
export async function reminderRecipientIds(teamId: number, today: string): Promise<number[]> {
  const optedIn = await prisma.user.findMany({
    where: {
      pushSubscriptions: { some: {} },
      profile: {
        memberships: {
          some: { teamId, role: "PLAYER", endedAt: null, season: { isCurrent: true } },
        },
      },
    },
    select: { id: true },
  });
  const ids = optedIn.map((p) => p.id);
  // Content-free check-in status, through the reflections boundary.
  const checkedIn = new Set((await checkInTimesForUsers(ids, today)).map((e) => e.userId));
  return ids.filter((id) => !checkedIn.has(id));
}
