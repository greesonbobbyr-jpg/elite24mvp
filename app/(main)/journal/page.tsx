import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listEntries, todayKey } from "@/lib/journal";
import { JournalWall } from "../JournalWall";

// The player's private journal — a "wall of days". Owner-only: server-enforced
// via getCurrentUser + the player-only redirect, and listEntries is scoped to
// the current user's id. Display only — entry creation/model are unchanged.
export default async function JournalPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "PLAYER") {
    redirect("/");
  }

  const entries = await listEntries(user.id);
  const today = todayKey();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-6 py-8">
      <header>
        <h1 className="e24-eyebrow">Your Journal</h1>
        <p className="mt-1 text-sm text-zinc-500">
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
