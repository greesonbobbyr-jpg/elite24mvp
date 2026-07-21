"use server";

import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { uniqueJoinCode } from "@/lib/joincode";
import { readBranding } from "@/lib/branding";
import { signIn } from "@/auth";
import { rateLimit, clientIp, RATE_LIMITED_MESSAGE } from "@/lib/ratelimit";

export type SignupState = { error?: string };

// Coach self-signup: creates the coach AND their team (with a unique join code)
// atomically, then logs them in. Coaches are adults; player signup is code-gated
// in a later chunk. No minor self-signup here.
export async function signup(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  // Throttle account creation: 5 signups per hour per IP.
  if (!(await rateLimit("signup", await clientIp(), 5, 3600))) {
    return { error: RATE_LIMITED_MESSAGE };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const teamName = String(formData.get("teamName") ?? "").trim();

  if (!name || !email || !teamName) {
    return { error: "Fill in your name, email, and team name." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords don't match." };
  }

  const branding = readBranding(formData);
  if ("error" in branding) return { error: branding.error };
  const { logoUrl, primaryColor, secondaryColor } = branding.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "That email is already in use." };
  }

  const joinCode = await uniqueJoinCode();
  const passwordHash = await hashPassword(password);

  try {
    await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: { name: teamName, joinCode, logoUrl, primaryColor, secondaryColor },
      });
      await tx.user.create({
        data: { name, email, role: "COACH", teamId: team.id, passwordHash },
      });
    });
  } catch {
    // Unique violation (rare race on email/joinCode) → generic message.
    return { error: "Could not create your account. Please try again." };
  }

  // Log the new coach straight in (throws NEXT_REDIRECT on success).
  try {
    await signIn("credentials", { identifier: email, password, redirectTo: "/" });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created — please log in." };
    }
    throw error;
  }
}
