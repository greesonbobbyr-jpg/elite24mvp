import Link from "next/link";
import { redirect } from "next/navigation";
import { actingScope, actingTeam, actingTeamId, getCurrentContext } from "@/lib/context";
import { isStaffSide, personaOf } from "@/lib/persona";
import { can } from "@/lib/authz";
import { todayKey } from "@/lib/journal";
import {
  getMyTodaysEntry,
  getMyTodaysReview,
  getMyLatestReviewNote,
} from "@/lib/data/reflections";
import { getTodaysTakeaway } from "@/lib/mindset-takeaway";
import { POINTS_PER_CHECKIN } from "@/lib/points";
import { storyForDay } from "@/lib/mindset";
import { listActiveQuestsForOrg, getTodaysCompletedQuestIds } from "@/lib/quests";
import { getTeamRanking } from "@/lib/leaderboard";
import { starProgress } from "@/lib/cardTheme";
import { CheckInForm } from "./CheckInForm";
import { MindsetCard } from "./MindsetCard";
import { ReviewCard } from "./ReviewCard";
import { CoachHome } from "./CoachHome";
import { JoinTeamCard } from "./JoinTeamCard";
import { Card } from "@/app/components/ui/Card";
import { chipClass } from "@/app/components/ui/Pill";
import { StarIcon, StatTile } from "@/app/components/ui/StatTile";

export default async function Home() {
  const ctx = await getCurrentContext();
  const user = ctx?.user;

  // Unauthenticated → login (middleware also enforces this; defense in depth).
  if (!ctx || !user) redirect("/login");

  // Staff get the team dashboard + roster (the player daily loop lives below).
  const persona = personaOf(ctx);
  const teamId = actingTeamId(ctx);
  const team = actingTeam(ctx);
  if (isStaffSide(persona)) {
    // An org admin with no team yet runs things from Organization.
    if (teamId == null || !team) {
      return (
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-6 py-8">
          <Card>
            <h1 className="text-lg font-semibold">No team yet</h1>
            <p className="mt-1 text-sm text-muted">Your organization&apos;s teams are set up from Organization.</p>
            <Link href="/org" className="mt-3 inline-block text-sm font-semibold text-brand">Open Organization →</Link>
          </Card>
        </main>
      );
    }
    const scope = actingScope(ctx);
    const canSendTimeout = scope ? can(ctx, "send_timeout", scope) : true;
    return <CoachHome teamId={teamId} team={team} canSendTimeout={canSendTimeout} />;
  }

  // Player (guaranteed onboarded by the (main) layout gate). Quests + points live
  // on /quests; profile basics live on the Brand page. This page stays focused on
  // the Dream, the daily Mindset story, and the check-in/journal.
  const profile = user.profile;
  const todaysEntry = await getMyTodaysEntry({ user });
  const takeaway = await getTodaysTakeaway(user.id);
  const story = storyForDay(todayKey());

  // "Next up" counts + Pro Review data for the checked-in state; the note from
  // the player's last review surfaces above the check-in prompt otherwise.
  let quests: Awaited<ReturnType<typeof listActiveQuestsForOrg>> = [];
  let completedIds: number[] = [];
  let todaysReview: Awaited<ReturnType<typeof getMyTodaysReview>> = null;
  let lastNote: Awaited<ReturnType<typeof getMyLatestReviewNote>> = null;
  if (todaysEntry) {
    [quests, completedIds, todaysReview] = await Promise.all([
      listActiveQuestsForOrg(ctx.org?.id),
      getTodaysCompletedQuestIds(user.id),
      getMyTodaysReview({ user }),
    ]);
  } else {
    lastNote = await getMyLatestReviewNote({ user });
  }
  const questsDone = quests.filter((q) => completedIds.includes(q.id)).length;
  const loggedQuests = quests
    .filter((q) => completedIds.includes(q.id))
    .map((q) => ({ title: q.title, points: q.points }));

  // Progress strip: streak / tier / rank — the "why come back" state, on the
  // first screen instead of buried in /quests and /leaderboard. Board = acting
  // team; tier = careerPoints (4d; equals the legacy cache by invariant). No
  // team, no rank: the third tile shows career points instead.
  const ranking = teamId != null ? await getTeamRanking(teamId) : [];
  const myRank = ranking.find((r) => r.id === user.id)?.rank ?? 0;
  const points = ctx.profile?.careerPoints ?? profile?.points ?? 0;
  const level = starProgress(points);
  const streak = profile?.currentStreak ?? 0;
  const shieldReady = !(profile?.streakGraceUsed ?? false);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-6 py-8">
      {/* No active roster spot (removed / season rolled over): the join card
          leads; the daily loop below keeps working (offseason — career only). */}
      {ctx.profile && !ctx.membership && <JoinTeamCard />}

      {/* The Dream — the material hero */}
      {profile?.dream && (
        <Card variant="material">
          <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-accent" />
          <div className="relative z-10">
            <h2 className="e24-eyebrow">My Dream</h2>
            <p className="mt-1 text-xl font-bold leading-snug text-ink">
              {profile.dream}
            </p>
          </div>
        </Card>
      )}

      {/* Progress strip — streak · stars · rank at a glance. The stars are
          the card's TIER panel: a 1–5 star Prospect. */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Day streak">
          <p className="text-xl font-black leading-none text-ink">
            🔥 {streak}
            {shieldReady && streak > 0 && (
              <span title="Shield ready — one missed day won't break it" className="ml-1 align-middle text-[11px]">🛡️</span>
            )}
          </p>
        </StatTile>
        <StatTile
          ariaLabel={`${level.stars}-star Prospect${level.nextStars ? `, ${level.toNext} points to ${level.nextStars} stars` : ", top level"}`}
          label={level.nextStars ? <>{level.toNext.toLocaleString()} pts to {level.nextStars}★</> : "Top level"}
        >
          <span className="flex text-gold-solid">
            {Array.from({ length: level.stars }, (_, i) => (
              <StarIcon key={i} className="h-3.5 w-3.5" />
            ))}
          </span>
          <span className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-ink">Prospect</span>
        </StatTile>
        {teamId != null ? (
          <StatTile label="Team rank">
            <p className="text-xl font-black leading-none text-ink">{myRank > 0 ? `#${myRank}` : "—"}</p>
          </StatTile>
        ) : (
          <StatTile label="Career points">
            <p className="text-xl font-black leading-none text-ink">{points.toLocaleString()}</p>
          </StatTile>
        )}
      </div>

      {/* Daily check-in (the core loop) — the main act */}
      <Card className="shadow-md">
        <h2 className="text-lg font-semibold">What will you work on today?</h2>
        {todaysEntry ? (
          <div className="mt-3">
            <span className={chipClass("good")}>
              ✓ Checked in today · +{POINTS_PER_CHECKIN}
            </span>
            <p className="mt-3 whitespace-pre-wrap text-sm text-ink-soft">
              {todaysEntry.reflection}
            </p>
            {/* Peak-motivation moment — chain into the next habit, don't dead-end. */}
            <Link
              href="/quests"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition hover:text-brand-2"
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

      {/* Daily mindset moment — UNLOCKS with the check-in (the story is the
          day's variable reward for showing up; no spoilers beforehand). */}
      {todaysEntry ? (
        <MindsetCard
          title={story.title}
          body={story.body}
          savedTakeaway={takeaway?.text ?? ""}
        />
      ) : (
        <section className="rounded-xl border border-dashed border-line-strong bg-sunken">
          <div className="flex w-full items-center gap-3 px-4 py-3">
            <span aria-hidden className="shrink-0 text-base">
              🔒
            </span>
            <span className="e24-eyebrow shrink-0">1-Minute Mindset</span>
            <span className="min-w-0 flex-1 truncate text-sm text-subtle">
              Check in to unlock today&apos;s story
            </span>
          </div>
        </section>
      )}

      {/* Evening Pro Review — BELOW the Mindset (a collapsed "end your day"
          strip), so the post-check-in flow reads: story now, review tonight. */}
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
    </main>
  );
}
