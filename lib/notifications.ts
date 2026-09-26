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
// - A PLAYER'S alerts start when they joined the team (their membership's
//   start): a new player isn't handed every old TIME OUT or a pile of
//   "unread" history, and isn't counted "waiting" on alerts sent before they
//   joined.

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

// `since` = the player's acting membership start. Null (a legacy login with no
// membership yet) = no lower bound, as before.
function postedSince(since: Date | null) {
  return since ? { createdAt: { gte: since } } : {};
}

// A player's alert feed for their acting team: EVERY unread alert since they
// joined — so the unread badge can always be cleared (a newest-50 cap used to
// leave older unread alerts unreachable) — plus their most recent read ones.
export async function listPlayerNotifications(
  userId: number,
  teamId: number,
  since: Date | null,
) {
  const where = { teamId, ...postedSince(since) };
  const [unread, read] = await Promise.all([
    prisma.notification.findMany({
      where: { ...where, reads: { none: { userId } } },
      orderBy: { createdAt: "desc" },
      include: AUTHOR_INCLUDE,
    }),
    prisma.notification.findMany({
      where: { ...where, reads: { some: { userId } } },
      orderBy: { createdAt: "desc" },
      take: 30, // the "Earlier" list is recent history, not an archive
      include: AUTHOR_INCLUDE,
    }),
  ]);
  return {
    unread: unread.map((n) => ({ ...n, ...authorDisplay(n) })),
    read: read.map((n) => ({ ...n, ...authorDisplay(n) })),
  };
}

// The oldest TIME OUT for this team that the player has NOT acknowledged and
// that was sent since they joined, or null. The caller passes the ACTING
// membership's team — never any other.
export async function getActiveTimeout(
  userId: number,
  teamId: number,
  since: Date | null = null,
) {
  const n = await prisma.notification.findFirst({
    where: { teamId, isTimeout: true, ...postedSince(since), reads: { none: { userId } } },
    orderBy: { createdAt: "asc" },
    include: AUTHOR_INCLUDE,
  });
  return n ? { ...n, ...authorDisplay(n) } : null;
}

// Staff read-status: each team notification plus who has confirmed reading it.
// Y = the team's ACTIVE PLAYER memberships in the current season that had
// started when the notification was sent. Read matching prefers the profile
// stamp and falls back to the legacy user id.
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
      select: {
        startedAt: true,
        profile: { select: { id: true, userId: true, name: true } },
      },
      orderBy: { profile: { name: "asc" } },
    }),
  ]);

  // Roster = active memberships; legacy user roster only if the team has no
  // memberships yet (pre-backfill data — dies at Stage 6; no join date).
  type RosterMember = {
    profileId: number | null;
    userId: number | null;
    name: string;
    joinedAt: Date | null;
  };
  let roster: RosterMember[] = memberships.map((m) => ({
    profileId: m.profile.id,
    userId: m.profile.userId,
    name: m.profile.name,
    joinedAt: m.startedAt,
  }));
  if (roster.length === 0) {
    const players = await prisma.user.findMany({
      where: { teamId, role: "PLAYER" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    roster = players.map((p) => ({ profileId: null, userId: p.id, name: p.name, joinedAt: null }));
  }

  return notifications.map((n) => {
    const onTeamWhenSent = roster.filter((m) => m.joinedAt == null || m.joinedAt <= n.createdAt);
    const readProfileIds = new Set(
      n.reads.map((r) => r.profileId).filter((id): id is number => id != null),
    );
    const readUserIds = new Set(n.reads.map((r) => r.userId));
    const hasRead = (member: RosterMember) =>
      (member.profileId != null && readProfileIds.has(member.profileId)) ||
      (member.userId != null && readUserIds.has(member.userId));

    const read = onTeamWhenSent.filter(hasRead).map((m) => m.name);
    const notYet = onTeamWhenSent.filter((m) => !hasRead(m)).map((m) => m.name);
    return {
      id: n.id,
      title: n.title,
      body: n.body,
      isTimeout: n.isTimeout,
      ...authorDisplay(n),
      createdAt: n.createdAt,
      readCount: read.length,
      totalPlayers: onTeamWhenSent.length,
      read,
      notYet,
    };
  });
}

// Count of the player's unconfirmed alerts (menu badge) — the same set
// listPlayerNotifications shows as unread, so confirming them all reaches 0.
// The caller passes the acting membership's team and start.
export async function countUnreadForPlayer(
  userId: number,
  teamId: number,
  since: Date | null = null,
): Promise<number> {
  return prisma.notification.count({
    where: { teamId, ...postedSince(since), reads: { none: { userId } } },
  });
}
