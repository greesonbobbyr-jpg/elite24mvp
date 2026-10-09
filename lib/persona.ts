import type { Role } from "@prisma/client";
import type { Ctx } from "./context";

// What someone sees in the app right now, from their TEAM ROLES — not from the
// login's fixed User.role. Everyone has one account (owner, 2026-10-09); a
// person can be a player on one team and staff on another, and an account can
// have no team at all. The acting membership (lib/context) decides.
//
//   athlete   acting membership is PLAYER
//   staff     acting membership is a coach / GM role
//   admin     org admin with no roster spot (org authority only)
//   personal  no team, set up — Personal Player Development: points, quests,
//             check-in, journal, Pro Review; no team surfaces
//   new       no team, not set up yet
//
// The legacy User.role column is read only for a pre-backfill login with no
// Profile (dies at Stage 6).
export type Persona = "athlete" | "staff" | "admin" | "personal" | "new";

export type PersonaCtx = Pick<Ctx, "membership" | "orgAdminOf"> & {
  user: { role: Role };
  profile: { setupCompletedAt: Date | null } | null;
};

export function personaOf(ctx: PersonaCtx): Persona {
  if (ctx.membership) return ctx.membership.role === "PLAYER" ? "athlete" : "staff";
  if (ctx.orgAdminOf.length > 0) return "admin";
  if (!ctx.profile) return ctx.user.role === "COACH" ? "staff" : "athlete";
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
