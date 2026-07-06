"use server";

import { signOut } from "@/auth";

// Log the current user out and send them to /login. Used by the header menu.
export async function logout() {
  await signOut({ redirectTo: "/login" });
}
