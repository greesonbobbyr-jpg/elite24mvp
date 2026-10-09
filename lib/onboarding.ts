import { isStaffSide, personaOf, type PersonaCtx } from "./persona";

// A player is "onboarded" once they have a PlayerProfile with onboardedAt set.
// A not-yet-onboarded player has no PlayerProfile row at all (see the seed).
// Shared by the route guard and the onboarding page so the rule lives in one
// place (CLAUDE.md section 2 — onboarding is required before using the app).
export function isOnboarded(
  user: { profile: { onboardedAt: Date | null } | null } | null,
): boolean {
  return Boolean(user?.profile?.onboardedAt);
}

// The NEW-WORLD setup gate (4f): everyone has a Profile; athletes — on a
// team or on their own — complete setup by writing the Dream
// (setupCompletedAt, dual-written 1:1 with the legacy onboardedAt); staff
// setup completes at signup; the CEO has no setup step. Legacy fallback for
// pre-backfill logins (dies at Stage 6).
export function isSetUp(
  ctx: PersonaCtx & { user: { profile: { onboardedAt: Date | null } | null } },
): boolean {
  const persona = personaOf(ctx);
  if (isStaffSide(persona) || persona === "ceo") return true;
  if (ctx.profile) return ctx.profile.setupCompletedAt != null;
  return isOnboarded(ctx.user);
}
