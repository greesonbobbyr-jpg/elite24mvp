"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isOnboarded } from "@/lib/onboarding";

export type BoardState = { error?: string; ok?: boolean };

const SPECIAL_TYPES = new Set(["DISCUSSION", "CHALLENGE", "SPOTLIGHT"]);

// Any team member (a coach, or an onboarded player) may post a TEXT message to
// their OWN team's board. The colored special types are coach-only — enforced
// here, so a player (or any invalid type) is stored as REGULAR.
export async function postMessage(
  _prevState: BoardState,
  formData: FormData,
): Promise<BoardState> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "COACH" && !isOnboarded(user))) {
    return { error: "Only a team member can post." };
  }
  const body = String(formData.get("body") ?? "").trim();
  if (body === "") {
    return { error: "Write a message first." };
  }

  const rawType = String(formData.get("type") ?? "REGULAR");
  const type =
    user.role === "COACH" && SPECIAL_TYPES.has(rawType)
      ? (rawType as "DISCUSSION" | "CHALLENGE" | "SPOTLIGHT")
      : "REGULAR";

  await prisma.teamMessage.create({
    data: { teamId: user.teamId, authorId: user.id, body, type },
  });
  revalidatePath("/board");
  return { ok: true };
}

// The team coach may delete ANY message on their team; a player may delete only
// their OWN. Strictly same team. Soft delete (deletedAt) for an audit trail.
export async function deleteMessage(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const messageId = Number.parseInt(String(formData.get("messageId") ?? ""), 10);
  if (!Number.isInteger(messageId)) return;

  const message = await prisma.teamMessage.findUnique({
    where: { id: messageId },
    select: { teamId: true, authorId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) return;
  if (message.teamId !== user.teamId) return; // never another team's board

  const allowed = user.role === "COACH" || message.authorId === user.id;
  if (!allowed) return;

  await prisma.teamMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/board");
}

// Toggle a 👍/❤️ reaction by the current team member on a message of THEIR team.
// One of each type per user per message — toggling removes it.
export async function toggleReaction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "COACH" && !isOnboarded(user))) return;

  const messageId = Number.parseInt(String(formData.get("messageId") ?? ""), 10);
  if (!Number.isInteger(messageId)) return;
  const reactionType = String(formData.get("reactionType") ?? "");
  if (reactionType !== "THUMBS_UP" && reactionType !== "HEART") return;

  const message = await prisma.teamMessage.findUnique({
    where: { id: messageId },
    select: { teamId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) return;
  if (message.teamId !== user.teamId) return; // never another team's board

  const existing = await prisma.messageReaction.findUnique({
    where: {
      messageId_userId_reactionType: { messageId, userId: user.id, reactionType },
    },
  });
  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.messageReaction.create({
      data: { messageId, userId: user.id, reactionType },
    });
  }
  revalidatePath("/board");
}

// Any team member may post a flat TEXT comment on a message of THEIR team.
export async function postComment(
  _prevState: BoardState,
  formData: FormData,
): Promise<BoardState> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "COACH" && !isOnboarded(user))) {
    return { error: "Only a team member can comment." };
  }
  const messageId = Number.parseInt(String(formData.get("messageId") ?? ""), 10);
  if (!Number.isInteger(messageId)) return { error: "Invalid message." };
  const body = String(formData.get("body") ?? "").trim();
  if (body === "") return { error: "Write a comment first." };

  const message = await prisma.teamMessage.findUnique({
    where: { id: messageId },
    select: { teamId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) return { error: "Message not found." };
  if (message.teamId !== user.teamId) return { error: "Not your team." }; // team-scoped

  await prisma.messageComment.create({
    data: { messageId, authorId: user.id, body },
  });
  revalidatePath("/board");
  return { ok: true };
}

// The team coach may delete ANY comment on their team; a player only their OWN.
// Strictly same team (checked via the parent message). Soft delete.
export async function deleteComment(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const commentId = Number.parseInt(String(formData.get("commentId") ?? ""), 10);
  if (!Number.isInteger(commentId)) return;

  const comment = await prisma.messageComment.findUnique({
    where: { id: commentId },
    select: {
      authorId: true,
      deletedAt: true,
      message: { select: { teamId: true } },
    },
  });
  if (!comment || comment.deletedAt) return;
  if (comment.message.teamId !== user.teamId) return; // never another team

  const allowed = user.role === "COACH" || comment.authorId === user.id;
  if (!allowed) return;

  await prisma.messageComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/board");
}
