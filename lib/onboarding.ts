// A player is "onboarded" once they have a PlayerProfile with onboardedAt set.
// A not-yet-onboarded player has no PlayerProfile row at all (see the seed).
// Shared by the route guard and the onboarding page so the rule lives in one
// place (CLAUDE.md section 2 — onboarding is required before using the app).
export function isOnboarded(
  user: { profile: { onboardedAt: Date | null } | null } | null,
): boolean {
  return Boolean(user?.profile?.onboardedAt);
}

// The NEW-WORLD setup gate (4f): everyone has a Profile; players complete
// setup by writing the Dream (setupCompletedAt — dual-written 1:1 with the
// legacy onboardedAt); staff setup completes at signup. Legacy fallback for
// pre-backfill logins (dies at Stage 6).
export function isSetUp(ctx: {
  user: { role: string; profile: { onboardedAt: Date | null } | null };
  profile: { setupCompletedAt: Date | null } | null;
}): boolean {
  if (ctx.user.role !== "PLAYER") return true;
  if (ctx.profile) return ctx.profile.setupCompletedAt != null;
  return isOnboarded(ctx.user);
}
