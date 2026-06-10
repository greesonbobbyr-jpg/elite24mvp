import { cookies } from "next/headers";
import { prisma } from "./prisma";

// Dev session (NOT production auth).
//
// This stores the "current user" id in an httpOnly cookie so the dev user
// switcher can change who you are viewing the app as (CLAUDE.md section 7).
// It deliberately does no password checking or session crypto. When real login
// is added, this module is the single place to swap in a vetted auth library
// (CLAUDE.md section 6) — callers only use getCurrentUser()/getCurrentUserId().

export const SESSION_COOKIE = "e24_uid";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function getCurrentUserId(): Promise<number | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) ? id : null;
}

// Loads the selected user with their team and (for players) profile, or null.
export async function getCurrentUser() {
  const id = await getCurrentUserId();
  if (id === null) return null;
  return prisma.user.findUnique({
    where: { id },
    include: { team: true, profile: true },
  });
}

// Setters — only valid to call inside a Server Action or Route Handler.
export async function setCurrentUserId(id: number): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, String(id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export async function clearCurrentUser(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
