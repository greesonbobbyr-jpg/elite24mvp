// Login identifiers. The field takes an email (or, for an older account with
// no email yet, its username). Only something
// shaped like an email (x@y.z) is looked up as one; anything else is a username
// with any leading "@" dropped — people type "@jordan" because that's how
// usernames usually look, and a stray "@" used to route the lookup to the email
// column, where it could never match.

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

// EMAIL IS THE ONLY LOGIN (owner, 2026-10-09). A username still works only
// for an older account that has no email yet — the app then asks for one
// (/account/email) — so nobody already using the app is locked out.
export function loginAllowed(lookup: LoginLookup, user: { email: string | null }): boolean {
  return "email" in lookup || user.email == null;
}
