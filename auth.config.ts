import type { NextAuthConfig } from "next-auth";

// Edge-safe Auth.js config: session strategy, the /login page, and the callbacks
// that carry our numeric User id through the JWT. Deliberately has NO providers
// here — the credential/impersonate providers need Node (prisma + bcrypt) and are
// added in auth.ts. Middleware imports THIS file so prisma/bcrypt never get
// bundled into the edge runtime.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = Number(user.id);
      return token;
    },
    session({ session, token }) {
      if (token.uid != null) session.user.id = String(token.uid);
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
