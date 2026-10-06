import { redirect } from "next/navigation";
import { actingScope, getCurrentContext } from "@/lib/context";
import { can } from "@/lib/authz";
import { getPlayerCoachView } from "@/lib/coach";
import { formatTime } from "@/lib/format";
import { AdjustPointsForm } from "./AdjustPointsForm";
import { PlayerCard } from "@/app/components/PlayerCard";
import { photoSrc, cutoutSrc } from "@/lib/photoUrl";
import { bannerClass } from "@/app/components/ui/Banner";

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
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user || user.role !== "COACH") redirect("/");

  // Matrix (4e): the drill-in is view_player_detail (all staff roles);
  // adjust_points and view_takeaways gate their sections below.
  const scope = actingScope(ctx);
  if (scope && !can(ctx, "view_player_detail", scope)) redirect("/");
  const canAdjust = scope ? can(ctx, "adjust_points", scope) : true;
  const canSeeTakeaway = scope ? can(ctx, "view_takeaways", scope) : true;

  const id = Number.parseInt(playerId, 10);
  if (!Number.isInteger(id)) redirect("/");

  const view = await getPlayerCoachView(user.teamId, id, canSeeTakeaway);
  if (!view) redirect("/"); // not a player on the staffer's team

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
            total: view.points,
            rosterSize: view.total,
            photoUrl: photoSrc(view.id, view.photoUrl),
            cutoutUrl: cutoutSrc(view.id, view.photoCutoutUrl),
            photoMeta: view.photoMeta,
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
          <div className={bannerClass("good")}>
            ✓ Checked in at {formatTime(view.checkedInAt)}
            {/* Review STATUS only — its text is player-private, like the journal. */}
            <span className="mt-1 block text-xs font-normal">
              {view.reviewDoneToday ? (
                <span className="text-good">✓ Pro Review done</span>
              ) : (
                <span className="text-subtle">Pro Review not done yet</span>
              )}
            </span>
          </div>
        ) : (
          <div className={bannerClass("warn")}>
            Not checked in yet
          </div>
        )}
      </section>

      {/* Today's Mindset takeaway — coach-visible by design (NOT the private
          check-in reflection). Hidden entirely for roles without
          view_takeaways (GMs); at-time team scoping is enforced in lib/coach. */}
      {canSeeTakeaway && (
      <section>
        <p className="e24-eyebrow mb-2">Today&apos;s Mindset takeaway</p>
        {view.mindsetTakeaway ? (
          <div className="e24-surface rounded-2xl p-4">
            <p className="relative z-10 whitespace-pre-wrap text-sm text-ink">
              {view.mindsetTakeaway}
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-line bg-sunken px-4 py-3 text-sm text-subtle">
            Not written yet
          </p>
        )}
      </section>
      )}

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
      <section className="e24-surface rounded-2xl p-5">
        <div className="relative z-10">
          <p className="e24-eyebrow">Points</p>
          <p className="mt-1 text-4xl font-black tabular-nums text-ink">
            {view.points}
          </p>
          {canAdjust && <AdjustPointsForm playerId={view.id} />}
        </div>
      </section>

    </main>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg border border-line bg-field px-2.5 py-1 text-xs">
      <span className="text-subtle">{label} </span>
      <span className="font-semibold text-ink">{value}</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-field px-3 py-3 text-center">
      <div className="text-lg font-black tabular-nums text-ink">{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-subtle">
        {label}
      </div>
    </div>
  );
}
