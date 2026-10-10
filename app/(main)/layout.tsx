import { redirect } from "next/navigation";
import { actingTeam, actingTeamId, getCurrentContext } from "@/lib/context";
import { isSetUp } from "@/lib/onboarding";
import { isStaffSide, personaOf } from "@/lib/persona";
import { chromeFor } from "@/lib/nav";
import { PERSONAL_CARD_TEAM } from "@/app/components/PlayerCard";
import { getActiveTimeout, countUnreadForPlayer } from "@/lib/notifications";
import { TimeoutTakeover } from "./TimeoutTakeover";
import { NavMenu } from "./NavMenu";
import { IdentityChip } from "./IdentityChip";
import { TeamSwitcher } from "./TeamSwitcher";
import { PlayerTabBar } from "./PlayerTabBar";
import { CoachTabBar } from "./CoachTabBar";

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
  // Someone else chose this password (an account made by a script): a new
  // one comes before anything else.
  if (user?.mustChangePassword) {
    redirect("/account/password");
  }

  if (ctx && user && !isSetUp(ctx)) {
    redirect("/onboarding");
  }

  // What this person sees comes from their team roles (lib/persona), not the
  // login's fixed role.
  const persona = ctx ? personaOf(ctx) : null;

  // TIME OUT + unread badge are scoped to the ACTING membership's team (4c):
  // a two-team athlete only ever gets their acting team's takeover — and only
  // for alerts sent since they joined it. No team, no takeover.
  const teamId = ctx ? actingTeamId(ctx) : null;
  const joinedAt = ctx?.membership?.startedAt ?? null;
  const timeout =
    user && persona === "athlete" && teamId != null
      ? await getActiveTimeout(user.id, teamId, joinedAt)
      : null;

  // The ☰ menu + bottom tabs for this persona (lib/nav). The ☰ button
  // carries the unread count so alerts are seen from any page.
  const unreadCount =
    user && persona === "athlete" && teamId != null
      ? await countUnreadForPlayer(user.id, teamId, joinedAt)
      : 0;
  // "Organization View" — org and group admins only (grant-gated), with the
  // pre-backfill legacy fallback (dies at Stage 6).
  const isOrgAdmin = ctx?.profile ? ctx.orgAdminOf.length + ctx.groupAdminOf.length > 0 : true;
  const { links, tabs } = chromeFor(persona, {
    userId: user?.id ?? 0,
    unread: unreadCount,
    isOrgAdmin,
    ceo: ctx?.platformRole === "CEO",
  });

  return (
    <>
      {/* Top padding clears the status bar when installed to the home screen
          (black-translucent status bar + viewport-fit=cover); 0 in a browser
          tab. The inner row keeps the centered wordmark on the row, not on
          the padded box. */}
      {/* theme-dark: the header is the brand frame — black in both modes
          (and the installed iPhone app's status-bar text is always white). */}
      <header className="theme-dark border-b border-line-faint bg-frame px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <div className="relative flex items-center justify-between">
          {/* left: player/coach identity avatar (photo or initials). Profile
              fields come from the permanent Profile since 4b (careerPoints ==
              legacy points by invariant; photo dual-written) with a legacy
              fallback for not-yet-backfilled logins. */}
          {ctx && user ? (
            <IdentityChip
              user={{
                id: user.id,
                name: user.name,
                staff: persona != null && (isStaffSide(persona) || persona === "ceo"),
                photoUrl: user.photoUrl,
                photoCutoutUrl: user.photoCutoutUrl,
                photoMeta: user.photoMeta,
                team: actingTeam(ctx) ?? PERSONAL_CARD_TEAM,
                profile: ctx.profile
                  ? {
                      photoUrl: ctx.profile.photoUrl,
                      photoCutoutUrl: ctx.profile.photoCutoutUrl,
                      photoMeta: ctx.profile.photoMeta,
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
            role="img"
            aria-label="Elite24MVP"
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-black italic leading-none text-ink"
            style={{
              fontFamily: "var(--font-barlow)",
              fontSize: "clamp(0.95rem, 4.5vw, 1.25rem)",
              letterSpacing: "-0.01em",
            }}
          >
            Elite<span className="text-logo">24</span>MVP
          </div>
          {/* right: hamburger menu */}
          {user ? <NavMenu links={links} loginName={user.username ?? user.email} unread={unreadCount} /> : <span />}
        </div>
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
      {tabs === "player" && <PlayerTabBar team />}
      {tabs === "player-solo" && <PlayerTabBar team={false} />}
      {tabs === "coach" && <CoachTabBar />}
      {timeout && <TimeoutTakeover notification={timeout} />}
    </>
  );
}
