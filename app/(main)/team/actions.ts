"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { uniqueJoinCode } from "@/lib/joincode";
import { readBranding, validateImageDataUrl } from "@/lib/branding";
import { hashPassword } from "@/lib/password";
import { storeImage } from "@/lib/photoStore";

export type TeamSettingsState = { error?: string; ok?: boolean };

// Regenerate the coach's OWN team join code (coach-only; team from the session,
// never the client). Old code stops working immediately.
export async function regenerateJoinCode() {
  const user = await getCurrentUser();
  if (!user || user.role !== "COACH") return;
  const joinCode = await uniqueJoinCode();
  await prisma.team.update({ where: { id: user.teamId }, data: { joinCode } });
  revalidatePath("/team");
}

// Edit the coach's OWN team name / branding (coach-only, team-scoped).
export async function updateTeam(
  _prev: TeamSettingsState,
  formData: FormData,
): Promise<TeamSettingsState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "COACH") return { error: "Coaches only." };
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

  // Offload uploads to Supabase Storage when configured (passthrough otherwise).
  const storedLogo = logoUrl
    ? await storeImage(logoUrl, `teams/${user.teamId}`)
    : null;
  const storedPhoto = photoRes.url
    ? await storeImage(photoRes.url, `coaches/${user.id}`)
    : null;

  await prisma.team.update({
    where: { id: user.teamId },
    data: { name, logoUrl: storedLogo, primaryColor, secondaryColor },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { photoUrl: storedPhoto },
  });
  revalidatePath("/team");
  revalidatePath("/"); // team name + coach photo show on the dashboard/header
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

// Resolve a roster target safely: must be a PLAYER on the coach's OWN team.
async function resolveRosterTarget(playerIdRaw: unknown, coachTeamId: number) {
  const playerId = Number.parseInt(String(playerIdRaw ?? ""), 10);
  if (!Number.isInteger(playerId)) return null;
  const target = await prisma.user.findUnique({
    where: { id: playerId },
    select: { id: true, name: true, role: true, teamId: true },
  });
  if (!target || target.role !== "PLAYER" || target.teamId !== coachTeamId) {
    return null;
  }
  return target;
}

// HARD delete — for players who have genuinely left the team. Cascades remove
// their profile, journal, points, quest logs, reviews, board messages, and
// reactions (the confirm UI says so explicitly). Soft-delete/archive is a
// deliberate later step.
export async function removePlayer(
  _prev: RosterActionState,
  formData: FormData,
): Promise<RosterActionState> {
  const coach = await getCurrentUser();
  if (!coach || coach.role !== "COACH") return { error: "Coaches only." };

  const target = await resolveRosterTarget(formData.get("playerId"), coach.teamId);
  if (!target) return { error: "Not a player on your team." };

  await prisma.user.delete({ where: { id: target.id } });
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
  const coach = await getCurrentUser();
  if (!coach || coach.role !== "COACH") return { error: "Coaches only." };

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
