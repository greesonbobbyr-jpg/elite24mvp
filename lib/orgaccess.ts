import { can } from "./authz";
import type { Ctx } from "./context";
import { pathOf, type GroupRow } from "./groups";

// WHO MAY OPEN AN ORGANIZATION VIEW, and how far they reach (person-first plan
// Phase 2, owner 2026-10-09):
//
//   org_admin    the whole organization
//   group_admin  only their branch(es) of the group tree — a Girls Director
//                sees and shapes the Girls side, nothing else
//   ceo          any organization (CEO View → Open Organization View); what
//                the CEO opens and changes is recorded in that org's Activity
//
// Every Organization View PAGE and ACTION resolves this itself from a fresh
// context — a layout's check never stops a page's reads (see lib/data/ceo).

export type OrgAccess = {
  orgId: number;
  profileId: number;
  via: "org_admin" | "group_admin" | "ceo";
  /** A group admin's granted groups (each with everything under it); null = the whole org. */
  branch: number[] | null;
};

type AccessCtx = Pick<Ctx, "orgAdminOf" | "groupAdminOf" | "platformRole" | "memberships"> & {
  profile: { id: number } | null;
};

export function orgAccessFor(ctx: AccessCtx | null, orgId: number): OrgAccess | null {
  if (!ctx?.profile || !Number.isInteger(orgId)) return null;
  const base = { orgId, profileId: ctx.profile.id };
  if (ctx.orgAdminOf.includes(orgId)) return { ...base, via: "org_admin", branch: null };
  const grants = ctx.groupAdminOf.filter((g) => g.organizationId === orgId);
  if (grants.length > 0) return { ...base, via: "group_admin", branch: grants.map((g) => g.groupId) };
  if (ctx.platformRole === "CEO") return { ...base, via: "ceo", branch: null };
  return null;
}

/** The organizations this person administers (the ☰ Organization View). */
export function adminOrgIds(ctx: Pick<Ctx, "orgAdminOf" | "groupAdminOf">): number[] {
  return [...new Set([...ctx.orgAdminOf, ...ctx.groupAdminOf.map((g) => g.organizationId)])];
}

/** May they change structure AT this place — inside group `groupId` (null =
 * the organization's top level)? Group admins: only inside their branch,
 * never their own group's place (that's the org's call). */
export function canShapeAt(
  ctx: AccessCtx,
  access: OrgAccess,
  groups: readonly GroupRow[],
  groupId: number | null,
): boolean {
  return can(
    { ...ctx, groupAdminOf: ctx.groupAdminOf ?? [] },
    "manage_structure",
    groupId == null
      ? { organizationId: access.orgId }
      : { organizationId: access.orgId, groupPath: pathOf(groups, groupId) },
  );
}
