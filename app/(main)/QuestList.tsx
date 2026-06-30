import { logQuest, undoQuest } from "./actions";

type Quest = {
  id: number;
  title: string;
  description: string;
  points: number;
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

// Today's active quests as "mission" tiles. A quest already completed today is
// shown in the GOLD earned state and can't be logged again (also enforced by the
// DB unique constraint). Styling only — logging/props are unchanged.
export function QuestList({
  quests,
  completedIds,
}: {
  quests: Quest[];
  completedIds: number[];
}) {
  if (quests.length === 0) return null;
  const done = new Set(completedIds);

  return (
    <ul className="flex flex-col gap-3">
      {quests.map((quest) => {
        const completed = done.has(quest.id);
        return (
          <li
            key={quest.id}
            className={`flex items-center gap-3 rounded-xl border p-4 transition ${
              completed
                ? "border-amber-500/40 bg-gradient-to-r from-amber-950/20 to-zinc-950"
                : "border-zinc-800 bg-zinc-950/40"
            }`}
          >
            {/* icon square */}
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ${
                completed
                  ? "bg-amber-500/15 text-amber-400 ring-amber-500/40"
                  : "bg-red-600/15 text-red-500 ring-red-600/30"
              }`}
            >
              {completed ? (
                <IconCheck className="h-6 w-6" />
              ) : (
                <IconTarget className="h-6 w-6" />
              )}
            </span>

            {/* title + description */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {quest.title}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {quest.description}
              </p>
            </div>

            {/* right: gold DONE badge (static) or red MARK DONE action */}
            {completed ? (
              <form action={undoQuest} className="shrink-0">
                <input type="hidden" name="questId" value={quest.id} />
                <button
                  type="submit"
                  title="Tap to undo"
                  aria-label={`Undo ${quest.title}`}
                  className="relative flex h-12 w-24 flex-col items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.45)] transition hover:bg-amber-500/25 active:scale-[0.97]"
                >
                  <IconUndo className="absolute right-1.5 top-1.5 h-3 w-3 text-amber-400/70" />
                  <span className="text-xs font-bold uppercase tracking-wide leading-none">
                    Done
                  </span>
                  <span className="mt-0.5 text-[11px] font-semibold leading-none">
                    +{quest.points}
                  </span>
                </button>
              </form>
            ) : (
              <form action={logQuest} className="shrink-0">
                <input type="hidden" name="questId" value={quest.id} />
                <button
                  type="submit"
                  className="flex h-12 w-24 flex-col items-center justify-center rounded-xl bg-gradient-to-b from-red-500 to-red-700 text-white shadow-md shadow-red-900/40 transition hover:from-red-500 hover:to-red-600 active:scale-[0.97]"
                >
                  <span className="text-xs font-bold uppercase tracking-wide leading-none">
                    Mark done
                  </span>
                  <span className="mt-0.5 text-[11px] font-semibold leading-none">
                    +{quest.points}
                  </span>
                </button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
