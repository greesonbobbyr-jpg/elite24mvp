"use server";

import { revalidatePath } from "next/cache";
import { getCurrentContext } from "@/lib/context";
import { isPlayerSide, personaOf } from "@/lib/persona";
import { resolveJoinableTeam, joinTeamForProfile } from "@/lib/data/join";
import { normalizeCode } from "@/lib/invites";
import { rateLimit, RATE_LIMITED_MESSAGE } from "@/lib/ratelimit";

const NO_SEASON_MESSAGE =
  "That team isn't accepting players right now — ask your coach to start the season.";

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
