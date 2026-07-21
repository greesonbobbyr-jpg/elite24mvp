"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { rateLimit, clientIp, RATE_LIMITED_MESSAGE } from "@/lib/ratelimit";

export type LoginState = { error?: string };

// Credential login for both roles: `identifier` is an email (coach) or a
// username (player) — auth.ts resolves which. On success signIn throws a
// redirect (to "/") which must propagate; only a credentials failure is caught
// and surfaced as a generic message (no user-enumeration, nothing logged).
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "");
  const password = String(formData.get("password") ?? "");

  // Throttle guessing: 10 tries per 5 minutes per identifier+IP pair.
  const ip = await clientIp();
  if (!(await rateLimit("login", `${identifier.trim()}:${ip}`, 10, 300))) {
    return { error: RATE_LIMITED_MESSAGE };
  }

  try {
    await signIn("credentials", { identifier, password, redirectTo: "/" });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Incorrect login or password." };
    }
    throw error; // NEXT_REDIRECT (success) and other errors must bubble up
  }
}
