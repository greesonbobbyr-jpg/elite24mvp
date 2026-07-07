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
      { href: "/team", label: "Team settings" },
      { href: "/leaderboard", label: "Team leaderboard" },
      { href: "/library", label: "Playbook" },
    ];
  }

  return (
    <>
      {/* 3-column grid: equal minmax(0,1fr) flanks keep the center wordmark
          SCREEN-centered while making it impossible to overlap the chip or
          hamburger (separate grid columns). The flanks shrink + truncate on
          narrow screens; desktop is unchanged. */}
      <header
        className="grid items-center gap-2 border-b border-zinc-900 px-3 py-2.5"
        style={{ gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)" }}
      >
        {/* left: player/coach identity chip */}
        <div className="flex min-w-0 justify-self-start overflow-hidden">
          {user ? <IdentityChip user={user} /> : <span />}
        </div>
        {/* center: the Elite24MVP wordmark (live text, non-link) */}
        <div
          aria-label="Elite24MVP"
          className="pointer-events-none justify-self-center whitespace-nowrap font-black italic leading-none text-white"
          style={{
            fontFamily: "var(--font-barlow)",
            fontSize: "clamp(0.8rem, 3.2vw, 1.25rem)",
            letterSpacing: "-0.01em",
          }}
        >
          Elite<span style={{ color: "#e1102a" }}>24</span>MVP
        </div>
        {/* right: hamburger menu */}
        <div className="flex min-w-0 justify-self-end">
          {user ? <NavMenu links={links} /> : <span />}
        </div>
      </header>
      {children}
      {/* Role bottom tab bars (z-40, below the TIME OUT takeover). */}
      {user?.role === "PLAYER" && <PlayerTabBar />}
      {user?.role === "COACH" && <CoachTabBar />}
      {timeout && <TimeoutTakeover notification={timeout} />}
    </>
  );
}
