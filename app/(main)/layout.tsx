import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isOnboarded } from "@/lib/onboarding";
import { getActiveTimeout } from "@/lib/notifications";
import { TimeoutTakeover } from "./TimeoutTakeover";

// Gate for the main app: a Player must finish onboarding before using anything
// here. Coaches and "no user selected" pass through (CLAUDE.md section 2).
// The /onboarding route lives outside this group, so it is never gated.
//
// This server component wraps every main route, so it is the right place to
// enforce the app-wide TIME OUT takeover: an onboarded player with an
// unacknowledged TIME OUT for their own team sees the overlay on any page and
// immediately on load/login, until they acknowledge it.
export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (user?.role === "PLAYER" && !isOnboarded(user)) {
    redirect("/onboarding");
  }

  const timeout =
    user?.role === "PLAYER"
      ? await getActiveTimeout(user.id, user.teamId)
      : null;

  return (
    <>
      {children}
      {timeout && <TimeoutTakeover notification={timeout} />}
    </>
  );
}
