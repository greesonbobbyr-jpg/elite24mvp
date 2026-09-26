"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { actingScope, actingTeamId, getCurrentContext, snapshotAuthorRole } from "@/lib/context";
import { can } from "@/lib/authz";
import { performAdjustPoints } from "@/lib/data/points";

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
  const ctx = await getCurrentContext();
  const coach = ctx?.user;
  // Matrix (4e): adjust_points is HEAD_COACH / ORG_ADMIN only — assistants
  // and GMs are denied. Legacy role check for pre-backfill logins only.
  const scope = ctx ? actingScope(ctx) : null;
  const mayAdjust = ctx
    ? scope
      ? can(ctx, "adjust_points", scope)
      : coach!.role === "COACH"
    : false;
  if (!ctx || !coach || !mayAdjust) return { error: "You can't adjust points." };

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

  // Team-scoped (4e): a PLAYER with an ACTIVE membership on the acting team
  // (legacy teamId equality only for pre-backfill targets).
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    include: {
      profile: true,
      profileRecord: {
        select: {
          memberships: {
            where: { teamId: coach.teamId, endedAt: null },
            select: { id: true },
          },
        },
      },
    },
  });
  const onRoster = player?.profileRecord
    ? player.profileRecord.memberships.length > 0
    : player?.teamId === coach.teamId;
  if (!player || player.role !== "PLAYER" || !player.profile || !onRoster) {
    return { error: "Not a player on your team." };
  }

  const current = player.profile.points;
  if (current + amount < 0) {
    return { error: `Can't remove more than ${current} points.` };
  }

  const finalReason = reason || "Coach bonus"; // additions may omit a reason

  // Ledger row + all caches in ONE transaction (lib/data/points — credits the
  // membership on the ADJUSTING STAFF'S team, the acting scope of this action).
  await performAdjustPoints({ id: player.id, teamId: coach.teamId }, amount, finalReason);

  revalidatePath(`/coach/player/${playerId}`);
  revalidatePath("/");
  return { ok: true };
}

// One-tap follow-through on the "X still to check in" count: posts a canned
// check-in reminder notification to the coach's OWN team (optionally as a TIME
// OUT takeover). Reuses the normal notification machinery — players confirm,
// the coach sees receipts. Copy is deliberately team-wide (no name-calling).
export async function sendCheckInReminder(formData: FormData): Promise<void> {
  const ctx = await getCurrentContext();
  const coach = ctx?.user;
  if (!ctx || !coach) return;
  // Matrix (4c): any staff role may post; TIME OUT needs send_timeout
  // (HC/ORG_ADMIN) — otherwise it goes out as a normal reminder.
  const scope = actingScope(ctx);
  const mayPost = scope
    ? can(ctx, "post_notification", scope)
    : coach.role === "COACH";
  if (!mayPost) return;
  const maySendTimeout = scope
    ? can(ctx, "send_timeout", scope)
    : coach.role === "COACH";
  const isTimeout = formData.get("isTimeout") === "on" && maySendTimeout;
  await prisma.notification.create({
    data: {
      teamId: actingTeamId(ctx), // same team the permission check used
      authorId: coach.id,
      title: "Check-in reminder 🏀",
      body: "Get your daily check-in in — write today's plan and get after it. Your streak is counting on you.",
      isTimeout,
      // Dual-write: person + role snapshot.
      authorProfileId: ctx.profile?.id ?? null,
      authorRole: ctx.profile ? snapshotAuthorRole(ctx) : null,
    },
  });
  revalidatePath("/notifications");
  revalidatePath("/");
}
