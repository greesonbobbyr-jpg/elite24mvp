import Link from "next/link";
import { getTeamOverview } from "@/lib/coach";
import { formatTime } from "@/lib/format";
import { PlayerCard } from "@/app/components/PlayerCard";
import { sendCheckInReminder } from "./coach/actions";

// The coach's team dashboard (shown at "/" for a COACH). A TODAY summary with a
// check-in progress ring + the full roster (alphabetical by last name) as compact
// PlayerCards with a check-in strip, each linking to the coach-only player
// drill-in. Team-scoped via getTeamOverview (the coach's own teamId). Read-only.

export async function CoachHome({
  user,
}: {
  user: {
    teamId: number;
    team: {
      name: string;
      logoUrl: string | null;
      primaryColor: string | null;
      secondaryColor: string | null;
    };
  };
}) {
  const { roster, totalPlayers, checkedInToday, questsDoneToday } =
    await getTeamOverview(user.teamId);

  const remaining = Math.max(0, totalPlayers - checkedInToday);
  const frac = totalPlayers > 0 ? checkedInToday / totalPlayers : 0;

  // progress ring geometry
  const R = 30;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - frac);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-6 py-8">
      <header>
        <p className="e24-eyebrow">Team Dashboard</p>
        <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-white">
          {user.team.name}
        </h1>
      </header>

      {/* TODAY */}
      <section className="e24-surface rounded-2xl border border-red-600/25 p-5">
        <div className="relative z-10 flex items-center gap-5">
          <svg viewBox="0 0 72 72" className="h-[72px] w-[72px] shrink-0">
            <circle
              cx="36"
              cy="36"
              r={R}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="8"
            />
            <circle
              cx="36"
              cy="36"
              r={R}
              fill="none"
              stroke="#ef4444"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={offset}
              transform="rotate(-90 36 36)"
            />
            <text
              x="36"
              y="36"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-white text-[15px] font-black"
            >
              {checkedInToday}/{totalPlayers}
            </text>
          </svg>
          <div className="min-w-0">
            <p className="e24-eyebrow">Today</p>
            <p className="mt-0.5 text-lg font-bold text-white">
              {checkedInToday} of {totalPlayers} checked in
            </p>
            <p className="mt-0.5 text-sm text-zinc-400">
              {remaining} still to check in · {questsDoneToday} quests done today
            </p>
          </div>
        </div>

        {/* Act on the count, don't just stare at it. Canned copy, team-wide. */}
        {remaining > 0 && (
          <form
            action={sendCheckInReminder}
            className="relative z-10 mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3"
          >
            <button
              type="submit"
              className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-red-500 active:scale-95"
            >
              Send check-in reminder
            </button>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400">
              <input
                type="checkbox"
                name="isTimeout"
                className="h-3.5 w-3.5 accent-red-600"
              />
              Send as TIME OUT (takes over their screen)
            </label>
          </form>
        )}
      </section>

      {/* STREAK MILESTONES — prompt the coach to recognize consistency. The app
          prompts, the coach decides and writes; nothing is ever auto-posted. */}
      {(() => {
        const milestone = (n: number) => (n >= 30 ? 30 : n >= 14 ? 14 : n >= 7 ? 7 : 0);
        const hot = roster
          .filter((r) => milestone(r.currentStreak) > 0)
          .sort((a, b) => b.currentStreak - a.currentStreak);
        if (hot.length === 0) return null;
        return (
          <section className="rounded-2xl border border-[#d4af37]/40 bg-gradient-to-r from-[#d4af37]/10 to-zinc-950 p-5">
            <p className="e24-eyebrow">Streak milestones</p>
            <ul className="mt-2 flex flex-col gap-2">
              {hot.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-semibold text-white">
                    🔥 {r.name}
                    <span className="ml-2 text-xs font-bold text-[#e8c766]">
                      {r.currentStreak}-day streak
                    </span>
                  </span>
                  <Link
                    href={`/board?spotlight=${encodeURIComponent(r.name.split(" ")[0])}&days=${r.currentStreak}`}
                    className="shrink-0 text-xs font-bold uppercase tracking-wide text-red-500 transition hover:text-red-400"
                  >
                    Give a shoutout →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })()}

      {/* ROSTER */}
      <section>
        <p className="e24-eyebrow mb-2">Roster · {totalPlayers}</p>
        {roster.length === 0 ? (
          <p className="text-sm text-zinc-500">No players on this team yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {roster.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/coach/player/${r.id}`}
                  className="block rounded-xl transition hover:opacity-90 active:scale-[0.99]"
                >
                  <PlayerCard
                    size="compact"
                    player={{
                      name: r.name,
                      jerseyNumber: r.jerseyNumber,
                      position: r.position,
                      rank: r.rank,
                      points: r.points,
                      photoUrl: r.photoUrl,
                    }}
                    team={user.team}
                  />
                  <p
                    className={`mt-1 px-1 text-[11px] font-medium ${
                      r.checkedInAt ? "text-green-400" : "text-amber-400"
                    }`}
                  >
                    {r.checkedInAt
                      ? `✓ Checked in ${formatTime(r.checkedInAt)}`
                      : "Not checked in yet"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
