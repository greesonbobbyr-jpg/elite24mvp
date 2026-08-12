import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/context";
import { isSetUp } from "@/lib/onboarding";
import { getActiveTimeout, countUnreadForPlayer } from "@/lib/notifications";
import { TimeoutTakeover } from "./TimeoutTakeover";
import { NavMenu } from "./NavMenu";
import { IdentityChip } from "./IdentityChip";
import { TeamSwitcher } from "./TeamSwitcher";
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
  const ctx = await getCurrentContext();
  const user = ctx?.user;

  // The setup gate (4f): reads the permanent Profile's setupCompletedAt
  // (dual-written 1:1 with the legacy onboardedAt; legacy fallback for
  // pre-backfill logins). Players write the Dream; staff complete at signup.
  if (ctx && user && !isSetUp(ctx)) {
    redirect("/onboarding");
  }

  // TIME OUT + unread badge are scoped to the ACTING membership's team (4c):
  // a two-team athlete only ever gets their acting team's takeover. Falls back
  // to the legacy teamId for pre-backfill logins.
  const actingTeamId = ctx?.membership?.teamId ?? user?.teamId;
  const timeout =
    user?.role === "PLAYER" && actingTeamId != null
      ? await getActiveTimeout(user.id, actingTeamId)
      : null;

  // Nav links — same role-based set as before, now built here so the menu lives
  // in the shared header bar instead of floating on the home page only.
  let links: NavLink[] = [];
  if (user?.role === "PLAYER") {
    const unreadCount = await countUnreadForPlayer(user.id, actingTeamId ?? user.teamId);
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
      <header className="relative flex items-center justify-between border-b border-zinc-900 px-3 py-2.5">
        {/* left: player/coach identity avatar (photo or initials). Profile
            fields come from the permanent Profile since 4b (careerPoints ==
            legacy points by invariant; photo dual-written) with a legacy
            fallback for not-yet-backfilled logins. */}
        {ctx && user ? (
          <IdentityChip
            user={{
              id: user.id,
              name: user.name,
              role: user.role,
              photoUrl: user.photoUrl,
              team: user.team,
              profile: ctx.profile
                ? {
                    photoUrl: ctx.profile.photoUrl,
                    jerseyNumber: ctx.profile.jerseyNumber,
                    points: ctx.profile.careerPoints,
                  }
                : user.profile,
            }}
          />
        ) : (
          <span />
        )}
        {/* center: the Elite24MVP wordmark (live text, non-link) */}
        <div
          aria-label="Elite24MVP"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-black italic leading-none text-white"
          style={{
            fontFamily: "var(--font-barlow)",
            fontSize: "clamp(0.95rem, 4.5vw, 1.25rem)",
            letterSpacing: "-0.01em",
          }}
        >
          Elite<span style={{ color: "#e1102a" }}>24</span>MVP
        </div>
        {/* right: hamburger menu */}
        {user ? <NavMenu links={links} /> : <span />}
      </header>
      {/* Context switcher — only for a person with 2+ active memberships. */}
      {ctx && ctx.memberships.length > 1 && (
        <TeamSwitcher
          memberships={ctx.memberships.map((m) => ({
            id: m.id,
            role: m.role,
            team: { name: m.team.name },
          }))}
          actingMembershipId={ctx.membership?.id ?? null}
        />
      )}
      {children}
      {/* Role bottom tab bars (z-40, below the TIME OUT takeover). */}
      {user?.role === "PLAYER" && <PlayerTabBar />}
      {user?.role === "COACH" && <CoachTabBar />}
      {timeout && <TimeoutTakeover notification={timeout} />}
    </>
  );
}
