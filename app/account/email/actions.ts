"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/context";
import { rateLimit, RATE_LIMITED_MESSAGE } from "@/lib/ratelimit";

export type EmailState = { error?: string };

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// An older account (username only) adds its email once — from then on it
// logs in with the email (owner, 2026-10-09). Always the session's own
// account; an account that already has an email can't use this to change it.
export async function addOwnEmail(_prev: EmailState, formData: FormData): Promise<EmailState> {
  const userId = await getCurrentUserId();
  if (userId === null) redirect("/login");
  if (!(await rateLimit("add-email", String(userId), 10, 3600))) return { error: RATE_LIMITED_MESSAGE };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_SHAPE.test(email) || email.length > 120) return { error: "Enter a real email address." };
  const holder = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (holder && holder.id !== userId) {
    return { error: "That email already has an account. Using a parent's email? Add +name before the @ (parent+jordan@gmail.com)." };
  }
  const updated = await prisma.user.updateMany({ where: { id: userId, email: null }, data: { email } });
  if (updated.count === 0 && !holder) return { error: "Your account already has an email." };
  redirect("/");
}
