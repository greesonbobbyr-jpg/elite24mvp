import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "./auth.config";

// Route protection: unauthenticated requests to app routes are redirected to
// /login. Uses the edge-safe authConfig (no prisma/bcrypt) — it only decodes the
// JWT session cookie. Public paths (login, the Auth.js API, static assets) are
// excluded by the matcher below, so login + sign-in POSTs are always reachable.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
});

export const config = {
  matcher: [
    // Public: auth API, auth pages, the cron endpoint (own CRON_SECRET guard),
    // the service worker, and static assets. Everything else needs a session.
    "/((?!api/auth|api/cron|login|signup|join|sw\\.js|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|pdf|mjs|ico|txt|webmanifest)).*)",
  ],
};
