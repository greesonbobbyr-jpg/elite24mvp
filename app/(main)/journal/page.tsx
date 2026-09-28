import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/context";
import { todayKey } from "@/lib/journal";
import { listMyEntries } from "@/lib/data/reflections";
import { JournalWall } from "../JournalWall";

// The player's private journal — a "wall of days". Owner-only STRUCTURALLY:
// listMyEntries derives the author from the caller's own ctx (no id parameter
// exists to pass someone else's). Display only — entry creation is unchanged.
export default async function JournalPage() {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user || user.role !== "PLAYER") {
    redirect("/");
  }

  const entries = await listMyEntries({ user });
  const today = todayKey();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-6 py-8">
      <header>
        <h1 className="e24-eyebrow">Your Journal</h1>
        <p className="mt-1 text-sm text-subtle">
          {entries.length} day{entries.length === 1 ? "" : "s"} logged
        </p>
      </header>

      <JournalWall
        entries={entries.map((e) => ({
          id: e.id,
          day: e.day,
          reflection: e.reflection,
        }))}
        today={today}
      />
    </main>
  );
}
