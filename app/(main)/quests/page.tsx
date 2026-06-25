import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listActiveQuests, getTodaysCompletedQuestIds } from "@/lib/quests";
import { listLedger, getPointsTotal } from "@/lib/points";
import { QuestList } from "../QuestList";
import { PointsHistory } from "../PointsHistory";

// Daily quests + points history, on their own page (relocated from the home
// check-in page). Player-private; the (main) layout enforces onboarding + footer.
// Quest/points behavior is unchanged — this only moves where they're shown.
export default async function QuestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const header = (
    <header className="flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-tight">Daily Quests</h1>
      <Link href="/" className="text-sm font-medium text-red-500 hover:underline">
        ← Home
      </Link>
    </header>
  );

  // Coaches don't log quests or earn points (player-only loop) — same as before,
  // they just never had this UI. Show a short note instead of a logging view.
  if (user.role === "COACH") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
        {header}
        <section className="rounded-xl border border-zinc-800 p-5">
          <p className="text-sm text-zinc-400">
            Daily quests are part of the player loop.
          </p>
        </section>
      </main>
    );
  }

  const [quests, completedIds, points, ledger] = await Promise.all([
    listActiveQuests(),
    getTodaysCompletedQuestIds(user.id),
    getPointsTotal(user.id),
    listLedger(user.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      {header}
      <QuestList quests={quests} completedIds={completedIds} />
      <PointsHistory total={points} entries={ledger} />
    </main>
  );
}
