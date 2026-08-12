import type { Role } from "@prisma/client";

// The ONE authorization helper. Nothing else in the app hand-rolls a role
// check (legacy `user.role === "COACH"` checks are retired surface-by-surface
// in Stage 4). The matrix below encodes HIERARCHY_PLAN.md §2.10 EXACTLY — if a
// product decision changes, change the plan doc first, then this map, then the
// tests that mirror it.
//
// DELIBERATE ABSENCES (not oversights):
// - There is NO action for reading someone else's journal or daily review —
//   "NOBODY. EVER." Those reads are structurally impossible: the only module
//   allowed to touch those tables is lib/data/reflections.ts, whose content
//   functions derive the author from the caller's ctx (no profile parameter).
// - PLAYER rows marked "own" in the plan (own takeaways, own contact) are also
//   structural: surfaces read them through the player's own ctx, so there is
//   nothing to grant here.
// - Membership.role is never ORG_ADMIN (app-enforced invariant): org authority
//   comes ONLY from a RoleAssignment, which is what `orgAdminOf` reflects.

export type Action =
  | "view_roster"
  | "view_player_detail"
  | "adjust_points"
  | "end_membership"
  | "change_member_role"
  | "team_settings"
  | "manage_join_code"
  | "post_notification"
  | "send_timeout"
  | "view_takeaways"
  | "post_special_message"
  | "moderate_board"
  | "view_emergency_contact"
  | "view_full_contact"
  | "edit_contact"
  | "create_team"
  | "create_season"
  | "manage_quests"
  | "export_org_data";

// Scope is ALWAYS org-bounded; teamId narrows to a team within that org.
export type Target = {
  organizationId: number;
  teamId?: number;
  membershipId?: number;
};

// The minimum slice of Ctx that authorization needs — kept narrow so unit
// tests can build it in memory without a database.
export type AuthzCtx = {
  orgAdminOf: readonly number[];
  memberships: readonly {
    teamId: number;
    role: Role;
    team: { organizationId: number | null };
  }[];
};

const ALL_ACTIONS: readonly Action[] = [
  "view_roster", "view_player_detail", "adjust_points", "end_membership",
  "change_member_role", "team_settings", "manage_join_code", "post_notification",
  "send_timeout", "view_takeaways", "post_special_message", "moderate_board",
  "view_emergency_contact", "view_full_contact", "edit_contact", "create_team",
  "create_season", "manage_quests", "export_org_data",
];

// HIERARCHY_PLAN.md §2.10, row by row. `change_member_role`/`edit_contact` are
// admin-tier per the rulings (assistants explicitly may not manage the roster;
// GM's grant is end_membership only; org-level contact editing is ORG_ADMIN —
// a person's OWN contact is structural, see above).
export const MATRIX: Partial<Record<Role, ReadonlySet<Action>>> = {
  ORG_ADMIN: new Set<Action>(ALL_ACTIONS),
  HEAD_COACH: new Set<Action>([
    "view_roster", "view_player_detail", "adjust_points", "end_membership",
    "change_member_role", "team_settings", "manage_join_code",
    "post_notification", "send_timeout", "view_takeaways",
    "post_special_message", "moderate_board", "view_emergency_contact",
  ]),
  ASSISTANT_COACH: new Set<Action>([
    "view_roster", "view_player_detail", "post_notification", "view_takeaways",
    "view_emergency_contact",
  ]),
  GENERAL_MANAGER: new Set<Action>([
    "view_roster", "view_player_detail", "end_membership", "post_notification",
    "view_emergency_contact",
  ]),
  PLAYER: new Set<Action>([
    // Teammates' CARD INFO only — the roster/leaderboard surface. The drill-in
    // (view_player_detail: status metadata, contact) is staff-only.
    "view_roster",
  ]),
  // Legacy COACH is deliberately absent: the backfill maps every COACH login to
  // a HEAD_COACH membership + ORG_ADMIN grant, and no new membership may carry
  // it. An unknown role resolves to "no permissions".
};

export function can(ctx: AuthzCtx, action: Action, target: Target): boolean {
  // 1. ORG BOUND FIRST, ALWAYS. If the actor has no tie to this organization —
  //    no unrevoked ORG_ADMIN grant and no active membership on any of its
  //    teams — the answer is no before any role logic runs. Cross-org access
  //    is structurally impossible.
  const isOrgAdmin = ctx.orgAdminOf.includes(target.organizationId);
  const orgMemberships = ctx.memberships.filter(
    (m) => m.team.organizationId === target.organizationId,
  );
  if (!isOrgAdmin && orgMemberships.length === 0) return false;

  // 2. ORG_ADMIN grant at this org → the org-admin row applies org-wide.
  if (isOrgAdmin) return MATRIX.ORG_ADMIN!.has(action);

  // 3. Otherwise authority is team-scoped: an ACTIVE membership on the target
  //    team (which we already know sits inside the target org). ORG_ADMIN must
  //    never resolve through this path — org authority comes ONLY from a
  //    RoleAssignment (step 2). A membership row carrying it is invalid data
  //    and fails CLOSED, not open.
  if (target.teamId == null) return false;
  const membership = orgMemberships.find((m) => m.teamId === target.teamId);
  if (!membership || membership.role === "ORG_ADMIN") return false;
  return MATRIX[membership.role]?.has(action) ?? false;
}

export function requireCan(ctx: AuthzCtx, action: Action, target: Target): void {
  if (!can(ctx, action, target)) {
    throw new Error(`Forbidden: ${action}`);
  }
}
