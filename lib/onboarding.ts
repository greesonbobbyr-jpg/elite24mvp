// A player is "onboarded" once they have a PlayerProfile with onboardedAt set.
// A not-yet-onboarded player has no PlayerProfile row at all (see the seed).
// Shared by the route guard and the onboarding page so the rule lives in one
// place (CLAUDE.md section 2 — onboarding is required before using the app).
export function isOnboarded(
  user: { profile: { onboardedAt: Date | null } | null } | null,
): boolean {
  return Boolean(user?.profile?.onboardedAt);
}
