import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getTodaysEntry, todayKey } from "@/lib/journal";
import { getTodaysTakeaway } from "@/lib/mindset-takeaway";
import { POINTS_PER_CHECKIN } from "@/lib/points";
import { storyForDay } from "@/lib/mindset";
import { listActiveQuests, getTodaysCompletedQuestIds } from "@/lib/quests";
import { getTodaysReview, getLatestReviewNote } from "@/lib/review";
import { CheckInForm } from "./CheckInForm";
import { MindsetCard } from "./MindsetCard";
import { ReviewCard } from "./ReviewCard";
import { CoachHome } from "./CoachHome";
import { Card } from "@/app/components/ui/Card";

export default async function Home() {
  const user = await getCurrentUser();

  // Unauthenticated → login (middleware also enforces this; defense in depth).
  if (!user) redirect("/login");

  // Coaches get the team dashboard + roster (player-only daily loop lives below).
  if (user.role === "COACH") {
    return <CoachHome user={user} />;
  }

  // Player (guaranteed onboarded by the (main) layout gate). Quests + points live
  // on /quests; profile basics live on the Brand page. This page stays focused on
  // the Dream, the daily Mindset story, and the check-in/journal.
  const profile = user.profile;
  const todaysEntry = await getTodaysEntry(user.id);
  const takeaway = await getTodaysTakeaway(user.id);
  const story = storyForDay(todayKey());

  // "Next up" counts + Pro Review data for the checked-in state; the note from
  // the player's last review surfaces above the check-in prompt otherwise.
  let quests: Awaited<ReturnType<typeof listActiveQuests>> = [];
  let completedIds: number[] = [];
  let todaysReview: Awaited<ReturnType<typeof getTodaysReview>> = null;
  let lastNote: Awaited<ReturnType<typeof getLatestReviewNote>> = null;
  if (todaysEntry) {
    [quests, completedIds, todaysReview] = await Promise.all([
      listActiveQuests(),
      getTodaysCompletedQuestIds(user.id),
      getTodaysReview(user.id),
    ]);
  } else {
    lastNote = await getLatestReviewNote(user.id);
  }
  const questsDone = quests.filter((q) => completedIds.includes(q.id)).length;
  const loggedQuests = quests
    .filter((q) => completedIds.includes(q.id))
    .map((q) => ({ title: q.title, points: q.points }));

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-6 py-8">
      {/* The Dream — the material hero */}
      {profile?.dream && (
        <Card variant="material">
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1.5 bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.8)]"
          />
          <div className="relative z-10">
            <h2 className="e24-eyebrow">My Dream</h2>
            <p className="mt-1 text-xl font-bold leading-snug text-white">
              {profile.dream}
            </p>
          </div>
        </Card>
      )}

      {/* Daily check-in (the core loop) — the main act */}
      <Card className="bg-gradient-to-b from-zinc-900/60 to-zinc-950 shadow-lg shadow-black/40">
        <h2 className="text-lg font-semibold">What will you work on today?</h2>
        {todaysEntry ? (
          <div className="mt-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600/15 px-3 py-1 text-xs font-semibold text-red-400">
              ✓ Checked in today · +{POINTS_PER_CHECKIN}
            </span>
            <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-200">
              {todaysEntry.reflection}
            </p>
            {/* Peak-motivation moment — chain into the next habit, don't dead-end. */}
            <Link
              href="/quests"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-red-500 transition hover:text-red-400"
            >
              Next up: Quests · {questsDone} of {quests.length} done →
            </Link>
          </div>
        ) : (
          <div className="mt-3">
            <CheckInForm lastNote={lastNote?.noteToTomorrow ?? null} />
          </div>
        )}
      </Card>

      {/* Evening Pro Review — closes the loop the morning check-in opened. */}
      {todaysEntry && (
        <ReviewCard
          reflection={todaysEntry.reflection}
          loggedQuests={loggedQuests}
          savedReview={
            todaysReview
              ? {
                  outcome: todaysReview.outcome,
                  learned: todaysReview.learned,
                  noteToTomorrow: todaysReview.noteToTomorrow,
                }
              : null
          }
        />
      )}

      {/* Daily mindset moment — UNLOCKS with the check-in (the story is the
          day's variable reward for showing up; no spoilers beforehand). */}
      {todaysEntry ? (
        <MindsetCard
          title={story.title}
          body={story.body}
          savedTakeaway={takeaway?.text ?? ""}
        />
      ) : (
        <section className="rounded-xl border border-zinc-800 bg-zinc-950/60">
          <div className="flex w-full items-center gap-3 px-4 py-3">
            <span aria-hidden className="shrink-0 text-base">
              🔒
            </span>
            <span className="e24-eyebrow shrink-0">1-Minute Mindset</span>
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-500">
              Check in to unlock today&apos;s story
            </span>
          </div>
        </section>
      )}
    </main>
  );
}
