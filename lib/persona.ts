import type { Ctx } from "./context";

// What someone sees in the app right now, from their TEAM ROLES — the login
// itself carries no role. Everyone has one account (owner, 2026-10-09); a
// person can be a player on one team and staff on another, and an account can
// have no team at all. The acting membership (lib/context) decides.
//
//   athlete   acting membership is PLAYER
//   staff     acting membership is a coach / GM role
//   admin     org or group admin with no roster spot (org authority only)
//   ceo       the CEO, when not acting on a team — CEO View is home
//   personal  no team, set up — Personal Player Development: points, quests,
//             check-in, journal, Pro Review; no team surfaces
//   new       no team, not set up yet
export type Persona = "athlete" | "staff" | "admin" | "ceo" | "personal" | "new";

export type PersonaCtx = Pick<Ctx, "membership" | "orgAdminOf"> & {
  groupAdminOf?: Ctx["groupAdminOf"];
  profile: { setupCompletedAt: Date | null };
  platformRole?: Ctx["platformRole"];
};

export function personaOf(ctx: PersonaCtx): Persona {
  if (ctx.membership) return ctx.membership.role === "PLAYER" ? "athlete" : "staff";
  if (ctx.platformRole === "CEO") return "ceo";
  if (ctx.orgAdminOf.length > 0 || (ctx.groupAdminOf?.length ?? 0) > 0) return "admin";
  return ctx.profile.setupCompletedAt ? "personal" : "new";
}

/** Coach-side screens: a team's staff, or an org admin. */
export function isStaffSide(persona: Persona): boolean {
  return persona === "staff" || persona === "admin";
}

/** The player loop (check-in, quests, journal, review): on a team or on their own. */
export function isPlayerSide(persona: Persona): boolean {
  return persona === "athlete" || persona === "personal";
}
