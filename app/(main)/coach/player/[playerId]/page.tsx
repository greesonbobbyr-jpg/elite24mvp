import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPlayerCoachView } from "@/lib/coach";
import { formatTime } from "@/lib/format";
import { AdjustPointsForm } from "./AdjustPointsForm";

// Coach-only drill-in on one player. Guard: a COACH may view only a PLAYER on
// their OWN team (getPlayerCoachView returns null otherwise → redirect), the same
// same-team refusal as /brand/[id]. Shows status/counts only — journal reflections
// and check-in text are NEVER read here (server-enforced in lib/coach.ts).

function formatHeight(inches: number | null): string | null {
  if (inches == null) return null;
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

export default async function CoachPlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "COACH") redirect("/");

  const id = Number.parseInt(playerId, 10);
  if (!Number.isInteger(id)) redirect("/");

  const view = await getPlayerCoachView(user.teamId, id);
  if (!view) redirect("/"); // not a player on the coach's team

  const height = formatHeight(view.heightInches);
  const meta = [
    view.jerseyNumber != null ? `#${view.jerseyNumber}` : null,
    view.position,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-6 py-8">
      <Link
        href="/"
        className="text-sm font-medium text-red-500 transition hover:text-red-400"
      >
        ← Team
      </Link>

      {/* Identity */}
      <section className="e24-surface rounded-2xl border border-red-600/25 p-5">
        <div className="relative z-10">
          <p className="e24-eyebrow">Player</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
            {view.name}
          </h1>
          {meta && <p className="mt-0.5 text-sm text-zinc-400">{meta}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {height && <Chip label="Height" value={height} />}
            <Chip label="Rank" value={view.rank > 0 ? `#${view.rank} of ${view.total}` : "—"} />
            {view.pointsPerGame != null && (
              <Chip label="PPG" value={String(view.pointsPerGame)} />
            )}
            {view.reboundsPerGame != null && (
              <Chip label="RPG" value={String(view.reboundsPerGame)} />
            )}
            {view.assistsPerGame != null && (
              <Chip label="APG" value={String(view.assistsPerGame)} />
            )}
          </div>
        </div>
      </section>

      {/* Today — status only */}
      <section>
        <p className="e24-eyebrow mb-2">Today</p>
        {view.checkedInAt ? (
          <div className="rounded-xl border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm font-medium text-green-300">
            ✓ Checked in at {formatTime(view.checkedInAt)}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-600/30 bg-amber-600/10 px-4 py-3 text-sm font-medium text-amber-300">
            Not checked in yet
          </div>
        )}
      </section>

      {/* This week */}
      <section>
        <p className="e24-eyebrow mb-2">This week</p>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Check-ins" value={String(view.week.checkins)} />
          <Stat label="Quests done" value={String(view.week.questsDone)} />
          <Stat label="Points" value={String(view.week.pointsEarned)} />
        </div>
      </section>

      {/* Points */}
      <section className="e24-surface rounded-2xl border border-red-600/25 p-5">
        <div className="relative z-10">
          <p className="e24-eyebrow">Points</p>
          <p className="mt-1 text-4xl font-black tabular-nums text-white">
            {view.points}
          </p>
          <AdjustPointsForm playerId={view.id} />
        </div>
      </section>

      {/* Journal — locked */}
      <section className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-400">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-zinc-500" fill="currentColor" aria-hidden>
            <path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z" />
          </svg>
          Journal
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Private to the player — not visible to coaches.
        </p>
      </section>
    </main>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 text-xs">
      <span className="text-zinc-500">{label} </span>
      <span className="font-semibold text-white">{value}</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-center">
      <div className="text-lg font-black tabular-nums text-white">{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
    </div>
  );
}
