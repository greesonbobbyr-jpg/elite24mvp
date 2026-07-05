import Link from "next/link";
import { getTeamOverview } from "@/lib/coach";
import { formatTime } from "@/lib/format";

// The coach's team dashboard (shown at "/" for a COACH). A TODAY summary with a
// check-in progress ring + the full roster (alphabetical by last name), each row
// linking to the coach-only player drill-in. Team-scoped via getTeamOverview
// (the coach's own teamId). Read-only.

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export async function CoachHome({
  user,
}: {
  user: { teamId: number; team: { name: string } };
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
      </section>

      {/* ROSTER */}
      <section>
        <p className="e24-eyebrow mb-2">Roster · {totalPlayers}</p>
        {roster.length === 0 ? (
          <p className="text-sm text-zinc-500">No players on this team yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {roster.map((r) => {
              const meta = [
                r.jerseyNumber != null ? `#${r.jerseyNumber}` : null,
                r.position,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={r.id}>
                  <Link
                    href={`/coach/player/${r.id}`}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 transition hover:border-red-500/40 hover:bg-white/[0.04] active:scale-[0.99]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-700 to-red-950 text-xs font-bold text-white ring-1 ring-red-500/40">
                      {initials(r.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {r.name}
                      </p>
                      {meta && (
                        <p className="truncate text-[11px] text-zinc-500">{meta}</p>
                      )}
                      {r.checkedInAt ? (
                        <p className="text-[11px] font-medium text-green-400">
                          ✓ Checked in {formatTime(r.checkedInAt)}
                        </p>
                      ) : (
                        <p className="text-[11px] font-medium text-amber-400">
                          Not checked in yet
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-black tabular-nums text-white">
                        {r.points}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        {r.rank > 0 ? `#${r.rank}` : "—"}
                      </p>
                    </div>
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 shrink-0 text-zinc-600"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
