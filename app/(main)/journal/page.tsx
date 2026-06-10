import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listEntries } from "@/lib/journal";
import { formatDayKey } from "@/lib/format";

// The player's private journal timeline (newest first). Coaches and "no user"
// have no journal, so they go back to the app.
export default async function JournalPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "PLAYER") {
    redirect("/");
  }

  const entries = await listEntries(user.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Your journal</h1>
        <Link href="/" className="text-sm font-medium text-emerald-700 hover:underline">
          ← Home
        </Link>
      </header>

      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No entries yet. Your daily check-ins will show up here.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {formatDayKey(entry.day)}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {entry.reflection}
              </p>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
