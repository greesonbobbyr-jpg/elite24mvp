import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import authConfig from "./auth.config";

// Real auth (Auth.js / NextAuth v5). Credentials + JWT session so our existing
// Int-PK User (role/teamId/relations) is untouched — the session just carries
// the numeric id, which lib/session.ts resolves to the full User. Shared config
// (callbacks/pages/session) lives in auth.config.ts (edge-safe); the providers
// below need Node (prisma + bcrypt) so they live here. AUTH_SECRET from the env.

const isProd = process.env.NODE_ENV === "production";

const providers = [
  Credentials({
    id: "credentials",
    credentials: { email: {}, password: {} },
    authorize: async (creds) => {
      const email = String(creds?.email ?? "").trim().toLowerCase();
      const password = String(creds?.password ?? "");
      if (!email || !password) return null;
      const user = await prisma.user.findUnique({ where: { email } });
      // No account, or a credential-less account, fails the same way (no
      // enumeration). Never return the hash.
      if (!user?.passwordHash) return null;
      const ok = await verifyPassword(password, user.passwordHash);
      return ok ? { id: String(user.id) } : null;
    },
  }),
];

// DEV-ONLY impersonation: mint a REAL session for any seeded user without a
// password, so the dev switcher can view any coach/player. Never registered in
// production (and authorize double-checks NODE_ENV as belt-and-suspenders).
if (!isProd) {
  providers.push(
    Credentials({
      id: "impersonate",
      name: "Dev impersonate",
      credentials: { userId: {} },
      authorize: async (creds) => {
        if (process.env.NODE_ENV === "production") return null;
        const id = Number.parseInt(String(creds?.userId ?? ""), 10);
        if (!Number.isInteger(id)) return null;
        const user = await prisma.user.findUnique({ where: { id } });
        return user ? { id: String(user.id) } : null;
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
});
