import { prisma } from "./prisma";

// All notifications posted to a team, newest first, with the author's name.
// Always called with the current user's own teamId (team-private, section 3.2).
export function listTeamNotifications(teamId: number) {
  return prisma.notification.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });
}

// Coach read-status: each team notification plus the player names who have
// confirmed reading it and those who have not yet (Y = the team's player roster).
export async function getTeamReadStatus(teamId: number) {
  const [notifications, players] = await Promise.all([
    prisma.notification.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { name: true } },
        reads: { select: { userId: true } },
      },
    }),
    prisma.user.findMany({
      where: { teamId, role: "PLAYER" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return notifications.map((n) => {
    const readIds = new Set(n.reads.map((r) => r.userId));
    const read = players.filter((p) => readIds.has(p.id)).map((p) => p.name);
    const notYet = players.filter((p) => !readIds.has(p.id)).map((p) => p.name);
    return {
      id: n.id,
      title: n.title,
      body: n.body,
      authorName: n.author.name,
      createdAt: n.createdAt,
      readCount: read.length,
      totalPlayers: players.length,
      read,
      notYet,
    };
  });
}

// The set of notification ids a player has already confirmed reading.
export async function getReadNotificationIds(
  userId: number,
): Promise<Set<number>> {
  const reads = await prisma.notificationRead.findMany({
    where: { userId },
    select: { notificationId: true },
  });
  return new Set(reads.map((r) => r.notificationId));
}

// Count of the player's team notifications they haven't confirmed (home badge).
export async function countUnreadForPlayer(
  userId: number,
  teamId: number,
): Promise<number> {
  const [total, read] = await Promise.all([
    prisma.notification.count({ where: { teamId } }),
    prisma.notificationRead.count({
      where: { userId, notification: { teamId } },
    }),
  ]);
  return Math.max(0, total - read);
}
