"use server";

import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { signIn } from "@/auth";

// Player self-join by the coach's team code. Two steps, both server-validated:
//  1. lookupJoinCode — confirm the code matches a team (read-only) and show its
//     name, so a kid can see they're joining the RIGHT team before committing.
//  2. createPlayer — re-validate the code, then create a username+password-only
//     player account on that team and log them in. No email / PII (CLAUDE.md
//     §3.4); code-gated, no minor self-signup without a coach's code (§3.1).

// Join codes are stored uppercase (see lib/joincode). Normalize input the same
// way so "abc123" / " ABC123 " match.
function normalizeCode(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

async function findTeamByCode(code: string) {
  if (!code) return null;
  return prisma.team.findUnique({ where: { joinCode: code } });
}

export type LookupState = { code?: string; teamName?: string; error?: string };

export async function lookupJoinCode(
  _prev: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const code = normalizeCode(formData.get("code"));
  if (!code) return { error: "Enter your team code." };
  const team = await findTeamByCode(code);
  if (!team) return { error: "That code didn't match a team." };
  return { code, teamName: team.name };
}

export type CreatePlayerState = { error?: string };

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function createPlayer(
  _prev: CreatePlayerState,
  formData: FormData,
): Promise<CreatePlayerState> {
  const code = normalizeCode(formData.get("code"));
  const name = String(formData.get("name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  // Re-validate the code server-side — never trust the client's carried value.
  const team = await findTeamByCode(code);
  if (!team) return { error: "That code didn't match a team." };

  if (!name) return { error: "Enter your name." };
  if (!USERNAME_RE.test(username)) {
    return {
      error: "Username must be 3–20 characters: letters, numbers, or underscore.",
    };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords don't match." };
  }

  const taken = await prisma.user.findUnique({ where: { username } });
  if (taken) return { error: "That username is taken — try another." };

  const passwordHash = await hashPassword(password);
  try {
    await prisma.user.create({
      data: {
        name,
        username,
        role: "PLAYER",
        teamId: team.id,
        passwordHash,
        // No email for players — username + password only (§3.4).
        email: null,
      },
    });
  } catch {
    // Unique violation (rare race on username) → generic message.
    return { error: "Could not create your account. Please try again." };
  }

  // Log the new player straight in by username (throws NEXT_REDIRECT on success);
  // the onboarding gate then routes them to /onboarding (no profile yet).
  try {
    await signIn("credentials", {
      identifier: username,
      password,
      redirectTo: "/",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created — please log in." };
    }
    throw error;
  }
}
