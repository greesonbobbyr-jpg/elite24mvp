import type { Announcement } from "@prisma/client";
import type { Place } from "@/app/components/AnnouncementComposer";
import type { AnnouncementView } from "@/app/components/AnnouncementCard";
import { mayDelete, maySend, orgLooks, seenBy, targetOf } from "./announcements";
import { announcementView } from "./announcement-view";
import type { Ctx } from "./context";
import { bySortOrder, descendantsOf, groupLabel, loadOrgGroups } from "./groups";
import { prisma } from "./prisma";

// The senders' side of announcements: where this person may send (the
// composer's choices), and what's been sent with "Seen by X of Y".

/** The places this person may send to — every org's for the CEO (orgId
 * null, plus Everyone), or one org's. Group admins get their branch only. */
export async function sendPlaces(ctx: Ctx, orgId: number | null): Promise<Place[]> {
  const ceo = ctx.platformRole === "CEO";
  const orgs = await prisma.organization.findMany({
    where: orgId == null ? (ceo ? {} : { id: -1 }) : { id: orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, teams: { select: { id: true, name: true, groupId: true }, orderBy: { name: "asc" } } },
  });
  const places: Place[] = orgId == null && ceo ? [{ value: "PLATFORM", label: "Everyone", name: "Everyone", scope: "PLATFORM", orgId: null }] : [];
  for (const org of orgs) {
    const prefix = orgId == null ? `${org.name} · ` : "";
    const groups = (await loadOrgGroups(org.id)).sort(bySortOrder);
    const wholeOrg = ceo || ctx.orgAdminOf.includes(org.id);
    // A group admin's branch: their groups and everything under them.
    const branch = wholeOrg
      ? null
      : new Set(
          ctx.groupAdminOf
            .filter((g) => g.organizationId === org.id)
            .flatMap((g) => [g.groupId, ...descendantsOf(groups, g.groupId)]),
        );
    if (wholeOrg) places.push({ value: `ORG:${org.id}`, label: org.name, name: org.name, scope: "ORG", orgId: org.id });
    const groupPlaces = groups
      .filter((g) => branch == null || branch.has(g.id))
      .map((g) => ({ g, label: groupLabel(groups, g.id) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    for (const { g, label } of groupPlaces) {
      places.push({ value: `GROUP:${org.id}:${g.id}`, label: `${prefix}${label}`, name: label, scope: "GROUP", orgId: org.id });
    }
    for (const t of org.teams) {
      if (branch != null && (t.groupId == null || !branch.has(t.groupId))) continue;
      places.push({ value: `TEAM:${org.id}:${t.id}`, label: `${prefix}${t.name}`, name: t.name, scope: "TEAM", orgId: org.id });
    }
  }
  return places;
}

export async function orgLookRecord(orgIds: number[]) {
  return Object.fromEntries(await orgLooks(orgIds));
}

export type SentItem = { view: AnnouncementView; seen: number; of: number; status: "live" | "gone"; canDelete: boolean };

/** What's been sent — from CEO View (orgId null: the CEO's own) or to one
 * organization — newest first, with how many of the people it's for saw it. */
export async function sentList(ctx: Ctx, orgId: number | null): Promise<SentItem[]> {
  const rows = await prisma.announcement.findMany({
    where: { deletedAt: null, ...(orgId == null ? { authorRole: "CEO" } : { organizationId: orgId }) },
    orderBy: { publishedAt: "desc" },
    take: 25,
    include: { media: { where: { deletedAt: null }, select: { id: true, width: true, height: true }, orderBy: { createdAt: "asc" } } },
  });
  const mine = (
    await Promise.all(rows.map(async (a) => ((await maySend(ctx, targetOf(a))) || a.authorProfileId === ctx.profile.id ? a : null)))
  ).filter((a): a is (typeof rows)[number] => a != null);

  const [orgs, authors, places] = await Promise.all([
    orgLooks(mine.map((a) => a.organizationId).filter((x): x is number => x != null)),
    prisma.profile.findMany({ where: { id: { in: mine.map((a) => a.authorProfileId) } }, select: { id: true, name: true } }),
    placeNames(mine),
  ]);
  const authorName = new Map(authors.map((p) => [p.id, p.name]));
  const now = new Date();
  return Promise.all(
    mine.map(async (a) => {
      const org = a.organizationId != null ? (orgs.get(a.organizationId) ?? null) : null;
      const { seen, of } = await seenBy(a);
      const gone = a.expiresAt != null && a.expiresAt <= now;
      return {
        view: announcementView(
          // A disappeared announcement's pictures are no longer shown to anyone.
          { ...a, media: gone ? [] : a.media, org, place: a.scope === "ORG" ? (org?.name ?? null) : (places.get(a.id) ?? null), authorName: authorName.get(a.authorProfileId) ?? "" },
          false,
          now,
        ),
        seen,
        of,
        status: gone ? ("gone" as const) : ("live" as const),
        canDelete: await mayDelete(ctx, a),
      };
    }),
  );
}

async function placeNames(items: Pick<Announcement, "id" | "scope" | "organizationId" | "groupId" | "teamId">[]) {
  const out = new Map<number, string>();
  const teams = await prisma.team.findMany({
    where: { id: { in: items.map((a) => a.teamId).filter((x): x is number => x != null) } },
    select: { id: true, name: true },
  });
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const groupsByOrg = new Map<number, Awaited<ReturnType<typeof loadOrgGroups>>>();
  for (const a of items) {
    if (a.scope === "TEAM") out.set(a.id, teamName.get(a.teamId!) ?? "");
    if (a.scope === "GROUP" && a.organizationId != null && a.groupId != null) {
      if (!groupsByOrg.has(a.organizationId)) groupsByOrg.set(a.organizationId, await loadOrgGroups(a.organizationId));
      out.set(a.id, groupLabel(groupsByOrg.get(a.organizationId)!, a.groupId));
    }
  }
  return out;
}
