"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isOnboarded } from "@/lib/onboarding";

export type BoardState = { error?: string };

// Any team member (a coach, or an onboarded player) may post a TEXT message to
// their OWN team's board (uses user.teamId — never another team).
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

  await prisma.teamMessage.create({
    data: { teamId: user.teamId, authorId: user.id, body },
  });
  revalidatePath("/board");
  return {};
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
