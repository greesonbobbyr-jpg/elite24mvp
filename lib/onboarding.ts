import { isStaffSide, personaOf, type PersonaCtx } from "./persona";

// The setup gate: athletes — on a team or on their own — complete setup by
// writing the Dream (Profile.setupCompletedAt); staff setup completes when
// they join; the CEO has no setup step. Shared by the route guard and the
// onboarding page so the rule lives in one place (CLAUDE.md section 2).
export function isSetUp(ctx: PersonaCtx): boolean {
  const persona = personaOf(ctx);
  if (isStaffSide(persona) || persona === "ceo") return true;
  return ctx.profile.setupCompletedAt != null;
}
