"use server";

import { revalidatePath } from "next/cache";
import { ReactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { actingScope, actingTeamId, getCurrentContext, snapshotAuthorRole } from "@/lib/context";
import { can } from "@/lib/authz";
import { isSetUp } from "@/lib/onboarding";
import { isValidGifId } from "@/lib/gifs";
import { rateLimit } from "@/lib/ratelimit";

export type BoardState = { error?: string; ok?: boolean };

const SPECIAL_TYPES = new Set(["DISCUSSION", "CHALLENGE", "SPOTLIGHT"]);

// Any team member (a coach, or an onboarded player) may post a TEXT message to
// their OWN team's board. The colored special types are coach-only — enforced
// here, so a player (or any invalid type) is stored as REGULAR.
export async function postMessage(
  _prevState: BoardState,
  formData: FormData,
): Promise<BoardState> {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user || !isSetUp(ctx)) {
    return { error: "Only a team member can post." };
  }
  // 4f: posting requires a team — a removed player (or one whose season
  // rolled over, or one training on their own) has no board. The ACTING
  // team: the same one the permission checks below use.
  const teamId = actingTeamId(ctx);
  if (teamId == null) {
    return { error: "Join a team to post." };
  }
  const body = String(formData.get("body") ?? "").trim();

  // A GIF, if attached, must be one of the curated registry ids — never an
  // arbitrary/external reference. Reject anything unknown before storing.
  const rawGifId = String(formData.get("gifId") ?? "").trim();
  if (rawGifId !== "" && !isValidGifId(rawGifId)) {
    return { error: "Unknown GIF." };
  }
  const gifId = rawGifId === "" ? null : rawGifId;

  // A message may be text and/or a GIF, but not empty.
  if (body === "" && !gifId) {
    return { error: "Write a message or pick a GIF." };
  }

  // Matrix: special colored types are post_special_message — HEAD_COACH /
  // ORG_ADMIN only (assistants and GMs post REGULAR like everyone else).
  // Silent downgrade.
  const scope = actingScope(ctx);
  const maySpecial = scope != null && can(ctx, "post_special_message", scope);
  const rawType = String(formData.get("type") ?? "REGULAR");
  const type =
    maySpecial && SPECIAL_TYPES.has(rawType)
      ? (rawType as "DISCUSSION" | "CHALLENGE" | "SPOTLIGHT")
      : "REGULAR";

  // Optional Messenger-style reply target. Only honored if it's a live message
  // on the SAME team (team-private); anything else is ignored (posts as normal).
  const rawReplyTo = Number.parseInt(String(formData.get("replyToId") ?? ""), 10);
  let replyToId: number | null = null;
  if (Number.isInteger(rawReplyTo)) {
    const parent = await prisma.teamMessage.findUnique({
      where: { id: rawReplyTo },
      select: { teamId: true, deletedAt: true },
    });
    if (parent && !parent.deletedAt && parent.teamId === teamId) {
      replyToId = rawReplyTo;
    }
  }

  await prisma.teamMessage.create({
    data: {
      teamId,
      authorId: user.id,
      body,
      type,
      gifId,
      replyToId,
      // The person + the role snapshot.
      authorProfileId: ctx.profile.id,
      authorRole: snapshotAuthorRole(ctx),
    },
  });
  revalidatePath("/board");
  return { ok: true };
}

// The team coach may delete ANY message on their team; a player may delete only
// their OWN. Strictly same team. Soft delete (deletedAt) for an audit trail.
export async function deleteMessage(formData: FormData): Promise<void> {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user) return;

  const messageId = Number.parseInt(String(formData.get("messageId") ?? ""), 10);
  if (!Number.isInteger(messageId)) return;

  const message = await prisma.teamMessage.findUnique({
    where: { id: messageId },
    select: { teamId: true, authorId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) return;
  const teamId = actingTeamId(ctx);
  if (teamId == null || message.teamId !== teamId) return; // never another team's board

  // Matrix: your own message, or moderate_board (HEAD_COACH/ORG_ADMIN —
  // assistants and GMs may NOT moderate).
  const scope = actingScope(ctx);
  const mayModerate = scope != null && can(ctx, "moderate_board", scope);
  const allowed = mayModerate || message.authorId === user.id;
  if (!allowed) return;

  await prisma.teamMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/board");
}

// Set/replace/remove the current team member's reaction on a message of THEIR
// team, Messenger-style: ONE reaction per person per message. Picking a face
// creates it, picking a different face replaces it, picking the same face again
// removes it. Team-scoping + permissions unchanged.
const REACTION_TYPES = new Set([
  "THUMBS_UP",
  "HEART",
  "LAUGH",
  "WOW",
  "SAD",
  "PRAY",
]);

export async function toggleReaction(formData: FormData): Promise<void> {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user || !isSetUp(ctx)) return;
  // 4f: reacting requires a team (see postMessage).
  const teamId = actingTeamId(ctx);
  if (teamId == null) return;

  // Each tap re-renders the whole board — cap rapid-fire tapping per user.
  if (!(await rateLimit("react", String(user.id), 60, 60))) return;

  const messageId = Number.parseInt(String(formData.get("messageId") ?? ""), 10);
  if (!Number.isInteger(messageId)) return;
  const reactionType = String(formData.get("reactionType") ?? "");
  if (!REACTION_TYPES.has(reactionType)) return;

  const message = await prisma.teamMessage.findUnique({
    where: { id: messageId },
    select: { teamId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) return;
  if (message.teamId !== teamId) return; // never another team's board

  // One row per (message, user) — reactionType is what changes.
  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId: { messageId, userId: user.id } },
  });
  if (!existing) {
    await prisma.messageReaction.create({
      data: {
        messageId,
        userId: user.id,
        reactionType: reactionType as ReactionType,
        profileId: ctx.profile.id,
      },
    });
  } else if (existing.reactionType !== reactionType) {
    await prisma.messageReaction.update({
      where: { id: existing.id },
      data: { reactionType: reactionType as ReactionType },
    });
  } else {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  }
  revalidatePath("/board");
}
