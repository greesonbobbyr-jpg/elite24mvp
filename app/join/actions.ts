"use server";

import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { signIn } from "@/auth";
import { getCurrentContext } from "@/lib/context";
import { isPlayerSide, personaOf } from "@/lib/persona";
import { resolveJoinableTeam, joinTeamForProfile } from "@/lib/data/join";
import { rateLimit, clientIp, RATE_LIMITED_MESSAGE } from "@/lib/ratelimit";
import { USERNAME_RE, USERNAME_RULES, normalizeUsername } from "@/lib/login";

const NO_SEASON_MESSAGE =
  "That team isn't accepting players right now — ask your coach to start the season.";

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
  // Throttle code guessing: the lookup is an oracle over the join-code space.
  if (!(await rateLimit("join-lookup", await clientIp(), 15, 300))) {
    return { error: RATE_LIMITED_MESSAGE };
  }

  const code = normalizeCode(formData.get("code"));
  if (!code) return { error: "Enter your team code." };
  const team = await findTeamByCode(code);
  if (!team) return { error: "That code didn't match a team." };
  return { code, teamName: team.name };
}

export type CreatePlayerState = { error?: string };

export async function createPlayer(
  _prev: CreatePlayerState,
  formData: FormData,
): Promise<CreatePlayerState> {
  // Throttle account creation: 5 joins per hour per IP.
  if (!(await rateLimit("join-create", await clientIp(), 5, 3600))) {
    return { error: RATE_LIMITED_MESSAGE };
  }

  const code = normalizeCode(formData.get("code"));
  const name = String(formData.get("name") ?? "").trim();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  // Re-validate the code server-side — never trust the client's carried value.
  const team = await findTeamByCode(code);
  if (!team) return { error: "That code didn't match a team." };

  if (!name) return { error: "Enter your name." };
  if (!USERNAME_RE.test(username)) return { error: USERNAME_RULES };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords don't match." };
  }

  const taken = await prisma.user.findUnique({ where: { username } });
  if (taken) return { error: "That username is taken — try another." };

  // 4f: an org with no current season FAILS the join with a clear error
  // BEFORE any account is created — never a silent membership skip.
  const joinable = await resolveJoinableTeam(code);
  if (!joinable.ok) {
    return {
      error: joinable.reason === "bad_code"
        ? "That code didn't match a team."
        : NO_SEASON_MESSAGE,
    };
  }

  const passwordHash = await hashPassword(password);
  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
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
      // The permanent person + their membership in the current season.
      const profile = await tx.profile.create({
        data: { userId: created.id, name },
      });
      await tx.membership.create({
        data: {
          profileId: profile.id,
          teamId: team.id,
          seasonId: joinable.seasonId,
          role: "PLAYER",
        },
      });
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

export type JoinTeamState = { error?: string; ok?: boolean; teamName?: string };

// RETURNING ATHLETE (Stage 4f): a logged-in player with no active membership
// (removed, or the season rolled over) joins a team by code from INSIDE the
// app — a membership on their EXISTING profile, so career points, journal,
// and streaks carry. Same team + same season reactivates the exact ended
// membership (board points return); otherwise a fresh membership (board 0).
export async function joinTeamWithCode(
  _prev: JoinTeamState,
  formData: FormData,
): Promise<JoinTeamState> {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user || !isPlayerSide(personaOf(ctx))) {
    return { error: "Log in as a player to join a team." };
  }
  if (!ctx.profile) {
    // Pre-backfill login — converges at the next backfill run.
    return { error: "Your account isn't migrated yet — try again later." };
  }
  if (ctx.membership) {
    return { error: "You're already on a team this season." };
  }
  if (!(await rateLimit("join-team", String(user.id), 10, 3600))) {
    return { error: RATE_LIMITED_MESSAGE };
  }

  const code = normalizeCode(formData.get("code"));
  const joinable = await resolveJoinableTeam(code);
  if (!joinable.ok) {
    return {
      error: joinable.reason === "bad_code"
        ? "That code didn't match a team."
        : NO_SEASON_MESSAGE,
    };
  }

  await joinTeamForProfile(
    ctx.profile.id,
    user.id,
    joinable.team.id,
    joinable.seasonId,
  );
  revalidatePath("/");
  return { ok: true, teamName: joinable.team.name };
}
