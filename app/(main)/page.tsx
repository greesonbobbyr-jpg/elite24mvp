import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getTodaysEntry, todayKey } from "@/lib/journal";
import { getTodaysTakeaway } from "@/lib/mindset-takeaway";
import { POINTS_PER_CHECKIN } from "@/lib/points";
import { storyForDay } from "@/lib/mindset";
import { CheckInForm } from "./CheckInForm";
import { MindsetCard } from "./MindsetCard";
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
          </div>
        ) : (
          <div className="mt-3">
            <CheckInForm />
          </div>
        )}
      </Card>

      {/* Daily mindset moment — slim collapsible strip */}
      <MindsetCard
        title={story.title}
        body={story.body}
        savedTakeaway={takeaway?.text ?? ""}
      />
    </main>
  );
}
