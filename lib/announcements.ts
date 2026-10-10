import type { Announcement, AnnouncementAudience, Prisma } from "@prisma/client";
import { can } from "./authz";
import type { Ctx } from "./context";
import { descendantsOf, groupLabel, loadOrgGroups, pathOf, type GroupRow } from "./groups";
import { personaOf } from "./persona";
import { mediaStore } from "./mediaStore";
import { prisma } from "./prisma";

// ANNOUNCEMENTS (person-first plan Phase 5, owner 2026-10-09).
//
// WHO SENDS: the CEO to everyone (PLATFORM) or any org / group / team; an
// organization (org admins) to its whole org, a group or a team; a group
// admin within their branch. Coaches keep their team alerts.
//
// WHO SEES: worked out when read, from the person's CURRENT place — so
// someone who joins a team later still sees what's running there:
//   PLATFORM  everyone with an account (players, staff, solo athletes)
//   ORG       anyone on a team in the org, plus its org / group admins
//   GROUP     anyone on a team inside the group, plus admins above it
//   TEAM      anyone on the team, plus admins above it
// then narrowed by audience: players, staff (coaches + admins), or both.
// Items published before someone joined don't count toward their unread
// number, or toward "Seen by X of Y".

type ViewerTeam = { teamId: number; orgId: number; path: number[]; player: boolean; since: Date };

export type Viewer = {
  profileId: number;
  since: Date; // when the account began (PLATFORM)
  solo: boolean; // Personal Player Development
  ceo: boolean;
  teams: ViewerTeam[];
  orgAdminOf: number[];
  groupAdminOf: { orgId: number; path: number[] }[];
};

export async function viewerOf(ctx: Ctx): Promise<Viewer> {
  const orgIds = [
    ...new Set([
      ...ctx.memberships.map((m) => m.team.organizationId).filter((x): x is number => x != null),
      ...ctx.groupAdminOf.map((g) => g.organizationId),
    ]),
  ];
  const groups = new Map<number, GroupRow[]>(await Promise.all(orgIds.map(async (id) => [id, await loadOrgGroups(id)] as const)));
  return {
    profileId: ctx.profile.id,
    since: ctx.profile.createdAt,
    solo: personaOf(ctx) === "personal",
    ceo: ctx.platformRole === "CEO",
    teams: ctx.memberships
      .filter((m) => m.team.organizationId != null)
      .map((m) => ({
        teamId: m.teamId,
        orgId: m.team.organizationId!,
        path: pathOf(groups.get(m.team.organizationId!) ?? [], m.team.groupId),
        player: m.role === "PLAYER",
        since: m.startedAt,
      })),
    orgAdminOf: ctx.orgAdminOf,
    groupAdminOf: ctx.groupAdminOf.map((g) => ({ orgId: g.organizationId, path: pathOf(groups.get(g.organizationId) ?? [], g.groupId) })),
  };
}

type Scoped = Pick<Announcement, "scope" | "organizationId" | "groupId" | "teamId"> & { targetPath?: number[] };

/** The viewer's roles inside an announcement's scope, and since when. */
export function rolesIn(v: Viewer, a: Scoped): { player: boolean; staff: boolean; since: Date | null } {
  if (a.scope === "PLATFORM") {
    const staff = v.ceo || v.orgAdminOf.length > 0 || v.groupAdminOf.length > 0 || v.teams.some((t) => !t.player);
    return { player: v.solo || v.teams.some((t) => t.player), staff, since: v.since };
  }
  const org = a.organizationId;
  // The place the announcement is for, as a group path (an org: [], a team or group: its path).
  const target = a.targetPath ?? [];
  const teams = v.teams.filter((t) =>
    t.orgId === org && (a.scope === "ORG" || (a.scope === "TEAM" ? t.teamId === a.teamId : t.path.includes(a.groupId!))),
  );
  // Admins over the place: the org's admins; for the whole org every group
  // admin in it, otherwise group admins whose group is on the place's path.
  const admin =
    (org != null && v.orgAdminOf.includes(org)) ||
    v.groupAdminOf.some((g) => g.orgId === org && (a.scope === "ORG" || target.includes(g.path.at(-1)!)));
  const since = teams.length ? new Date(Math.min(...teams.map((t) => t.since.getTime()))) : admin ? v.since : null;
  return { player: teams.some((t) => t.player), staff: admin || teams.some((t) => !t.player), since };
}

export function audienceIncludes(audience: AnnouncementAudience, roles: { player: boolean; staff: boolean }): boolean {
  if (audience === "PLAYERS") return roles.player;
  if (audience === "STAFF") return roles.staff;
  return roles.player || roles.staff;
}

const live = (now: Date): Prisma.AnnouncementWhereInput => ({
  deletedAt: null,
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

export type InboxItem = Announcement & {
  media: { id: string; width: number | null; height: number | null }[];
  read: boolean;
  countsUnread: boolean;
  org: { name: string; color: string | null; logoUrl: string | null } | null;
  place: string | null; // who it went to: the org, group or team's name; null = everyone
  authorName: string;
};

/** Everything this person should see now, newest first. */
export async function inboxFor(ctx: Ctx, take = 30): Promise<InboxItem[]> {
  const v = await viewerOf(ctx);
  const now = new Date();
  const orgIds = [...new Set([...v.teams.map((t) => t.orgId), ...v.orgAdminOf, ...v.groupAdminOf.map((g) => g.orgId)])];
  const candidates = await prisma.announcement.findMany({
    where: { ...live(now), AND: [{ OR: [{ scope: "PLATFORM" }, { organizationId: { in: orgIds } }] }] },
    orderBy: { publishedAt: "desc" },
    take: 100,
    include: {
      media: { where: { deletedAt: null }, select: { id: true, width: true, height: true }, orderBy: { createdAt: "asc" } },
      reads: { where: { profileId: v.profileId }, select: { id: true } },
    },
  });
  const places = await placesOf(candidates);
  const visible = candidates
    .map((a) => ({ a, roles: rolesIn(v, { ...a, targetPath: places.get(a.id)?.path }) }))
    .filter(({ a, roles }) => audienceIncludes(a.audience, roles))
    .slice(0, take);

  const [orgs, authors] = await Promise.all([
    orgLooks(visible.map(({ a }) => a.organizationId).filter((x): x is number => x != null)),
    prisma.profile.findMany({ where: { id: { in: visible.map(({ a }) => a.authorProfileId) } }, select: { id: true, name: true } }),
  ]);
  const authorName = new Map(authors.map((p) => [p.id, p.name]));
  return visible.map(({ a, roles }) => {
    const { reads, ...rest } = a;
    const read = reads.length > 0;
    return {
      ...rest,
      read,
      countsUnread: !read && a.authorProfileId !== v.profileId && (roles.since == null || a.publishedAt >= roles.since),
      org: a.organizationId != null ? (orgs.get(a.organizationId) ?? null) : null,
      place: a.scope === "PLATFORM" ? null : a.scope === "ORG" ? (orgs.get(a.organizationId!)?.name ?? "") : (places.get(a.id)?.name ?? ""),
      authorName: authorName.get(a.authorProfileId) ?? "",
    };
  });
}

/** The unread number on ☰. Runs on every page, so it first asks the cheap
 * question — anything live, unread and possibly for me? — and only works
 * out exactly who each one is for when there is. */
export async function unreadAnnouncements(ctx: Ctx): Promise<number> {
  const orgIds = [
    ...new Set([
      ...ctx.memberships.map((m) => m.team.organizationId).filter((x): x is number => x != null),
      ...ctx.orgAdminOf,
      ...ctx.groupAdminOf.map((g) => g.organizationId),
    ]),
  ];
  const maybe = await prisma.announcement.count({
    where: {
      ...live(new Date()),
      authorProfileId: { not: ctx.profile.id },
      reads: { none: { profileId: ctx.profile.id } },
      AND: [{ OR: [{ scope: "PLATFORM" }, { organizationId: { in: orgIds } }] }],
    },
  });
  if (maybe === 0) return 0;
  return (await inboxFor(ctx, 100)).filter((a) => a.countsUnread).length;
}

/** Each GROUP / TEAM announcement's place: its group path (a team's: the
 * team's group) and its name ("Girls · 15U", "17U Boys Black"). */
async function placesOf(items: Pick<Announcement, "id" | "scope" | "organizationId" | "groupId" | "teamId">[]) {
  const orgIds = [...new Set(items.filter((a) => a.scope === "TEAM" || a.scope === "GROUP").map((a) => a.organizationId!))];
  const [groupsByOrg, teams] = await Promise.all([
    Promise.all(orgIds.map(async (id) => [id, await loadOrgGroups(id)] as const)).then((e) => new Map(e)),
    prisma.team.findMany({
      where: { id: { in: items.map((a) => a.teamId).filter((x): x is number => x != null) } },
      select: { id: true, name: true, groupId: true },
    }),
  ]);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const out = new Map<number, { path: number[]; name: string }>();
  for (const a of items) {
    const groups = groupsByOrg.get(a.organizationId ?? -1) ?? [];
    if (a.scope === "GROUP" && a.groupId != null) out.set(a.id, { path: pathOf(groups, a.groupId), name: groupLabel(groups, a.groupId) });
    if (a.scope === "TEAM") {
      const team = teamById.get(a.teamId!);
      out.set(a.id, { path: pathOf(groups, team?.groupId ?? null), name: team?.name ?? "" });
    }
  }
  return out;
}

/** An org's look on its announcements: its name, and its teams' color + logo
 * (an org has no brand of its own yet — the first team that set one). */
export async function orgLooks(orgIds: number[]) {
  const orgs = await prisma.organization.findMany({
    where: { id: { in: [...new Set(orgIds)] } },
    select: { id: true, name: true, teams: { select: { primaryColor: true, logoUrl: true }, orderBy: { id: "asc" } } },
  });
  return new Map(
    orgs.map((o) => [
      o.id,
      {
        name: o.name,
        color: o.teams.find((t) => t.primaryColor)?.primaryColor ?? null,
        logoUrl: o.teams.find((t) => t.logoUrl)?.logoUrl ?? null,
      },
    ]),
  );
}

/** May this person see this announcement (its pictures, its read button)?
 * Only while it's live: someone it's for, its sender, or someone who could
 * have sent it there (the sent list). Once it has disappeared, nobody —
 * its pictures stop being served at once, before the cleanup deletes them. */
export async function canSeeAnnouncement(ctx: Ctx, a: Announcement): Promise<boolean> {
  if (a.deletedAt) return false;
  if (a.expiresAt && a.expiresAt <= new Date()) return false;
  if (a.authorProfileId === ctx.profile.id) return true;
  if (await maySend(ctx, targetOf(a))) return true;
  const v = await viewerOf(ctx);
  const places = await placesOf([a]);
  return audienceIncludes(a.audience, rolesIn(v, { ...a, targetPath: places.get(a.id)?.path }));
}

export async function markRead(ctx: Ctx, announcementId: number): Promise<boolean> {
  const a = await prisma.announcement.findUnique({ where: { id: announcementId } });
  if (!a || !(await canSeeAnnouncement(ctx, a))) return false;
  await prisma.announcementRead.upsert({
    where: { announcementId_profileId: { announcementId, profileId: ctx.profile.id } },
    create: { announcementId, profileId: ctx.profile.id },
    update: {},
  });
  return true;
}

// ---- Sending ------------------------------------------------------------

export type SendTarget =
  | { scope: "PLATFORM" }
  | { scope: "ORG"; organizationId: number }
  | { scope: "GROUP"; organizationId: number; groupId: number }
  | { scope: "TEAM"; organizationId: number; teamId: number };

/** May this person send to this place? The CEO anywhere; an org within
 * itself; a group admin within their branch (lib/authz send_announcement). */
export async function maySend(ctx: Ctx, target: SendTarget): Promise<boolean> {
  const ceo = ctx.platformRole === "CEO";
  if (target.scope === "PLATFORM") return ceo;
  // The place must really be in that organization — for the CEO too.
  const orgId = target.organizationId;
  if (target.scope === "ORG") {
    if (ceo) return (await prisma.organization.count({ where: { id: orgId } })) === 1;
    return can(ctx, "send_announcement", { organizationId: orgId });
  }
  const groups = await loadOrgGroups(orgId);
  if (target.scope === "GROUP") {
    if (!groups.some((g) => g.id === target.groupId)) return false;
    return ceo || can(ctx, "send_announcement", { organizationId: orgId, groupPath: pathOf(groups, target.groupId) });
  }
  const team = await prisma.team.findUnique({ where: { id: target.teamId }, select: { organizationId: true, groupId: true } });
  if (!team || team.organizationId !== orgId) return false;
  return ceo || can(ctx, "send_announcement", { organizationId: orgId, teamId: target.teamId, groupPath: pathOf(groups, team.groupId) });
}

export function targetOf(a: Pick<Announcement, "scope" | "organizationId" | "groupId" | "teamId">): SendTarget {
  if (a.scope === "PLATFORM") return { scope: "PLATFORM" };
  if (a.scope === "ORG") return { scope: "ORG", organizationId: a.organizationId! };
  if (a.scope === "GROUP") return { scope: "GROUP", organizationId: a.organizationId!, groupId: a.groupId! };
  return { scope: "TEAM", organizationId: a.organizationId!, teamId: a.teamId! };
}

/** May this person delete it? Its sender; the CEO; or someone who could
 * have sent it there — but an organization never deletes the CEO's. */
export async function mayDelete(ctx: Ctx, a: Pick<Announcement, "authorProfileId" | "authorRole" | "scope" | "organizationId" | "groupId" | "teamId">) {
  if (a.authorProfileId === ctx.profile.id || ctx.platformRole === "CEO") return true;
  return a.authorRole !== "CEO" && (await maySend(ctx, targetOf(a)));
}

/** Can this person send announcements anywhere? (The menu items, uploads.) */
export function mayAnnounce(ctx: Pick<Ctx, "platformRole" | "orgAdminOf" | "groupAdminOf">): boolean {
  return ctx.platformRole === "CEO" || ctx.orgAdminOf.length > 0 || ctx.groupAdminOf.length > 0;
}

export function authorRoleFor(ctx: Ctx, target: SendTarget): string {
  if (ctx.platformRole === "CEO" && (target.scope === "PLATFORM" || !ctx.orgAdminOf.includes(target.organizationId))) return "CEO";
  if (target.scope !== "PLATFORM" && ctx.orgAdminOf.includes(target.organizationId)) return "ORG_ADMIN";
  return "GROUP_ADMIN";
}

// Video and other links: only these sites, shown as a link — never embedded.
const LINK_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "vimeo.com", "www.vimeo.com", "hudl.com", "www.hudl.com"];
export function cleanLink(raw: unknown): { ok: true; url: string | null } | { ok: false } {
  const value = String(raw ?? "").trim();
  if (!value) return { ok: true, url: null };
  try {
    const u = new URL(value);
    return u.protocol === "https:" && LINK_HOSTS.includes(u.hostname) ? { ok: true, url: u.toString() } : { ok: false };
  } catch {
    return { ok: false };
  }
}

// ---- Seen by X of Y (for senders) -----------------------------------------

/** How many of the people this announcement is for have opened it — counting
 * only people who were in its place when it went out (not the sender). */
export async function seenBy(
  a: Pick<Announcement, "id" | "scope" | "organizationId" | "groupId" | "teamId" | "audience" | "publishedAt" | "authorProfileId">,
) {
  const before = { lte: a.publishedAt };
  const roleWhere = a.audience === "PLAYERS" ? { role: "PLAYER" as const } : a.audience === "STAFF" ? { role: { not: "PLAYER" as const } } : {};
  let teamFilter: Prisma.TeamWhereInput = {};
  let targetPath: number[] = [];
  if (a.scope === "ORG") teamFilter = { organizationId: a.organizationId };
  if (a.scope === "TEAM") {
    teamFilter = { id: a.teamId! };
    const [groups, team] = await Promise.all([
      loadOrgGroups(a.organizationId!),
      prisma.team.findUnique({ where: { id: a.teamId! }, select: { groupId: true } }),
    ]);
    targetPath = pathOf(groups, team?.groupId ?? null);
  }
  if (a.scope === "GROUP") {
    const groups = await loadOrgGroups(a.organizationId!);
    teamFilter = { organizationId: a.organizationId, groupId: { in: [a.groupId!, ...descendantsOf(groups, a.groupId!)] } };
    targetPath = pathOf(groups, a.groupId);
  }
  const members = await prisma.membership.findMany({
    where: { endedAt: null, season: { isCurrent: true }, startedAt: before, team: teamFilter, ...roleWhere },
    select: { profileId: true },
  });
  const people = new Set(members.map((m) => m.profileId));
  if (a.audience !== "PLAYERS") {
    // The same admins rolesIn() lets see it.
    const over: Prisma.RoleAssignmentWhereInput =
      a.scope === "PLATFORM"
        ? {}
        : a.scope === "ORG"
          ? { organizationId: a.organizationId! }
          : { organizationId: a.organizationId!, OR: [{ role: "ORG_ADMIN" }, { role: "GROUP_ADMIN", groupId: { in: targetPath } }] };
    const admins = await prisma.roleAssignment.findMany({
      where: { revokedAt: null, role: { in: ["ORG_ADMIN", "GROUP_ADMIN"] }, profile: { createdAt: before }, ...over },
      select: { profileId: true },
    });
    for (const r of admins) people.add(r.profileId);
  }
  if (a.scope === "PLATFORM" && a.audience !== "STAFF") {
    // Solo athletes: set up, no team.
    const solo = await prisma.profile.findMany({
      where: { userId: { not: null }, setupCompletedAt: { not: null }, createdAt: before, memberships: { none: { endedAt: null } }, roleAssignments: { none: { revokedAt: null } }, platformGrants: { none: {} } },
      select: { id: true },
    });
    for (const p of solo) people.add(p.id);
  }
  people.delete(a.authorProfileId);
  const reads = await prisma.announcementRead.findMany({ where: { announcementId: a.id }, select: { profileId: true } });
  const seen = reads.filter((r) => people.has(r.profileId)).length;
  return { seen, of: people.size };
}

// ---- Disappearing ---------------------------------------------------------

export { BODY_MAX, MAX_PICTURES, TITLE_MAX } from "./announcement-limits";

export const EXPIRY_CHOICES = { "24h": 24 * 3600_000, "7d": 7 * 24 * 3600_000, keep: null } as const;
export type ExpiryChoice = keyof typeof EXPIRY_CHOICES;

/** Delete the stored pictures of announcements that have disappeared or
 * been deleted, and uploads never sent within a day. A storage failure
 * leaves the row for the next run, so nothing lingers silently. */
export async function expireMedia(now = new Date()) {
  const store = mediaStore();
  if (!store) return { removed: 0 };
  const due = await prisma.mediaAsset.findMany({
    where: {
      deletedAt: null,
      OR: [
        { announcementId: null, createdAt: { lt: new Date(now.getTime() - 24 * 3600_000) } },
        { announcement: { OR: [{ deletedAt: { not: null } }, { expiresAt: { lte: now } }] } },
      ],
    },
    select: { id: true, storageKey: true },
    take: 500,
  });
  if (due.length === 0) return { removed: 0 };
  await store.remove(due.map((m) => m.storageKey));
  await prisma.mediaAsset.updateMany({ where: { id: { in: due.map((m) => m.id) } }, data: { deletedAt: now } });
  return { removed: due.length };
}
