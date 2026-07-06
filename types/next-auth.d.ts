import type { DefaultSession } from "next-auth";

// Carry our numeric User id through the session. `session.user.id` is the string
// form of the app's Int User.id; getCurrentUser() parses it back to a number.
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: number;
  }
}
