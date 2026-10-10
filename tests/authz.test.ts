import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  can,
  requireCan,
  MATRIX,
  type Action,
  type AuthzCtx,
} from "../lib/authz";

// EVERY CELL of the HIERARCHY_PLAN.md §2.10 matrix is exercised here, spelled
// out row by row (not derived from MATRIX itself — the whole point is that an
// accidental edit to the map fails a test that encodes the plan independently).
//
// Person-first plan Phase 2 (owner, 2026-10-09): four new actions; HEAD_COACH
// no longer changes member roles (only an organization promotes) and may
// invite staff; GROUP_ADMIN (one branch) and the CEO rows.

const ALL_ACTIONS: Action[] = [
  "view_roster", "view_player_detail", "adjust_points", "end_membership",
  "change_member_role", "team_settings", "manage_join_code", "post_notification",
  "send_timeout", "view_takeaways", "post_special_message", "moderate_board",
  "view_emergency_contact", "view_full_contact", "edit_contact", "create_team",
  "create_season", "manage_quests", "export_org_data", "view_org",
  "manage_structure", "invite_staff", "send_announcement",
];

// The plan's matrix, transcribed as the set of GRANTED actions per role.
const EXPECTED: Record<string, Set<Action>> = {
  ORG_ADMIN: new Set(ALL_ACTIONS),
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
  PLAYER: new Set<Action>(["view_roster"]),
};

// GROUP_ADMIN: the org-admin row minus contact, seasons, quests and export —
// inside their branch only (checked separately below).
const GROUP_ADMIN_EXPECTED = new Set<Action>(
  ALL_ACTIONS.filter((a) => !["view_full_contact", "edit_contact", "create_season", "manage_quests", "export_org_data"].includes(a)),
);

const ORG = 1;
const OTHER_ORG = 2;
const TEAM = 10;
const OTHER_TEAM_SAME_ORG = 11;

function memberCtx(role: Role): AuthzCtx {
  return {
    orgAdminOf: [],
    memberships: [{ teamId: TEAM, role, team: { organizationId: ORG } }],
  };
}

const orgAdminCtx: AuthzCtx = { orgAdminOf: [ORG], memberships: [] };
const target = { organizationId: ORG, teamId: TEAM };

describe("permission matrix — every cell", () => {
  for (const [roleName, granted] of Object.entries(EXPECTED)) {
    const ctx =
      roleName === "ORG_ADMIN" ? orgAdminCtx : memberCtx(roleName as Role);
    for (const action of ALL_ACTIONS) {
      const expected = granted.has(action);
      it(`${roleName} ${expected ? "CAN" : "CANNOT"} ${action}`, () => {
        expect(can(ctx, action, target)).toBe(expected);
      });
    }
  }

  it("the in-code MATRIX matches the plan transcription exactly", () => {
    for (const [role, granted] of Object.entries({ ...EXPECTED, GROUP_ADMIN: GROUP_ADMIN_EXPECTED })) {
      expect([...(MATRIX[role as Role] ?? new Set())].sort()).toEqual(
        [...granted].sort(),
      );
    }
  });
});

describe("org bound comes FIRST — cross-org access fails before role logic", () => {
  // Even the most powerful role, asking for the most harmless action, in an
  // org it has no tie to → false. If role logic ran first, these would pass.
  it("ORG_ADMIN of org 1 gets NOTHING in org 2", () => {
    for (const action of ALL_ACTIONS) {
      expect(can(orgAdminCtx, action, { organizationId: OTHER_ORG, teamId: TEAM })).toBe(false);
    }
  });

  it("HEAD_COACH membership in org 1 grants nothing in org 2 — even against their own teamId", () => {
    const ctx = memberCtx(Role.HEAD_COACH);
    for (const action of ALL_ACTIONS) {
      expect(can(ctx, action, { organizationId: OTHER_ORG, teamId: TEAM })).toBe(false);
    }
  });

  it("a membership never leaks across teams: HEAD_COACH of team 10 is not staff of team 11", () => {
    const ctx = memberCtx(Role.HEAD_COACH);
    expect(can(ctx, "adjust_points", { organizationId: ORG, teamId: OTHER_TEAM_SAME_ORG })).toBe(false);
    // ...but an ORG_ADMIN grant does span the org's teams:
    expect(can(orgAdminCtx, "adjust_points", { organizationId: ORG, teamId: OTHER_TEAM_SAME_ORG })).toBe(true);
  });

  it("team-scoped actions with no teamId in the target deny for membership-only actors", () => {
    const ctx = memberCtx(Role.HEAD_COACH);
    expect(can(ctx, "adjust_points", { organizationId: ORG })).toBe(false);
  });

  it("a membership whose team has no organizationId (pre-backfill data) matches no org", () => {
    const ctx: AuthzCtx = {
      orgAdminOf: [],
      memberships: [{ teamId: TEAM, role: Role.HEAD_COACH, team: { organizationId: null } }],
    };
    expect(can(ctx, "view_roster", target)).toBe(false);
  });
});

describe("structural absences", () => {
  it("an unknown role and ORG_ADMIN-as-membership-role resolve to zero permissions", () => {
    // Neither should ever appear on a Membership row (the retired "COACH"
    // value is gone from the database; ORG_ADMIN is app-forbidden as a
    // membership role — only a RoleAssignment grants the org-admin row) — but
    // if bad data shows up, it must fail closed, not open.
    for (const role of ["COACH" as unknown as Role, Role.ORG_ADMIN]) {
      const ctx = memberCtx(role);
      for (const action of ALL_ACTIONS) expect(can(ctx, action, target)).toBe(false);
    }
  });

  it("there is no journal/review action to grant", () => {
    // The Action union is closed; this documents that no member of it touches
    // reflections. (The real guarantee is the reflections module boundary +
    // the build-time grep.)
    for (const action of ALL_ACTIONS) {
      expect(action.includes("journal")).toBe(false);
      expect(action.includes("review")).toBe(false);
    }
  });

  it("GROUP_ADMIN-as-membership-role resolves to zero permissions too", () => {
    for (const action of ALL_ACTIONS) expect(can(memberCtx(Role.GROUP_ADMIN), action, target)).toBe(false);
  });

  it("requireCan throws on deny and passes on allow", () => {
    expect(() => requireCan(orgAdminCtx, "manage_quests", { organizationId: OTHER_ORG })).toThrow();
    expect(() => requireCan(orgAdminCtx, "manage_quests", { organizationId: ORG })).not.toThrow();
  });
});

describe("GROUP_ADMIN — an org admin for one branch", () => {
  // Branch: group 5 (Girls) → 6 (15U). Elsewhere: group 7 (Boys).
  const ctx: AuthzCtx = { orgAdminOf: [], groupAdminOf: [{ organizationId: ORG, groupId: 5 }], memberships: [] };
  const inside = { organizationId: ORG, groupPath: [5, 6] };
  const outside = { organizationId: ORG, groupPath: [7] };

  it("the group-admin row applies on targets inside the branch", () => {
    for (const action of ALL_ACTIONS) {
      expect(can(ctx, action, inside), action).toBe(GROUP_ADMIN_EXPECTED.has(action));
    }
  });

  it("nothing outside the branch; nothing in another org", () => {
    for (const action of ALL_ACTIONS) {
      expect(can(ctx, action, outside), action).toBe(false);
      expect(can(ctx, action, { ...inside, organizationId: OTHER_ORG }), action).toBe(false);
    }
  });

  it("opening the Organization View needs no path (it then shows their part); nothing else does", () => {
    expect(can(ctx, "view_org", { organizationId: ORG })).toBe(true);
    expect(can(ctx, "manage_structure", { organizationId: ORG })).toBe(false);
    expect(can(ctx, "view_org", { organizationId: OTHER_ORG })).toBe(false);
  });
});

describe("the CEO — above every organization, for CEO actions only", () => {
  const ceo: AuthzCtx = { orgAdminOf: [], memberships: [], platformRole: "CEO" };

  it("views and shapes any organization", () => {
    for (const org of [ORG, OTHER_ORG, 999]) {
      for (const action of ["view_org", "manage_structure", "create_team", "invite_staff", "change_member_role", "send_announcement"] as Action[]) {
        expect(can(ceo, action, { organizationId: org }), `${action} @${org}`).toBe(true);
      }
    }
  });

  it("nothing else without their own tie to the org — no points, takeaways, contacts or exports", () => {
    for (const action of ["adjust_points", "view_takeaways", "view_full_contact", "view_emergency_contact", "export_org_data", "end_membership"] as Action[]) {
      expect(can(ceo, action, target), action).toBe(false);
    }
  });

  it("the CEO action list is exactly this (test-locked)", async () => {
    const { CEO_ACTIONS } = await import("../lib/authz");
    expect([...CEO_ACTIONS].sort()).toEqual(["change_member_role", "create_team", "invite_staff", "manage_structure", "send_announcement", "view_org"]);
  });
});
