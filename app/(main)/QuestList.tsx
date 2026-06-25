import { logQuest } from "./actions";

type Quest = {
  id: number;
  title: string;
  description: string;
  points: number;
};

// Today's active quests. A quest already completed today is shown done and
// can't be logged again (also enforced by the DB unique constraint).
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
    <section className="rounded-xl border border-zinc-800 p-5">
      <h2 className="text-lg font-semibold">Today&apos;s quests</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {quests.map((quest) => {
          const completed = done.has(quest.id);
          return (
            <li
              key={quest.id}
              className="flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-medium">{quest.title}</p>
                <p className="text-xs text-zinc-500">{quest.description}</p>
              </div>
              {completed ? (
                <span className="flex h-9 w-32 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">
                  ✓ Done +{quest.points}
                </span>
              ) : (
                <form action={logQuest} className="shrink-0">
                  <input type="hidden" name="questId" value={quest.id} />
                  <button
                    type="submit"
                    className="flex h-9 w-32 items-center justify-center whitespace-nowrap rounded-full bg-red-600 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    Mark done +{quest.points}
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
