"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string };

// Coach credential login. On success signIn throws a redirect (to "/") which must
// propagate; only a credentials failure is caught and surfaced as a generic
// message (no user-enumeration, nothing logged).
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Incorrect email or password." };
    }
    throw error; // NEXT_REDIRECT (success) and other errors must bubble up
  }
}
