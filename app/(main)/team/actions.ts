"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { uniqueJoinCode } from "@/lib/joincode";

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
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
  const accentColor = String(formData.get("accentColor") ?? "").trim() || null;

  await prisma.team.update({
    where: { id: user.teamId },
    data: { name, logoUrl, accentColor },
  });
  revalidatePath("/team");
  revalidatePath("/"); // team name shows on the dashboard/header
  return { ok: true };
}
