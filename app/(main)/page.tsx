import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getTodaysEntry, todayKey } from "@/lib/journal";
import { listLedger, getPointsTotal, POINTS_PER_CHECKIN } from "@/lib/points";
import { listActiveQuests, getTodaysCompletedQuestIds } from "@/lib/quests";
import { countUnreadForPlayer } from "@/lib/notifications";
import { quoteForDay } from "@/lib/quotes";
import { CheckInForm } from "./CheckInForm";
import { PointsHistory } from "./PointsHistory";
import { QuestList } from "./QuestList";

function formatHeight(inches: number | null | undefined): string | null {
  if (inches == null) return null;
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

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
        <div className="flex flex-wrap gap-4 text-sm font-medium text-red-500">
          <Link href="/leaderboard" className="hover:underline">
            Team leaderboard →
          </Link>
          <Link href="/notifications" className="hover:underline">
            Team notifications →
          </Link>
          <Link href="/library" className="hover:underline">
            Playbook →
          </Link>
        </div>
      </main>
    );
  }

  // Player (guaranteed onboarded by the (main) layout gate).
  const profile = user.profile;
  const [todaysEntry, ledger, points, quests, completedIds, unreadCount] =
    await Promise.all([
      getTodaysEntry(user.id),
      listLedger(user.id),
      getPointsTotal(user.id),
      listActiveQuests(),
      getTodaysCompletedQuestIds(user.id),
      countUnreadForPlayer(user.id, user.teamId),
    ]);
  const quote = quoteForDay(todayKey());
  const height = formatHeight(profile?.heightInches);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-red-500">
          Viewing as
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
        <p className="text-sm text-zinc-400">Player · {user.team.name}</p>
      </header>

      {/* Daily check-in (the core loop) */}
      <section className="rounded-xl border border-zinc-800 p-5">
        <p className="text-sm italic text-zinc-400">&ldquo;{quote}&rdquo;</p>
        <h2 className="mt-3 text-lg font-semibold">
          What will you work on today?
        </h2>
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

      {/* Today's quests */}
      <QuestList quests={quests} completedIds={completedIds} />

      {/* Points total with expandable history */}
      <PointsHistory total={points} entries={ledger} />

      <div className="flex flex-wrap gap-4 text-sm font-medium text-red-500">
        <Link href="/journal" className="hover:underline">
          Journal →
        </Link>
        <Link href="/leaderboard" className="hover:underline">
          Leaderboard →
        </Link>
        <Link href="/notifications" className="hover:underline">
          Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""} →
        </Link>
        <Link href="/library" className="hover:underline">
          Playbook →
        </Link>
      </div>

      {/* The Dream — motivation */}
      {profile?.dream && (
        <section className="rounded-xl border border-zinc-800 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            The Dream
          </h2>
          <p className="mt-1 text-lg font-medium">{profile.dream}</p>
        </section>
      )}

      {/* Profile basics */}
      {profile && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {profile.position && <Stat label="Position" value={profile.position} />}
          {height && <Stat label="Height" value={height} />}
          {profile.jerseyNumber != null && (
            <Stat label="Jersey" value={`#${profile.jerseyNumber}`} />
          )}
          {profile.pointsPerGame != null && (
            <Stat label="PPG" value={String(profile.pointsPerGame)} />
          )}
          {profile.reboundsPerGame != null && (
            <Stat label="RPG" value={String(profile.reboundsPerGame)} />
          )}
          {profile.assistsPerGame != null && (
            <Stat label="APG" value={String(profile.assistsPerGame)} />
          )}
        </section>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-900 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
