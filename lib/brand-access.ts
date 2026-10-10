import type { Team } from "@prisma/client";
import type { Ctx } from "./context";
import { can } from "./authz";
import { prisma } from "./prisma";

// WHO MAY SEE A PERSON'S BRAND PAGE / PHOTO — org-bounded matrix checks
// against the teams the person is actively on:
//
//   "self"      the person themselves — full page + edit
//   "staff"     view_player_detail on one of the target's teams (HEAD_COACH /
//               ASSISTANT_COACH / GENERAL_MANAGER there, or an ORG_ADMIN of
//               that org) — full read-only view
//   "teammate"  view_roster on one of the target's teams (a PLAYER membership
//               there) — CARD INFO ONLY: no Dream, no per-game stats
//   null        everyone else — including ALL of other organizations, always,
//               and anyone looking at a person with no team (their card is
//               their own)
//
// An organization's admins (org or group) are known to everyone in it: their
// card info shows to its teams and admins even when they hold no roster spot
// (they post to team boards, and their avatar must load there).

export type BrandAccess = "self" | "staff" | "teammate" | null;

export type BrandTarget = NonNullable<
  Awaited<ReturnType<typeof loadBrandTarget>>
>;

function loadBrandTarget(targetUserId: number) {
  return prisma.user.findUnique({
    where: { id: targetUserId },
    include: {
      profile: {
        include: {
          // ACTIVE = not ended, in the org's current season (as lib/context).
          memberships: {
            where: { endedAt: null, season: { isCurrent: true } },
            include: { team: { include: { organization: true } } },
            orderBy: [{ startedAt: "desc" }, { id: "desc" }],
          },
          roleAssignments: {
            where: { role: { in: ["ORG_ADMIN", "GROUP_ADMIN"] }, revokedAt: null },
            select: { organizationId: true },
          },
          platformGrants: { where: { revokedAt: null }, select: { id: true } },
        },
      },
    },
  });
}

/** Does this person play — on a team, or on their own? Someone who is only
 * staff, an admin or the CEO has no player card. */
export function isAthlete(target: BrandTarget): boolean {
  const p = target.profile;
  if (!p) return false;
  if (p.memberships.some((m) => m.role === "PLAYER")) return true;
  return p.memberships.length === 0 && p.roleAssignments.length === 0 && p.platformGrants.length === 0;
}

// `team`: the team the page shows the person on — the viewer's own acting
// team for themselves, otherwise the team the access came through (the
// viewer's acting team first). Null for a person with no team.
export async function resolveBrandAccess(
  ctx: Ctx,
  targetUserId: number,
): Promise<{ target: BrandTarget; access: BrandAccess; team: Team | null } | null> {
  const target = await loadBrandTarget(targetUserId);
  if (!target?.profile) return null;

  if (ctx.user.id === target.id) return { target, access: "self", team: ctx.membership?.team ?? null };

  const actingTeamId = ctx.membership?.teamId;
  const places = target.profile.memberships
    .filter((m) => m.team.organizationId != null)
    .sort((a, b) => Number(b.teamId === actingTeamId) - Number(a.teamId === actingTeamId))
    .map((m) => ({ team: m.team, scope: { organizationId: m.team.organizationId!, teamId: m.teamId } }));
  const asStaff = places.find((p) => can(ctx, "view_player_detail", p.scope));
  if (asStaff) return { target, access: "staff", team: asStaff.team };
  const asTeammate = places.find((p) => can(ctx, "view_roster", p.scope));
  if (asTeammate) return { target, access: "teammate", team: asTeammate.team };

  const viewerOrgIds = new Set([
    ...ctx.memberships.map((m) => m.team.organizationId),
    ...ctx.orgAdminOf,
    ...ctx.groupAdminOf.map((g) => g.organizationId),
  ]);
  if (target.profile.roleAssignments.some((r) => viewerOrgIds.has(r.organizationId))) {
    return { target, access: "teammate", team: null };
  }
  return { target, access: null, team: null };
}
