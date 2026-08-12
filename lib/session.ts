import { getCurrentContext, getCurrentUserId } from "./context";

// COMPAT SHIM (hierarchy rebuild Stage 2). The single "who is the current
// user" choke point is now getCurrentContext() in lib/context.ts; this module
// keeps the legacy surface working unchanged on top of it.
//
// getCurrentUser() returns ctx.user — the SAME Prisma row, loaded by the SAME
// query (`user.findUnique` incl. team + profile) this function has always run.
// Identity, not reconstruction: nothing to drift, byte-for-byte identical.
// Surfaces migrate onto ctx one at a time in Stage 4; this shim (and the
// legacy columns it exposes) is removed in Stage 6.

export { getCurrentUserId };

// Loads the authenticated user with their team and (for players) profile, or null.
export async function getCurrentUser() {
  const ctx = await getCurrentContext();
  return ctx?.user ?? null;
}
