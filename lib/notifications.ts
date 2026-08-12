import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { roleLabel } from "./format";

// Team notifications (hierarchy rebuild Stage 4c):
// - AUTHORS display from the permanent Profile + the ROLE SNAPSHOT taken at
//   write time ("Coach Gary · Head Coach") — a later promotion/demotion never
//   rewrites history. Legacy author fields fill for anything unstamped.
// - READ RECEIPTS count against the team's ACTIVE membership roster (current
//   season, not ended) — an ended membership neither inflates nor deflates
//   "Read by X of Y". Legacy user-roster fallback until Stage 6.
// - TIME OUT is scoped by the CALLER to the acting membership's team (see the
//   (main) layout) — a two-team athlete only ever gets their acting team's
//   takeover.

type AuthorFields = {
  author: { name: string };
  authorProfile: { name: string } | null;
  authorRole: Role | null;
};

const AUTHOR_INCLUDE = {
  author: { select: { name: true } },
  authorProfile: { select: { name: true } },
} as const;

// "Coach Gary" + "Head Coach" — snapshot first, legacy fallback.
export function authorDisplay(n: AuthorFields): {
  authorName: string;
  authorRoleLabel: string | null;
} {
  return {
    authorName: n.authorProfile?.name ?? n.author.name,
    authorRoleLabel: roleLabel(n.authorRole ?? "COACH"),
  };
}

// All notifications posted to a team, newest first, with display authors.
// Always called with the current user's own teamId (team-private, section 3.2).
export async function listTeamNotifications(teamId: number) {
  const items = await prisma.notification.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    take: 50, // newest 50 — the history list is not an archive
    include: AUTHOR_INCLUDE,
  });
  return items.map((n) => ({ ...n, ...authorDisplay(n) }));
}

// The oldest TIME OUT for this team that the player has NOT acknowledged, or
// null. The caller passes the ACTING membership's team — never any other.
export async function getActiveTimeout(userId: number, teamId: number) {
  const n = await prisma.notification.findFirst({
    where: { teamId, isTimeout: true, reads: { none: { userId } } },
    orderBy: { createdAt: "asc" },
    include: AUTHOR_INCLUDE,
  });
  return n ? { ...n, ...authorDisplay(n) } : null;
}

// Staff read-status: each team notification plus who has confirmed reading it.
// Y = the team's ACTIVE PLAYER memberships in the current season. Read
// matching prefers the profile stamp and falls back to the legacy user id.
export async function getTeamReadStatus(teamId: number) {
  const [notifications, memberships] = await Promise.all([
    prisma.notification.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      take: 30, // newest 30 — receipts on older posts stop mattering
      include: {
        ...AUTHOR_INCLUDE,
        reads: { select: { userId: true, profileId: true } },
      },
    }),
    prisma.membership.findMany({
      where: { teamId, role: "PLAYER", endedAt: null, season: { isCurrent: true } },
      select: { profile: { select: { id: true, userId: true, name: true } } },
      orderBy: { profile: { name: "asc" } },
    }),
  ]);

  // Roster = active memberships; legacy user roster only if the team has no
  // memberships yet (pre-backfill data — dies at Stage 6).
  let roster: { profileId: number | null; userId: number | null; name: string }[] =
    memberships.map((m) => ({
      profileId: m.profile.id,
      userId: m.profile.userId,
      name: m.profile.name,
    }));
  if (roster.length === 0) {
    const players = await prisma.user.findMany({
      where: { teamId, role: "PLAYER" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    roster = players.map((p) => ({ profileId: null, userId: p.id, name: p.name }));
  }

  return notifications.map((n) => {
    const readProfileIds = new Set(
      n.reads.map((r) => r.profileId).filter((id): id is number => id != null),
    );
    const readUserIds = new Set(n.reads.map((r) => r.userId));
    const hasRead = (member: (typeof roster)[number]) =>
      (member.profileId != null && readProfileIds.has(member.profileId)) ||
      (member.userId != null && readUserIds.has(member.userId));

    const read = roster.filter(hasRead).map((m) => m.name);
    const notYet = roster.filter((m) => !hasRead(m)).map((m) => m.name);
    return {
      id: n.id,
      title: n.title,
      body: n.body,
      isTimeout: n.isTimeout,
      ...authorDisplay(n),
      createdAt: n.createdAt,
      readCount: read.length,
      totalPlayers: roster.length,
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

// Count of the team's notifications the player hasn't confirmed (home badge).
// The caller passes the acting membership's team.
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
