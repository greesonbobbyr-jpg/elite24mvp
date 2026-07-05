"use server";

import { revalidatePath } from "next/cache";
import { PointsSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export type CoachActionState = { error?: string; ok?: boolean };

// A coach manually adjusts (+/-) the points of a player on their OWN team, with a
// reason. Writes a PointsLedger row (source COACH_ADJUSTMENT) AND updates the
// cached PlayerProfile.points in the SAME transaction — identical integrity to the
// award/undo flow, keeping the ledger the single source of truth. Coach manual
// veto only; no approval gates. Removals that would push the total below 0 are
// REJECTED (the coach can remove down to exactly the current total).
export async function adjustPoints(
  _prev: CoachActionState,
  formData: FormData,
): Promise<CoachActionState> {
  const coach = await getCurrentUser();
  if (!coach || coach.role !== "COACH") return { error: "Coaches only." };

  const playerId = Number.parseInt(String(formData.get("playerId") ?? ""), 10);
  if (!Number.isInteger(playerId)) return { error: "Invalid player." };

  const direction = String(formData.get("direction") ?? "add"); // "add" | "remove"
  const magnitude = Number.parseInt(String(formData.get("amount") ?? ""), 10);
  if (!Number.isInteger(magnitude) || magnitude <= 0) {
    return { error: "Enter a whole number greater than 0." };
  }
  const reason = String(formData.get("reason") ?? "").trim();
  const amount = direction === "remove" ? -magnitude : magnitude;

  // A removal must carry a reason (a record of why points were taken).
  if (amount < 0 && reason === "") {
    return { error: "A reason is required to remove points." };
  }

  // Team-scoped: only a PLAYER on the coach's own team.
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    include: { profile: true },
  });
  if (
    !player ||
    player.role !== "PLAYER" ||
    player.teamId !== coach.teamId ||
    !player.profile
  ) {
    return { error: "Not a player on your team." };
  }

  const current = player.profile.points;
  if (current + amount < 0) {
    return { error: `Can't remove more than ${current} points.` };
  }

  const finalReason = reason || "Coach bonus"; // additions may omit a reason

  // Ledger row + cache bump in ONE transaction (mirror of logQuest).
  await prisma.$transaction(async (tx) => {
    await tx.pointsLedger.create({
      data: {
        userId: playerId,
        amount,
        reason: finalReason,
        source: PointsSource.COACH_ADJUSTMENT,
      },
    });
    await tx.playerProfile.update({
      where: { userId: playerId },
      data: { points: { increment: amount } },
    });
  });

  revalidatePath(`/coach/player/${playerId}`);
  revalidatePath("/");
  return { ok: true };
}
