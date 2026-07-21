import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPlayerCoachView } from "@/lib/coach";
import { formatTime } from "@/lib/format";
import { AdjustPointsForm } from "./AdjustPointsForm";
import { PlayerCard } from "@/app/components/PlayerCard";

// Coach-only drill-in on one player. Guard: a COACH may view only a PLAYER on
// their OWN team (getPlayerCoachView returns null otherwise → redirect), the same
// same-team refusal as /brand/[id]. Shows status/counts only — journal reflections
// and check-in text are NEVER read here (server-enforced in lib/coach.ts).

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

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-6 py-8">
      {/* Identity — the player's full card + coach stat chips */}
      <div className="flex flex-col items-center gap-3">
        <PlayerCard
          size="full"
          player={{
            name: view.name,
            jerseyNumber: view.jerseyNumber,
            position: view.position,
            heightInches: view.heightInches,
            rank: view.rank > 0 ? view.rank : null,
            points: view.points,
            photoUrl: view.photoUrl,
          }}
          team={user.team}
        />
        <div className="flex flex-wrap justify-center gap-2">
          <Chip
            label="Rank"
            value={view.rank > 0 ? `#${view.rank} of ${view.total}` : "—"}
          />
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

      {/* Today — status only */}
      <section>
        <p className="e24-eyebrow mb-2">Today</p>
        {view.checkedInAt ? (
          <div className="rounded-xl border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm font-medium text-green-300">
            ✓ Checked in at {formatTime(view.checkedInAt)}
            {/* Review STATUS only — its text is player-private, like the journal. */}
            <span className="mt-1 block text-xs font-normal">
              {view.reviewDoneToday ? (
                <span className="text-green-400">✓ Pro Review done</span>
              ) : (
                <span className="text-zinc-500">Pro Review not done yet</span>
              )}
            </span>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-600/30 bg-amber-600/10 px-4 py-3 text-sm font-medium text-amber-300">
            Not checked in yet
          </div>
        )}
      </section>

      {/* Today's Mindset takeaway — coach-visible by design (NOT the private
          check-in reflection). */}
      <section>
        <p className="e24-eyebrow mb-2">Today&apos;s Mindset takeaway</p>
        {view.mindsetTakeaway ? (
          <div className="e24-surface rounded-2xl border border-red-600/25 p-4">
            <p className="relative z-10 whitespace-pre-wrap text-sm text-zinc-100">
              {view.mindsetTakeaway}
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm text-zinc-500">
            Not written yet
          </p>
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
