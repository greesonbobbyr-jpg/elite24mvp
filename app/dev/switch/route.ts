import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// Dev-only user switcher endpoint. A plain GET (link navigation) sets or clears
// the current-user cookie and redirects home. Using a route handler instead of
// a server action keeps the switcher bulletproof in dev (no rotating action
// ids, no multipart, no hydration dependency). Guarded for production.
export async function GET(request: NextRequest) {
  const home = new URL("/", request.url);
  if (process.env.NODE_ENV === "production") {
    return NextResponse.redirect(home);
  }

  const params = request.nextUrl.searchParams;
  const response = NextResponse.redirect(home);

  if (params.get("clear") !== null) {
    response.cookies.delete(SESSION_COOKIE);
  } else {
    const userId = params.get("userId") ?? "";
    if (/^\d+$/.test(userId)) {
      response.cookies.set(SESSION_COOKIE, userId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }
  }

  return response;
}
