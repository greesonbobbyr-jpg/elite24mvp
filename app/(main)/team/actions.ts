"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { uniqueJoinCode } from "@/lib/joincode";
import { readBranding } from "@/lib/branding";

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

  await prisma.team.update({
    where: { id: user.teamId },
    data: { name, logoUrl, primaryColor, secondaryColor },
  });
  revalidatePath("/team");
  revalidatePath("/"); // team name shows on the dashboard/header
  return { ok: true };
}
