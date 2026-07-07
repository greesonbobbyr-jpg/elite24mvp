"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { uniqueJoinCode } from "@/lib/joincode";
import { readBranding, validateImageDataUrl } from "@/lib/branding";

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

  await prisma.team.update({
    where: { id: user.teamId },
    data: { name, logoUrl, primaryColor, secondaryColor },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { photoUrl: photoRes.url },
  });
  revalidatePath("/team");
  revalidatePath("/"); // team name + coach photo show on the dashboard/header
  return { ok: true };
}
