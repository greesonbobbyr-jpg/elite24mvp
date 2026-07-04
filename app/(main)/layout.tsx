import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isOnboarded } from "@/lib/onboarding";
import { getActiveTimeout, countUnreadForPlayer } from "@/lib/notifications";
import { TimeoutTakeover } from "./TimeoutTakeover";
import { NavMenu } from "./NavMenu";
import { IdentityChip } from "./IdentityChip";
import { PlayerTabBar } from "./PlayerTabBar";
import { CoachTabBar } from "./CoachTabBar";

type NavLink = { href: string; label: string };

// Gate for the main app: a Player must finish onboarding before using anything
// here. Coaches and "no user selected" pass through (CLAUDE.md section 2).
// The /onboarding route lives outside this group, so it is never gated.
//
// This server component wraps every main route, so it hosts:
//  - the app-wide top header bar (logo left, nav menu right), and
//  - the app-wide TIME OUT takeover for a player with an unacknowledged urgent
//    notification (covers the header too, via its fixed z-50 overlay).
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

  // Nav links — same role-based set as before, now built here so the menu lives
  // in the shared header bar instead of floating on the home page only.
  let links: NavLink[] = [];
  if (user?.role === "PLAYER") {
    const unreadCount = await countUnreadForPlayer(user.id, user.teamId);
    // Overflow links only — Home/Team Circle/Quests live in the bottom tab bar.
    links = [
      { href: `/brand/${user.id}`, label: "Your Brand" },
      { href: "/journal", label: "Journal" },
      { href: "/leaderboard", label: "Leaderboard" },
      {
        href: "/notifications",
        label:
          unreadCount > 0 ? `Notifications (${unreadCount})` : "Notifications",
      },
      { href: "/library", label: "Playbook" },
    ];
  } else if (user?.role === "COACH") {
    // Overflow only — Home/Team Circle/Alerts live in the coach bottom tab bar.
    links = [
      { href: "/leaderboard", label: "Team leaderboard" },
      { href: "/library", label: "Playbook" },
      // Team Settings (branding/roster) will live here in a later chunk — no link yet.
    ];
  }

  return (
    <>
      <header className="relative flex items-center justify-between border-b border-zinc-900 px-3 py-2.5">
        {/* left: player/coach identity chip (the one new link) */}
        {user ? <IdentityChip user={user} /> : <span />}
        {/* center: brand anchor — the E24 logo image (not a link) */}
        <Image
          src="/logo.png"
          alt="Elite 24 MVP"
          width={36}
          height={36}
          className="pointer-events-none absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2"
          priority
        />
        {/* right: hamburger menu (unchanged) */}
        {user ? <NavMenu links={links} /> : <span />}
      </header>
      {children}
      {/* Role bottom tab bars (z-40, below the TIME OUT takeover). */}
      {user?.role === "PLAYER" && <PlayerTabBar />}
      {user?.role === "COACH" && <CoachTabBar />}
      {timeout && <TimeoutTakeover notification={timeout} />}
    </>
  );
}
