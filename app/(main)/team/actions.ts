"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { actingScope, getCurrentContext, type Ctx } from "@/lib/context";
import { can, type Action } from "@/lib/authz";
import { endMembershipForUser } from "@/lib/data/memberships";
import { uniqueJoinCode } from "@/lib/joincode";
import { readBranding, validateImageDataUrl } from "@/lib/branding";
import { hashPassword } from "@/lib/password";
import { storeImage } from "@/lib/photoStore";
import { claimUsername } from "@/lib/login";

export type TeamSettingsState = { error?: string; ok?: boolean };

// Matrix guard for this file's actions (4e) — legacy role check remains only
// for pre-backfill logins (dies at Stage 6).
function staffCan(ctx: Ctx, action: Action): boolean {
  const scope = actingScope(ctx);
  return scope ? can(ctx, action, scope) : ctx.user.role === "COACH";
}

// Regenerate the coach's OWN team join code (team_settings; team from the
// session, never the client). Old code stops working immediately.
export async function regenerateJoinCode() {
  const ctx = await getCurrentContext();
  if (!ctx || !staffCan(ctx, "manage_join_code")) return;
  const user = ctx.user;
  const joinCode = await uniqueJoinCode();
  await prisma.team.update({ where: { id: user.teamId }, data: { joinCode } });
  revalidatePath("/team");
}

// Edit the coach's OWN team name / branding (coach-only, team-scoped).
export async function updateTeam(
  _prev: TeamSettingsState,
  formData: FormData,
): Promise<TeamSettingsState> {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user || !staffCan(ctx, "team_settings")) {
    return { error: "Head coach only." };
  }
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Team name can't be empty." };

  const branding = readBranding(formData);
  if ("error" in branding) return { error: branding.error };
  const { logoUrl, primaryColor, secondaryColor } = branding.data;

  // The coach's OWN photo (same validation as any uploaded image). Empty clears
  // it. Owner-only — we always write user.id, never a client-supplied id.
  const photoRes = validateImageDataUrl(
    String(formData.get("photoUrl") ?? ""),
    "photo",
  );
  if ("error" in photoRes) return { error: photoRes.error };

  // Daily check-in reminder hour (team-local; "" = off). Whitelisted range.
  const rawHour = String(formData.get("reminderHour") ?? "").trim();
  const parsedHour = Number.parseInt(rawHour, 10);
  const checkInReminderHour =
    rawHour !== "" && Number.isInteger(parsedHour) && parsedHour >= 0 && parsedHour <= 23
      ? parsedHour
      : null;

  // Offload uploads to Supabase Storage when configured (passthrough otherwise).
  const storedLogo = logoUrl
    ? await storeImage(logoUrl, `teams/${user.teamId}`)
    : null;
  const storedPhoto = photoRes.url
    ? await storeImage(photoRes.url, `coaches/${user.id}`)
    : null;

  await prisma.team.update({
    where: { id: user.teamId },
    data: {
      name,
      logoUrl: storedLogo,
      primaryColor,
      secondaryColor,
      checkInReminderHour,
    },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { photoUrl: storedPhoto },
  });
  // Dual-write: the coach's photo lives on the permanent Profile too.
  if (ctx.profile) {
    await prisma.profile.update({
      where: { id: ctx.profile.id },
      data: { photoUrl: storedPhoto },
    });
  }
  revalidatePath("/team");
  revalidatePath("/"); // team name + coach photo show on the dashboard/header
  return { ok: true };
}

export type UsernameState = { error?: string; ok?: boolean };

// Any staffer sets a login username for their OWN account (staff sign up with
// an email only, so without this "log in with your username" can't work for
// them). Always the session's user — never a client-supplied id.
export async function setMyUsername(
  _prev: UsernameState,
  formData: FormData,
): Promise<UsernameState> {
  const ctx = await getCurrentContext();
  if (!ctx || ctx.user.role !== "COACH") return { error: "Staff only." };
  const result = await claimUsername(ctx.user.id, String(formData.get("username") ?? ""));
  if (!result.ok) return { error: result.error };
  revalidatePath("/team");
  return { ok: true };
}

// ---- Roster management (coach-only, strictly own-team, PLAYER-only) --------

export type RosterActionState = {
  error?: string;
  ok?: boolean;
  // One-time display of a freshly reset password (never stored in plaintext).
  resetName?: string;
  resetPassword?: string;
};

// Resolve a roster target safely: a PLAYER with an ACTIVE membership on the
// coach's OWN team (4e — membership is the roster truth; legacy teamId
// equality only for pre-backfill targets, dies at Stage 6).
async function resolveRosterTarget(playerIdRaw: unknown, coachTeamId: number) {
  const playerId = Number.parseInt(String(playerIdRaw ?? ""), 10);
  if (!Number.isInteger(playerId)) return null;
  const target = await prisma.user.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      name: true,
      role: true,
      teamId: true,
      profileRecord: {
        select: {
          memberships: {
            where: { teamId: coachTeamId, endedAt: null },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!target || target.role !== "PLAYER") return null;
  const onRoster = target.profileRecord
    ? target.profileRecord.memberships.length > 0
    : target.teamId === coachTeamId;
  return onRoster ? target : null;
}

// REMOVE = END THE MEMBERSHIP (Stage 4e; locked decision #2). NOTHING is
// deleted: the player keeps their login, journal, streaks, ledger, and career
// points, and simply leaves this team's roster and boards. Re-joining with
// the team code restores them (same profile). The old hard delete is GONE
// from every org screen — person deletion is an operator-only script.
export async function removePlayer(
  _prev: RosterActionState,
  formData: FormData,
): Promise<RosterActionState> {
  const ctx = await getCurrentContext();
  const coach = ctx?.user;
  if (!ctx || !coach || !staffCan(ctx, "end_membership")) {
    return { error: "You can't remove players." };
  }

  const target = await resolveRosterTarget(formData.get("playerId"), coach.teamId);
  if (!target) return { error: "Not a player on your team." };

  const result = await endMembershipForUser(
    target.id,
    coach.teamId,
    ctx.profile?.id ?? null,
  );
  if (!result.ok) {
    // Pre-backfill data only — nothing is ever deleted as a "fallback".
    return { error: "This player's roster record isn't migrated yet — try again after the next sync." };
  }
  revalidatePath("/team");
  revalidatePath("/");
  revalidatePath("/leaderboard");
  revalidatePath("/board");
  return { ok: true };
}

// Reset a player's password to a fresh, readable temp value. Returned ONCE to
// the coach's screen (only the bcrypt hash is stored); the player logs in with
// it and can keep using it — a self-serve change screen is a later step.
const PW_WORDS = [
  "swish", "dunk", "hoop", "pivot", "rebound", "assist", "clutch", "baseline",
  "crossover", "fastbreak", "buzzer", "triple", "handles", "glass", "downtown",
];

export async function resetPlayerPassword(
  _prev: RosterActionState,
  formData: FormData,
): Promise<RosterActionState> {
  const ctx = await getCurrentContext();
  const coach = ctx?.user;
  // Account administration rides with team_settings (HC/ORG_ADMIN) — the
  // matrix has no dedicated row; assistants/GMs may not reset credentials.
  if (!ctx || !coach || !staffCan(ctx, "team_settings")) {
    return { error: "Head coach only." };
  }

  const target = await resolveRosterTarget(formData.get("playerId"), coach.teamId);
  if (!target) return { error: "Not a player on your team." };

  const w1 = PW_WORDS[randomInt(PW_WORDS.length)];
  let w2 = PW_WORDS[randomInt(PW_WORDS.length)];
  while (w2 === w1) w2 = PW_WORDS[randomInt(PW_WORDS.length)];
  const password = `${w1}-${w2}-${randomInt(10, 100)}`;

  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash: await hashPassword(password) },
  });
  revalidatePath("/team");
  return { ok: true, resetName: target.name, resetPassword: password };
}

export type SeasonState = { error?: string; ok?: boolean; seasonName?: string };

// SEASON ROLLOVER (4f; E.9 ruling) — create_season is ORG_ADMIN only. Retires
// the current season, opens the next, carries STAFF memberships forward;
// players re-join with the team code (their history stays on their profile).
export async function startSeason(
  _prev: SeasonState,
  formData: FormData,
): Promise<SeasonState> {
  const ctx = await getCurrentContext();
  if (!ctx || !staffCan(ctx, "create_season")) {
    return { error: "Only the organization admin can start a season." };
  }
  const organizationId = ctx.team?.organizationId;
  if (organizationId == null) return { error: "No organization found." };

  const name = String(formData.get("seasonName") ?? "").trim();
  if (!name) return { error: "Name the season (e.g. 2027)." };

  const { rolloverSeason } = await import("@/lib/seasons");
  const result = await rolloverSeason(organizationId, name);
  revalidatePath("/team");
  revalidatePath("/");
  return { ok: true, seasonName: result.season.name };
}
