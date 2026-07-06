import { auth } from "@/auth";
import { prisma } from "./prisma";

// The single "who is the current user" choke point. Now backed by the real
// Auth.js session (encrypted JWT cookie) instead of the old unsigned e24_uid
// cookie. getCurrentUser() returns the SAME shape as before — a Prisma User with
// team + profile (Int id) — so every existing page/action guard is unchanged.
// Identity comes only from the verified session; no client-provided id is trusted.

export async function getCurrentUserId(): Promise<number | null> {
  const session = await auth();
  const raw = session?.user?.id;
  if (raw == null) return null;
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

// Loads the authenticated user with their team and (for players) profile, or null.
export async function getCurrentUser() {
  const id = await getCurrentUserId();
  if (id === null) return null;
  return prisma.user.findUnique({
    where: { id },
    include: { team: true, profile: true },
  });
}
