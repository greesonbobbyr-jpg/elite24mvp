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
// - Membership.role is never ORG_ADMIN/GROUP_ADMIN (app-enforced invariant):
//   org authority comes ONLY from a RoleAssignment, which is what `orgAdminOf`
//   and `groupAdminOf` reflect.
//
// PERSON-FIRST PLAN, Phase 2 (owner, 2026-10-09):
// - GROUP_ADMIN: an org admin for ONE branch of the group tree (a Girls
//   Director, one school in a district). The org-admin row minus contact,
//   seasons, quests and export, and only on targets whose group path runs
//   through their group (Target.groupPath — callers derive it from the DB).
// - HEAD_COACH no longer changes member roles (only an organization promotes
//   a player to staff) and may invite staff to their own team.
// - The CEO (PlatformGrant) reaches every organization for CEO_ACTIONS only —
//   viewing and shaping structure, inviting staff, changing member roles.
//   Never journals: no action exists for that.

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
  | "export_org_data"
  | "view_org"
  | "manage_structure"
  | "invite_staff"
  | "send_announcement";

// Scope is ALWAYS org-bounded; teamId narrows to a team within that org;
// groupPath (top-level group → the target's own group) is what a GROUP_ADMIN
// grant is checked against — derive it from the DB, never from the client.
export type Target = {
  organizationId: number;
  teamId?: number;
  membershipId?: number;
  groupPath?: readonly number[];
};

// The minimum slice of Ctx that authorization needs — kept narrow so unit
// tests can build it in memory without a database.
export type AuthzCtx = {
  orgAdminOf: readonly number[];
  groupAdminOf?: readonly { organizationId: number; groupId: number }[];
  platformRole?: "CEO" | null;
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
  "create_season", "manage_quests", "export_org_data", "view_org",
  "manage_structure", "invite_staff", "send_announcement",
];

// What the CEO may do in ANY organization (on top of whatever their own
// memberships allow). Test-locked: nothing here reaches a player's words.
export const CEO_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  "view_org", "manage_structure", "create_team", "invite_staff", "change_member_role",
]);

const NOT_FOR_GROUP_ADMINS: readonly Action[] = [
  "view_full_contact", "edit_contact", "create_season", "manage_quests", "export_org_data",
];

// HIERARCHY_PLAN.md §2.10, row by row. `change_member_role`/`edit_contact` are
// admin-tier per the rulings (assistants explicitly may not manage the roster;
// GM's grant is end_membership only; org-level contact editing is ORG_ADMIN —
// a person's OWN contact is structural, see above).
export const MATRIX: Partial<Record<Role, ReadonlySet<Action>>> = {
  ORG_ADMIN: new Set<Action>(ALL_ACTIONS),
  GROUP_ADMIN: new Set<Action>(ALL_ACTIONS.filter((a) => !NOT_FOR_GROUP_ADMINS.includes(a))),
  HEAD_COACH: new Set<Action>([
    "view_roster", "view_player_detail", "adjust_points", "end_membership",
    "team_settings", "manage_join_code", "invite_staff",
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
  // 0. THE CEO — above every organization, for CEO_ACTIONS only. Anything
  //    else still needs the CEO's own tie to the org (steps 1–4).
  if (ctx.platformRole === "CEO" && CEO_ACTIONS.has(action)) return true;

  // 1. ORG BOUND FIRST, ALWAYS. If the actor has no tie to this organization —
  //    no unrevoked ORG_ADMIN / GROUP_ADMIN grant and no active membership on
  //    any of its teams — the answer is no before any role logic runs.
  //    Cross-org access is structurally impossible.
  const isOrgAdmin = ctx.orgAdminOf.includes(target.organizationId);
  const groupGrants = (ctx.groupAdminOf ?? []).filter((g) => g.organizationId === target.organizationId);
  const orgMemberships = ctx.memberships.filter(
    (m) => m.team.organizationId === target.organizationId,
  );
  if (!isOrgAdmin && groupGrants.length === 0 && orgMemberships.length === 0) return false;

  // 2. ORG_ADMIN grant at this org → the org-admin row applies org-wide.
  if (isOrgAdmin) return MATRIX.ORG_ADMIN!.has(action);

  // 3. GROUP_ADMIN grant → the group-admin row, on targets inside the branch
  //    (the target's group path runs through the granted group). Opening
  //    the Organization View itself needs no path: it then shows their part.
  if (groupGrants.length > 0) {
    if (action === "view_org" && target.teamId == null && target.groupPath == null) return true;
    const inBranch = groupGrants.some((g) => target.groupPath?.includes(g.groupId));
    if (inBranch && MATRIX.GROUP_ADMIN!.has(action)) return true;
  }

  // 4. Otherwise authority is team-scoped: an ACTIVE membership on the target
  //    team (which we already know sits inside the target org). ORG_ADMIN /
  //    GROUP_ADMIN must never resolve through this path — org authority comes
  //    ONLY from a RoleAssignment (steps 2–3). A membership row carrying one
  //    is invalid data and fails CLOSED, not open.
  if (target.teamId == null) return false;
  const membership = orgMemberships.find((m) => m.teamId === target.teamId);
  if (!membership || membership.role === "ORG_ADMIN" || membership.role === "GROUP_ADMIN") return false;
  return MATRIX[membership.role]?.has(action) ?? false;
}

export function requireCan(ctx: AuthzCtx, action: Action, target: Target): void {
  if (!can(ctx, action, target)) {
    throw new Error(`Forbidden: ${action}`);
  }
}
