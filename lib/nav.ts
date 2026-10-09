import type { Persona } from "./persona";

export type NavLink = { href: string; label: string };
export type TabBar = "player" | "player-solo" | "coach" | null;

// The app chrome for a persona: the ☰ menu's overflow links and the bottom
// tab bar. Pure, so tests/persona-parity can check every seeded person sees
// what they did before personas existed.
//
//   athlete   Home / Team Circle / Quests tabs; menu adds brand, journal,
//             leaderboard, notifications, playbook
//   personal  no team: Home / Quests tabs; menu adds brand, journal,
//             playbook — no team surfaces
//   staff,    coach tabs; menu adds team settings, Organization (org admins
//   admin     only), the team leaderboard, playbook
export function chromeFor(
  persona: Persona | null,
  opts: { userId: number; unread: number; isOrgAdmin: boolean },
): { links: NavLink[]; tabs: TabBar } {
  switch (persona) {
    case "athlete":
      return {
        tabs: "player",
        links: [
          { href: `/brand/${opts.userId}`, label: "Your Brand" },
          { href: "/journal", label: "Journal" },
          { href: "/leaderboard", label: "Leaderboard" },
          {
            href: "/notifications",
            label: opts.unread > 0 ? `Notifications (${opts.unread})` : "Notifications",
          },
          { href: "/library", label: "Playbook" },
        ],
      };
    case "personal":
      return {
        tabs: "player-solo",
        links: [
          { href: `/brand/${opts.userId}`, label: "Your Brand" },
          { href: "/journal", label: "Journal" },
          { href: "/library", label: "Playbook" },
        ],
      };
    case "staff":
    case "admin":
      return {
        tabs: "coach",
        links: [
          { href: "/team", label: "Team settings" },
          ...(opts.isOrgAdmin ? [{ href: "/org", label: "Organization" }] : []),
          { href: "/leaderboard", label: "Team leaderboard" },
          { href: "/library", label: "Playbook" },
        ],
      };
    default:
      return { tabs: null, links: [] };
  }
}
