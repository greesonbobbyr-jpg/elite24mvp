"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { safeNext } from "@/lib/safe-next";
import { rateLimit, clientIp, RATE_LIMITED_MESSAGE } from "@/lib/ratelimit";

export type LoginState = { error?: string };

// Email + password login (auth.ts). On success signIn throws a redirect —
// home, or back to where they were headed (an invite link) — which must
// propagate; only a credentials failure is caught, with one generic message
// (no user enumeration, nothing logged).
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "");
  const password = String(formData.get("password") ?? "");

  // Throttle guessing: 10 tries per 5 minutes per identifier+IP pair.
  const ip = await clientIp();
  if (!(await rateLimit("login", `${identifier.trim()}:${ip}`, 10, 300))) {
    return { error: RATE_LIMITED_MESSAGE };
  }

  try {
    await signIn("credentials", { identifier, password, redirectTo: safeNext(formData.get("next")) ?? "/" });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Incorrect email or password." };
    }
    throw error; // NEXT_REDIRECT (success) and other errors must bubble up
  }
}
