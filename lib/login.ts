import { prisma } from "./prisma";

// Login identifiers. One field accepts an email or a username. Only something
// shaped like an email (x@y.z) is looked up as one; anything else is a username
// with any leading "@" dropped — people type "@jordan" because that's how
// usernames usually look, and a stray "@" used to route the lookup to the email
// column, where it could never match.

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export const USERNAME_RULES =
  "Username must be 3–20 characters: letters, numbers, or underscore.";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type LoginLookup = { email: string } | { username: string };

export function parseLoginIdentifier(raw: string): LoginLookup | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (EMAIL_SHAPE.test(value)) return { email: value };
  const username = value.replace(/^@+/, "");
  return username ? { username } : null;
}

// Usernames are stored lowercase without the "@".
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, "");
}

export type ClaimResult = { ok: true; username: string } | { ok: false; error: string };

// Set (or change) a person's OWN login username. The caller passes the
// session's user id — never a client-supplied one.
export async function claimUsername(userId: number, raw: string): Promise<ClaimResult> {
  const username = normalizeUsername(raw);
  if (!USERNAME_RE.test(username)) return { ok: false, error: USERNAME_RULES };

  const holder = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (holder && holder.id !== userId) {
    return { ok: false, error: "That username is taken — try another." };
  }

  try {
    await prisma.user.update({ where: { id: userId }, data: { username } });
  } catch {
    // Unique violation from a race with another claim.
    return { ok: false, error: "That username is taken — try another." };
  }
  return { ok: true, username };
}
