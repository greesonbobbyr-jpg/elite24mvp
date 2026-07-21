import { undoQuest } from "./actions";
import { MarkDoneButton } from "./MarkDoneButton";
import { PredictStartForm, LogActualForm } from "./QuestPredictForms";

type Quest = {
  id: number;
  title: string;
  description: string;
  points: number;
  targetCount: number | null;
};

type TodayLog = {
  questId: number;
  status: "PENDING" | "APPROVED";
  predicted: number | null;
  actual: number | null;
};

// Shared quest icons (no per-quest icon field). Embedded MDI paths (Apache-2.0),
// currentColor — same pattern as WhistleIcon / the tab-bar icons.
function IconTarget({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M11,2V4.07C7.38,4.53 4.53,7.38 4.07,11H2V13H4.07C4.53,16.62 7.38,19.47 11,19.93V22H13V19.93C16.62,19.47 19.47,16.62 19.93,13H22V11H19.93C19.47,7.38 16.62,4.53 13,4.07V2M11,6.08V8H13V6.09C15.5,6.5 17.5,8.5 17.92,11H16V13H17.91C17.5,15.5 15.5,17.5 13,17.92V16H11V17.91C8.5,17.5 6.5,15.5 6.08,13H8V11H6.09C6.5,8.5 8.5,6.5 11,6.08M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11Z" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  // MDI "check-bold"
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" />
    </svg>
  );
}

function IconUndo({ className }: { className?: string }) {
  // MDI "undo-variant"
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8,10H16A4,4 0 0,1 20,14A4,4 0 0,1 16,18H10V20H16A6,6 0 0,0 22,14A6,6 0 0,0 16,8H8V5L4,9L8,13V10Z" />
    </svg>
  );
}

// Today's active quests as "mission" tiles. Plain quests are one-tap; MEASURABLE
// quests (targetCount set) run the predict-then-log calibration flow:
// no log → predict+start (PENDING) → log actual (APPROVED, gold, shows
// "guessed X · made Y"). Completed tiles show gold and tap-to-undo.
export function QuestList({
  quests,
  logs,
}: {
  quests: Quest[];
  logs: TodayLog[];
}) {
  if (quests.length === 0) return null;
  const byQuest = new Map(logs.map((l) => [l.questId, l]));

  return (
    <ul className="flex flex-col gap-3">
      {quests.map((quest) => {
        const log = byQuest.get(quest.id);
        const completed = log?.status === "APPROVED";
        const pending = log?.status === "PENDING";
        const measurable = quest.targetCount != null;
        return (
          <li
            key={quest.id}
            className={`flex items-center gap-3 rounded-xl border p-4 transition ${
              completed
                ? "border-[#d4af37]/40 bg-gradient-to-r from-[#d4af37]/10 to-zinc-950"
                : pending
                  ? "border-red-500/40 bg-red-950/10"
                  : "border-zinc-800 bg-zinc-950/40"
            }`}
          >
            {/* icon square */}
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ${
                completed
                  ? "bg-[#d4af37]/15 text-[#d4af37] ring-[#d4af37]/40"
                  : "bg-red-600/15 text-red-500 ring-red-600/30"
              }`}
            >
              {completed ? (
                <IconCheck className="h-6 w-6" />
              ) : (
                <IconTarget className="h-6 w-6" />
              )}
            </span>

            {/* title + description (+ calibration once a measurable is done) */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {quest.title}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {quest.description}
              </p>
              {completed &&
                measurable &&
                log?.predicted != null &&
                log?.actual != null && (
                  <p className="mt-0.5 text-xs font-semibold text-[#e8c766]">
                    guessed {log.predicted} · made {log.actual}
                  </p>
                )}
            </div>

            {/* right: state-driven control */}
            {completed ? (
              <form action={undoQuest} className="shrink-0">
                <input type="hidden" name="questId" value={quest.id} />
                <button
                  type="submit"
                  title="Tap to undo"
                  aria-label={`Undo ${quest.title}`}
                  className="relative flex h-12 w-24 flex-col items-center justify-center rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/15 text-[#e8c766] shadow-[0_0_12px_rgba(212,175,55,0.5)] transition hover:bg-[#d4af37]/25 active:scale-[0.97]"
                >
                  <IconUndo className="absolute right-1.5 top-1.5 h-3 w-3 text-[#d4af37]/70" />
                  <span className="text-xs font-bold uppercase tracking-wide leading-none">
                    Done
                  </span>
                  <span className="mt-0.5 text-[11px] font-semibold leading-none">
                    +{quest.points}
                  </span>
                </button>
              </form>
            ) : pending && measurable ? (
              <LogActualForm
                questId={quest.id}
                targetCount={quest.targetCount as number}
                predicted={log?.predicted ?? 0}
                points={quest.points}
              />
            ) : measurable ? (
              <PredictStartForm
                questId={quest.id}
                targetCount={quest.targetCount as number}
              />
            ) : (
              <MarkDoneButton questId={quest.id} points={quest.points} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
