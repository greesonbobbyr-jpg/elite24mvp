import { NavMenu } from "./NavMenu";
import { getCurrentUser } from "@/lib/session";
import { getTodaysEntry, todayKey } from "@/lib/journal";
import { POINTS_PER_CHECKIN } from "@/lib/points";
import { countUnreadForPlayer } from "@/lib/notifications";
import { storyForDay } from "@/lib/mindset";
import { CheckInForm } from "./CheckInForm";
import { MindsetCard } from "./MindsetCard";

export default async function Home() {
  const user = await getCurrentUser();

  // No user selected (dev switcher idle).
  if (!user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="rounded-full bg-red-600/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-400">
          Dev build
        </span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Elite24MVP
        </h1>
        <p className="max-w-sm text-sm text-zinc-400">
          No user selected. Use the <strong>Dev: switch user</strong> menu in the
          bottom-left corner to view the app as a coach or a player.
        </p>
      </main>
    );
  }

  // Coaches don't do check-ins (player-only loop), but can view the leaderboard.
  if (user.role === "COACH") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
        <header className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-red-500">
            Viewing as
          </span>
          <h1 className="text-3xl font-bold tracking-tight">{user.name}</h1>
          <p className="text-sm text-zinc-400">Coach · {user.team.name}</p>
        </header>
        <section className="rounded-xl border border-zinc-800 p-5">
          <p className="text-sm text-zinc-400">
            Coach view. Team roster and coaching tools arrive in later phases.
          </p>
        </section>
        <NavMenu
          links={[
            { href: "/leaderboard", label: "Team leaderboard" },
            { href: "/notifications", label: "Team notifications" },
            { href: "/board", label: "Team Circle" },
            { href: "/library", label: "Playbook" },
          ]}
        />
      </main>
    );
  }

  // Player (guaranteed onboarded by the (main) layout gate). Quests + points live
  // on /quests; profile basics live on the Brand page. This page stays focused on
  // the Dream, the daily Mindset story, and the check-in/journal.
  const profile = user.profile;
  const [todaysEntry, unreadCount] = await Promise.all([
    getTodaysEntry(user.id),
    countUnreadForPlayer(user.id, user.teamId),
  ]);
  const story = storyForDay(todayKey());

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-red-500">
          Viewing as
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
        <p className="text-sm text-zinc-400">Player · {user.team.name}</p>
      </header>

      <NavMenu
        links={[
          { href: `/brand/${user.id}`, label: "Your Brand" },
          { href: "/journal", label: "Journal" },
          { href: "/quests", label: "Daily Quests" },
          { href: "/leaderboard", label: "Leaderboard" },
          {
            href: "/notifications",
            label:
              unreadCount > 0 ? `Notifications (${unreadCount})` : "Notifications",
          },
          { href: "/board", label: "Team Circle" },
          { href: "/library", label: "Playbook" },
        ]}
      />

      {/* The Dream — prominent at the top */}
      {profile?.dream && (
        <section className="rounded-xl border border-zinc-800 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-red-500">
            The Dream
          </h2>
          <p className="mt-1 text-xl font-semibold">{profile.dream}</p>
        </section>
      )}

      {/* Daily mindset moment — collapsible story of the day + Listen */}
      <MindsetCard title={story.title} body={story.body} />

      {/* Daily check-in (the core loop) */}
      <section className="rounded-xl border border-zinc-800 p-5">
        <h2 className="text-lg font-semibold">What will you work on today?</h2>
        {todaysEntry ? (
          <div className="mt-2">
            <p className="whitespace-pre-wrap text-sm">{todaysEntry.reflection}</p>
            <p className="mt-3 text-xs font-semibold text-red-500">
              ✓ Checked in today (+{POINTS_PER_CHECKIN} points)
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <CheckInForm />
          </div>
        )}
      </section>
    </main>
  );
}
