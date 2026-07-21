import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listActiveQuests, getTodaysQuestLogs } from "@/lib/quests";
import { listLedger, getPointsTotal } from "@/lib/points";
import { todayKey } from "@/lib/journal";
import { QuestList } from "../QuestList";
import { PointsHistory } from "../PointsHistory";
import { AnimatedTotal } from "../AnimatedTotal";
import { Card } from "@/app/components/ui/Card";
import { tierForPoints, TIERS } from "@/lib/cardTheme";

// Daily quests + points, the player's "Mission Board". Player-private; the (main)
// layout enforces onboarding + footer. Styling only — quest/points behavior is
// unchanged; the hero total, "+N today", and progress are derived from data the
// page already loads (no new queries).
export default async function QuestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  // Coaches don't log quests or earn points (player-only loop).
  if (user.role === "COACH") {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-6 py-8">
        <h1 className="e24-eyebrow">Daily Quests</h1>
        <Card variant="material">
          <p className="relative z-10 text-sm text-zinc-300">
            Daily quests are part of the player loop.
          </p>
        </Card>
      </main>
    );
  }

  const [quests, todayLogs, points, ledger] = await Promise.all([
    listActiveQuests(),
    getTodaysQuestLogs(user.id),
    getPointsTotal(user.id),
    listLedger(user.id),
  ]);

  // Derived display only (no new queries):
  const logs = [...todayLogs.values()];
  const done = new Set(
    logs.filter((l) => l.status === "APPROVED").map((l) => l.questId),
  );
  const totalCount = quests.length;
  const doneCount = quests.filter((q) => done.has(q.id)).length;
  const today = todayKey();
  const pointsToday = ledger
    .filter((e) => todayKey(new Date(e.createdAt)) === today)
    .reduce((sum, e) => sum + e.amount, 0);
  const pct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  // Tier progress — makes the card-border tier a mid-term goal, not just décor.
  const tier = tierForPoints(points);
  const nextTier = TIERS[TIERS.findIndex((t) => t.key === tier.key) + 1] ?? null;
  const tierPct = nextTier
    ? Math.min(100, ((points - tier.min) / (nextTier.min - tier.min)) * 100)
    : 100;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-6 py-8">
      <h1 className="e24-eyebrow">Daily Quests</h1>

      {/* Points-total hero */}
      <Card variant="material">
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <AnimatedTotal value={points} />
            <p className="e24-eyebrow mt-2">Total Points</p>
          </div>
          {pointsToday > 0 && (
            <span className="shrink-0 text-sm font-bold text-amber-400">
              +{pointsToday} today
            </span>
          )}
        </div>
      </Card>

      {/* Tier progress */}
      <div>
        <div className="flex items-baseline justify-between">
          <span className="e24-eyebrow uppercase">{tier.label}</span>
          <span className="text-xs font-semibold text-zinc-400">
            {nextTier
              ? `${nextTier.min - points} PTS TO ${nextTier.label.toUpperCase()}`
              : "TOP TIER"}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-[#e8c766] transition-[width]"
            style={{ width: `${tierPct}%` }}
          />
        </div>
      </div>

      {/* Today's progress */}
      {totalCount > 0 && (
        <div>
          <div className="flex items-baseline justify-between">
            <span className="e24-eyebrow">Today&apos;s Progress</span>
            <span className="text-xs font-semibold text-zinc-400">
              {doneCount} / {totalCount} DONE
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-600 transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <QuestList quests={quests} logs={logs} />
      <PointsHistory total={points} entries={ledger} />
    </main>
  );
}
