"use server";

import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { MIN_PASSWORD_LENGTH } from "@/lib/account";
import { signIn } from "@/auth";
import { safeNext } from "@/lib/safe-next";
import { normalizeCode } from "@/lib/invites";
import { rateLimit, clientIp, RATE_LIMITED_MESSAGE } from "@/lib/ratelimit";

export type SignupState = { error?: string };

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// STEP 1 — ONE ACCOUNT FOR EVERYONE (owner, 2026-10-09): name, email,
// password. No team yet: Step 2 (/welcome) is starting an organization,
// joining a team with a code, or Personal Player Development. Email is the
// only login; kids may use a parent's email (one email per account).
export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  if (!(await rateLimit("signup", await clientIp(), 5, 3600))) {
    return { error: RATE_LIMITED_MESSAGE };
  }
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!name || name.length > 60) return { error: "Enter your name." };
  if (!EMAIL_SHAPE.test(email) || email.length > 120) return { error: "Enter a real email address." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirm) return { error: "Passwords don't match." };
  // Child-safety guardrail (CLAUDE.md §3.1): a young child doesn't sign
  // themselves up — a parent or guardian does.
  if (formData.get("ageOk") !== "on") {
    return { error: "Check the box: you're 13 or older, or a parent/guardian setting this up." };
  }
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { error: "That email already has an account — log in instead. (Kids using a parent's email: add +name before the @.)" };
  }

  const passwordHash = await hashPassword(password);
  try {
    await prisma.$transaction(async (tx) => {
      // No team: the legacy login role is PLAYER only because the column is
      // required — what they see comes from their team roles (lib/persona).
      const user = await tx.user.create({ data: { name, email, role: "PLAYER", teamId: null, passwordHash } });
      await tx.profile.create({ data: { userId: user.id, name } });
    });
  } catch {
    return { error: "Could not create your account. Please try again." };
  }

  const code = normalizeCode(formData.get("code"));
  const next = safeNext(formData.get("next")) ?? (code ? `/welcome?code=${code}` : "/welcome");
  try {
    await signIn("credentials", { identifier: email, password, redirectTo: next });
    return {};
  } catch (error) {
    if (error instanceof AuthError) return { error: "Account created — please log in." };
    throw error; // NEXT_REDIRECT on success
  }
}
